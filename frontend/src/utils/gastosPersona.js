// Gastos por persona: quién pagó cada gasto. Filtros, agrupación y PDF (diseño Obra).
import jsPDF from 'jspdf';
import {
    fmt, VERDE, ROJO, AZULC,
    cabecera, cajaResumen, barChart, seccion, tabla, pie,
} from './pdfObra';

export const SIN_ASIGNAR = 'Sin asignar';
export const quienPago = (g) => (g.pagadoPor && String(g.pagadoPor).trim()) || SIN_ASIGNAR;

const dia = (f) => (f ? String(f).slice(0, 10) : '');
const PALETA = [[36, 113, 163], [142, 68, 173], VERDE, [217, 115, 26], [92, 112, 134], ROJO];
export const colorDe = (i) => PALETA[i % PALETA.length];

// personas: lista de nombres elegidos; vacía = todas
export function filtrarGastos(gastos, { desde, hasta, maquina, categoria, personas = [] }) {
    return gastos
        .filter(g => {
            const f = dia(g.fecha);
            return (!desde || f >= desde) && (!hasta || f <= hasta)
                && (!maquina || g.maquinaNombre === maquina)
                && (!categoria || g.categoria === categoria)
                && (!personas.length || personas.includes(quienPago(g)));
        })
        .sort((a, b) => dia(b.fecha).localeCompare(dia(a.fecha)));
}

export function agruparPor(lista, clave) {
    const mp = {};
    lista.forEach(g => {
        const k = clave(g);
        (mp[k] = mp[k] || { clave: k, n: 0, total: 0, gastos: [] });
        mp[k].n++; mp[k].total += Number(g.monto) || 0; mp[k].gastos.push(g);
    });
    return Object.values(mp).sort((a, b) => b.total - a.total);
}

export const totalDe = (lista) => lista.reduce((a, g) => a + (Number(g.monto) || 0), 0);

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'persona';

const rangoTxt = ({ desde, hasta }) => {
    const d = desde && desde > '2001-01-01' ? desde : 'Inicio';
    return `${d} a ${hasta || 'hoy'}`;
};
const subtitulo = (o) => [rangoTxt(o), o.maquina || 'Todas las máquinas', o.categoria || null].filter(Boolean).join('  ·  ');

const colsDetalle = ['Fecha', 'Descripción', 'Máquina', 'Categoría', 'Monto'];
const filasDetalle = (L) => L.map(g => [dia(g.fecha) || '—', g.descripcion || '—', g.maquinaNombre || '—', g.categoria || '—', fmt(g.monto)]);

// Barras por categoría de una persona (las seis mayores y el resto junto)
const barrasCategoria = (L) => {
    const cats = agruparPor(L, g => g.categoria || 'Sin categoría');
    const top = cats.slice(0, 6).map((c, i) => ({ label: c.clave, valor: c.total, color: colorDe(i) }));
    const resto = cats.slice(6).reduce((a, c) => a + c.total, 0);
    if (resto > 0) top.push({ label: 'Otras', valor: resto, color: AZULC });
    return top;
};

function paginaPersona(doc, grupo, totalGeneral, o) {
    let y = cabecera(doc, grupo.clave === SIN_ASIGNAR ? 'Gastos sin asignar' : `Gastos de ${grupo.clave}`, subtitulo(o));
    y = cajaResumen(doc, y, [
        { label: 'Total gastos', valor: fmt(grupo.total), tipo: 'gas', _raw: grupo.total },
        { label: 'Registros', valor: String(grupo.n), tipo: 'neu' },
        { label: 'Del total', valor: totalGeneral ? `${Math.round(grupo.total / totalGeneral * 100)}%` : '—', tipo: 'util', _raw: 1 },
        { label: 'Promedio', valor: fmt(Math.round(grupo.total / Math.max(grupo.n, 1))), tipo: 'neu' },
    ]);
    y = barChart(doc, y, barrasCategoria(grupo.gastos), 'Gastos por categoría');
    y = seccion(doc, y, `Detalle (${grupo.n} gastos)`);
    tabla(doc, y, colsDetalle, filasDetalle(grupo.gastos), { 4: { halign: 'right' } },
        { redCols: [4], totalRow: ['', '', '', 'TOTAL', fmt(grupo.total)] });
}

// opciones: { modo: 'junto'|'sep', salida: 'uno'|'varios', desde, hasta, maquina, categoria, personas }
export async function pdfGastosPersona(L, o) {
    const grupos = agruparPor(L, quienPago);
    const total = totalDe(L);

    if (o.modo === 'sep') {
        if (o.salida === 'varios') {
            for (const gr of grupos) {
                const doc = new jsPDF();
                paginaPersona(doc, gr, total, o);
                pie(doc, `Gastos de ${gr.clave}`);
                doc.save(`gastos-${slug(gr.clave)}-${o.desde || 'inicio'}-${o.hasta || 'hoy'}.pdf`);
                await new Promise(r => setTimeout(r, 350));
            }
            return grupos.length;
        }
        const doc = new jsPDF();
        grupos.forEach((gr, i) => {
            if (i > 0) doc.addPage();
            paginaPersona(doc, gr, total, o);
        });
        pie(doc, 'Gastos por persona');
        doc.save(`gastos-por-persona-${o.desde || 'inicio'}-${o.hasta || 'hoy'}.pdf`);
        return 1;
    }

    // Todas juntas: resumen y luego el detalle de cada persona con su subtotal
    const doc = new jsPDF();
    let y = cabecera(doc, 'Gastos por persona', subtitulo(o));
    y = cajaResumen(doc, y, [
        { label: 'Total gastos', valor: fmt(total), tipo: 'gas', _raw: total },
        { label: 'Registros', valor: String(L.length), tipo: 'neu' },
        { label: 'Personas', valor: String(grupos.length), tipo: 'util', _raw: 1 },
        { label: 'Promedio', valor: fmt(Math.round(total / Math.max(L.length, 1))), tipo: 'neu' },
    ]);
    y = barChart(doc, y, grupos.slice(0, 8).map((g, i) => ({ label: g.clave, valor: g.total, color: colorDe(i) })), 'Quién pagó cuánto');
    grupos.forEach(gr => {
        y = seccion(doc, y, `${gr.clave} · ${gr.n} gasto${gr.n === 1 ? '' : 's'}`);
        y = tabla(doc, y, colsDetalle, filasDetalle(gr.gastos), { 4: { halign: 'right' } },
            { redCols: [4], totalRow: ['', '', '', 'SUBTOTAL', fmt(gr.total)] });
    });
    // total general al final
    tabla(doc, y, ['Concepto', 'Monto'], [['TOTAL DE LAS PERSONAS ELEGIDAS', fmt(total)]], { 1: { halign: 'right' } }, { orangeCols: [1] });
    pie(doc, 'Gastos por persona');
    doc.save(`gastos-por-persona-${o.desde || 'inicio'}-${o.hasta || 'hoy'}.pdf`);
    return 1;
}
