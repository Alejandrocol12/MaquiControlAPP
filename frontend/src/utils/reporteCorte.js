// Reporte por corte: los ingresos y/o gastos de uno o varios cortes de un periodo (faena).
// Los ingresos siempre llevan las mismas columnas: fecha, horas, descripción, horómetro inicio y fin, total.
import jsPDF from 'jspdf';
import { fmt, fmtNum, GRIS, cabecera, cajaResumen, seccion, tabla, pie } from './pdfObra';
import { enRango, ordenarCortes, nombreCorte, fmtHoras } from './cortes';
import { fmtHoro } from './horometro';
import { fmtFecha } from './fmtFecha';

const dia = (f) => String(f || '').slice(0, 10);
const porFecha = (a, b) => dia(a.fecha).localeCompare(dia(b.fecha)) || Number(a.id) - Number(b.id);
const sumar = (l, k) => l.reduce((a, x) => a + (Number(x[k]) || 0), 0);
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'reporte';

export const COLS_INGRESO = ['Fecha', 'Horas', 'Descripción', 'Horómetro inicio', 'Horómetro fin', 'Total'];
export const COLS_GASTO = ['Fecha', 'Descripción', 'Categoría', 'Monto'];

export const horasDeIngresos = (l) => l.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0);

// Lo que se ve en la columna Horas: las horas, o la cantidad con su unidad si el trabajo no fue por horas
const celdaHoras = (i) => (i.tipoTrabajo === 'Horas' ? `${fmtHoras(i.cantidad)} h` : `${fmtNum(i.cantidad)} ${i.tipoTrabajo || ''}`.trim());

export const filaIngreso = (i) => [
    dia(i.fecha) || '—',
    celdaHoras(i),
    i.descripcion || '—',
    i.tipoTrabajo === 'Horas' && i.horometroInicio != null ? fmtHoro(i.horometroInicio) : '',
    i.tipoTrabajo === 'Horas' && i.horometroFin != null ? fmtHoro(i.horometroFin) : '',
    fmt(i.total),
];
export const filaGasto = (g) => [dia(g.fecha) || '—', g.descripcion || '—', g.categoria || '—', fmt(g.monto)];

// Los cortes de un periodo, en orden, con sus ingresos y gastos. Lo que no cae en ningún corte
// va aparte: «En curso» (o «Sin cortar» si el periodo ya cerró) y «Antes del primer corte».
export function gruposDeCortes(faena, cortes, ingresos, gastos) {
    if (!faena) return [];
    const mismo = (x) => String(x.faenaId) === String(faena.id);
    const ing = ingresos.filter(mismo);
    const gas = gastos.filter(mismo);
    const cs = ordenarCortes(cortes.filter(c => String(c.faenaId) === String(faena.id)));
    const activa = faena.estado === 'activa';
    const enAlgun = (x) => cs.some(c => enRango(x.fecha, c.fechaInicio, c.fechaFin));
    const grupo = (id, nombre, fechas, i, g) => {
        const ordI = [...i].sort(porFecha); const ordG = [...g].sort(porFecha);
        return { id, nombre, fechas, ingresos: ordI, gastos: ordG, horas: horasDeIngresos(ordI), totalIng: sumar(ordI, 'total'), totalGas: sumar(ordG, 'monto') };
    };

    const out = [];
    const primero = cs[0] ? dia(cs[0].fechaInicio) : '';
    const antesI = ing.filter(x => !enAlgun(x) && primero && dia(x.fecha) < primero);
    const antesG = gas.filter(x => !enAlgun(x) && primero && dia(x.fecha) < primero);
    if (antesI.length || antesG.length) out.push(grupo('antes', 'Antes del primer corte', `antes del ${fmtFecha(primero)}`, antesI, antesG));

    cs.forEach((c, k) => {
        out.push(grupo(`c${c.id}`, nombreCorte(c, k + 1), `${fmtFecha(c.fechaInicio)} a ${fmtFecha(c.fechaFin)}`,
            ing.filter(x => enRango(x.fecha, c.fechaInicio, c.fechaFin)), gas.filter(x => enRango(x.fecha, c.fechaInicio, c.fechaFin))));
    });

    const restoI = ing.filter(x => !enAlgun(x) && !antesI.includes(x));
    const restoG = gas.filter(x => !enAlgun(x) && !antesG.includes(x));
    if (restoI.length || restoG.length) {
        out.push(grupo('curso', activa ? 'En curso' : 'Sin cortar', activa ? 'desde el último corte hasta hoy' : 'después del último corte', restoI, restoG));
    }
    return out;
}

