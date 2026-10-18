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