// datos: { maquina, faena, grupos (los elegidos), incluir: 'ing' | 'gas' | 'amb' }
export async function pdfReporteCorte({ maquina, faena, grupos, incluir }) {
    const verIng = incluir !== 'gas';
    const verGas = incluir !== 'ing';
    const doc = new jsPDF();
    const totIng = sumar(grupos, 'totalIng');
    const totGas = sumar(grupos, 'totalGas');
    const totHoras = sumar(grupos, 'horas');
    const etiqueta = incluir === 'ing' ? 'Ingresos' : incluir === 'gas' ? 'Gastos' : 'Ingresos y gastos';

    let y = cabecera(doc, 'Reporte por corte', `${maquina}  ·  ${faena.nombreObra || 'Periodo'}  ·  ${etiqueta}`);
    y = cajaResumen(doc, y, [
        { label: grupos.length === 1 ? 'Corte' : 'Cortes', valor: grupos.length === 1 ? grupos[0].nombre : String(grupos.length), tipo: 'neu' },
        ...(verIng ? [{ label: 'Horas', valor: `${fmtHoras(totHoras)} h`, tipo: 'neu' }] : []),
        ...(verIng ? [{ label: 'Ingresos', valor: fmt(totIng), tipo: 'ing', _raw: totIng }] : []),
        ...(verGas ? [{ label: 'Gastos', valor: fmt(totGas), tipo: 'gas', _raw: totGas }] : []),
        ...(verIng && verGas ? [{ label: 'Utilidad', valor: fmt(totIng - totGas), tipo: 'util', _raw: totIng - totGas }] : []),
    ]);

    const estiloIng = { 0: { cellWidth: 22 }, 1: { halign: 'right', cellWidth: 20 }, 3: { halign: 'right', cellWidth: 25 }, 4: { halign: 'right', cellWidth: 25 }, 5: { halign: 'right', cellWidth: 30 } };
    const sinDatos = (texto) => { doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text(texto, 17, y + 4); y += 10; };

    grupos.forEach(g => {
        y = seccion(doc, y, `${g.nombre} · ${g.fechas}`);
        if (verIng) {
            if (g.ingresos.length) {
                y = tabla(doc, y, COLS_INGRESO, g.ingresos.map(filaIngreso), estiloIng,
                    { greenCols: [5], totalRow: ['', `${fmtHoras(g.horas)} h`, 'SUBTOTAL INGRESOS', '', '', fmt(g.totalIng)] });
            } else sinDatos('Sin ingresos en este corte');
        }
        if (verGas) {
            if (g.gastos.length) {
                y = tabla(doc, y, COLS_GASTO, g.gastos.map(filaGasto), { 3: { halign: 'right', cellWidth: 30 } },
                    { redCols: [3], totalRow: ['', '', 'SUBTOTAL GASTOS', fmt(g.totalGas)] });
            } else sinDatos('Sin gastos en este corte');
        }
    });

    // Varios cortes: una tabla final con lo de cada uno y el total
    if (grupos.length > 1) {
        y = seccion(doc, y, 'Resumen de los cortes');
        const head = ['Corte', ...(verIng ? ['Horas', 'Ingresos'] : []), ...(verGas ? ['Gastos'] : []), ...(verIng && verGas ? ['Utilidad'] : [])];
        const fila = (nombre, h, i, g) => [nombre, ...(verIng ? [`${fmtHoras(h)} h`, fmt(i)] : []), ...(verGas ? [fmt(g)] : []), ...(verIng && verGas ? [fmt(i - g)] : [])];
        const estilos = {}; head.forEach((_, k) => { if (k > 0) estilos[k] = { halign: 'right' }; });
        tabla(doc, y, head, grupos.map(g => fila(g.nombre, g.horas, g.totalIng, g.totalGas)), estilos,
            { totalRow: fila('TOTAL', totHoras, totIng, totGas) });
    }

    pie(doc, `Reporte por corte — ${maquina}`);
    doc.save(`reporte-corte-${slug(maquina)}-${slug(faena.nombreObra)}.pdf`);
}

// Acta de horas de un corte: por cada día trabajado, las horas y el horómetro de inicio y fin, con espacio para firmas.
// grupo es uno de los que devuelve gruposDeCortes.
export async function pdfActaHoras({ maquina, faena, grupo }) {
    const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const porDia = {};
    grupo.ingresos.filter(i => i.tipoTrabajo === 'Horas').forEach(i => {
        const k = dia(i.fecha);
        const d = porDia[k] = porDia[k] || { horas: 0, ini: null, fin: null, desc: [] };
        d.horas += Number(i.cantidad) || 0;
        if (i.horometroInicio != null) d.ini = d.ini == null ? Number(i.horometroInicio) : Math.min(d.ini, Number(i.horometroInicio));
        if (i.horometroFin != null) d.fin = d.fin == null ? Number(i.horometroFin) : Math.max(d.fin, Number(i.horometroFin));
        const t = String(i.descripcion || '').trim();
        if (t && !d.desc.includes(t)) d.desc.push(t);
    });
    const fechas = Object.keys(porDia).sort();
    const totHoras = fechas.reduce((a, k) => a + porDia[k].horas, 0);
    const inicios = fechas.map(k => porDia[k].ini).filter(v => v != null);
    const fines = fechas.map(k => porDia[k].fin).filter(v => v != null);
    const horoIni = inicios.length ? Math.min(...inicios) : null;
    const horoFin = fines.length ? Math.max(...fines) : null;

    const doc = new jsPDF();
    let y = cabecera(doc, 'Acta de horas', `${maquina}  ·  ${faena.nombreObra || 'Periodo'}  ·  ${grupo.nombre} (${grupo.fechas})`);
    y = cajaResumen(doc, y, [
        { label: 'Corte', valor: grupo.nombre, tipo: 'neu' },
        { label: 'Días trabajados', valor: String(fechas.length), tipo: 'neu' },
        { label: 'Horas totales', valor: `${fmtHoras(totHoras)} h`, tipo: 'neu' },
        { label: 'Promedio por día', valor: fechas.length ? `${fmtHoras(totHoras / fechas.length)} h` : '—', tipo: 'neu' },
    ]);

    y = seccion(doc, y, `Horas por día · ${grupo.fechas}`);
    if (fechas.length) {
        const fila = (k) => {
            const d = porDia[k];
            const [a, m, di] = k.split('-').map(Number);
            const sem = DIAS[new Date(a, m - 1, di).getDay()];
            return [`${k} (${sem})`, `${fmtHoras(d.horas)} h`, d.ini != null ? fmtHoro(d.ini) : '', d.fin != null ? fmtHoro(d.fin) : '', d.desc.join(' · ').slice(0, 70) || '—'];
        };
        y = tabla(doc, y, ['Fecha', 'Horas', 'Horómetro inicio', 'Horómetro fin', 'Actividad'], fechas.map(fila),
            { 1: { halign: 'right', cellWidth: 22 }, 2: { halign: 'right', cellWidth: 30 }, 3: { halign: 'right', cellWidth: 30 } },
            { totalRow: ['TOTAL DEL CORTE', `${fmtHoras(totHoras)} h`, horoIni != null ? fmtHoro(horoIni) : '', horoFin != null ? fmtHoro(horoFin) : '', `${fechas.length} día${fechas.length === 1 ? '' : 's'}`] });
    } else {
        doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text('Este corte no tiene horas registradas.', 17, y + 4); y += 12;
    }

    // Firmas
    if (y > 232) { doc.addPage(); y = 30; }
    y += 10;
    doc.setFontSize(8); doc.setTextColor(...GRIS);
    doc.text('Certificamos que las horas y los horómetros de esta acta corresponden al trabajo realizado en el corte indicado.', 14, y);
    y += 26;
    doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.3);
    doc.line(20, y, 90, y); doc.line(120, y, 190, y);
    doc.setFontSize(8); doc.setTextColor(30, 30, 30);
    doc.text('Operador', 55, y + 5, { align: 'center' });
    doc.text(faena.cliente ? `Interventoría · ${faena.cliente}` : 'Interventoría / Cliente', 155, y + 5, { align: 'center' });
    doc.setTextColor(...GRIS);
    doc.text('Nombre y C.C.', 55, y + 9.5, { align: 'center' });
    doc.text('Nombre y C.C.', 155, y + 9.5, { align: 'center' });

    pie(doc, `Acta de horas — ${maquina}`);
    doc.save(`acta-horas-${slug(maquina)}-${slug(grupo.nombre)}.pdf`);
}
