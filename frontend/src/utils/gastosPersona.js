// Gastos por persona: quién pagó cada gasto. Filtros, agrupación y PDF (diseño Obra).
import jsPDF from 'jspdf';
import {
    fmt,
    cabecera, cajaResumen, seccion, tabla, pie,
} from './pdfObra';

export const SIN_ASIGNAR = 'Sin asignar';
export const quienPago = (g) => (g.pagadoPor && String(g.pagadoPor).trim()) || SIN_ASIGNAR;

const dia = (f) => (f ? String(f).slice(0, 10) : '');

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

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SIN_MAQUINA = 'Sin máquina';
const colsMaquina = ['Fecha', 'Descripción', 'Categoría', 'Monto'];
const filasMaquina = (L) => L.map(g => [dia(g.fecha) || '—', g.descripcion || '—', g.categoria || '—', fmt(g.monto)]);

// Los gastos de una persona separados por máquina (en orden alfabético; «Sin máquina» al final)
export const porMaquina = (L) => agruparPor(L, g => g.maquinaNombre || SIN_MAQUINA)
    .sort((a, b) => (a.clave === SIN_MAQUINA) - (b.clave === SIN_MAQUINA) || a.clave.localeCompare(b.clave));

// Cada máquina va en su propia hoja, con su resumen y su subtotal. Devuelve la y donde terminó.
function paginasPersona(doc, grupo, o, primera) {
    const maqs = porMaquina(grupo.gastos);
    const titulo = grupo.clave === SIN_ASIGNAR ? 'Gastos sin asignar' : `Gastos de ${grupo.clave}`;
    let y = 0;
    maqs.forEach((m, i) => {
        if (!primera || i > 0) doc.addPage();
        y = cabecera(doc, titulo, subtitulo(o));
        y = cajaResumen(doc, y, [
            { label: 'Máquina', valor: m.clave, tipo: 'neu' },
            { label: 'Subtotal máquina', valor: fmt(m.total), tipo: 'gas', _raw: m.total },
            { label: 'Registros', valor: String(m.n), tipo: 'neu' },
            { label: 'Promedio', valor: fmt(Math.round(m.total / Math.max(m.n, 1))), tipo: 'neu' },
        ]);
        y = seccion(doc, y, `Máquina ${LETRAS[i % 26]} · ${m.clave} · ${m.n} gasto${m.n === 1 ? '' : 's'}`);
        y = tabla(doc, y, colsMaquina, filasMaquina(m.gastos), { 3: { halign: 'right' } },
            { redCols: [3], totalRow: ['', '', `SUBTOTAL ${m.clave}`, fmt(m.total)] });
        if (i === maqs.length - 1 && maqs.length > 1) {
            y = tabla(doc, y, ['Concepto', 'Monto'], [[`TOTAL DE ${grupo.clave} (${maqs.length} máquinas)`, fmt(grupo.total)]], { 1: { halign: 'right' } }, { orangeCols: [1] });
        }
    });
    return y;
}

// opciones: { desde, hasta, maquina, categoria, persona }  (persona vacía = todas)
export async function pdfGastosPersona(L, o) {
    const grupos = agruparPor(L, quienPago);
    const total = totalDe(L);
    const doc = new jsPDF();

    let y = 0;
    grupos.forEach((gr, idx) => { y = paginasPersona(doc, gr, o, idx === 0); });
    if (grupos.length > 1) {
        tabla(doc, y, ['Concepto', 'Monto'], [['TOTAL DE TODAS LAS PERSONAS', fmt(total)]], { 1: { halign: 'right' } }, { orangeCols: [1] });
    }

    if (grupos.length === 1) {
        pie(doc, `Gastos de ${grupos[0].clave}`);
        doc.save(`gastos-${slug(grupos[0].clave)}-${o.desde || 'inicio'}-${o.hasta || 'hoy'}.pdf`);
    } else {
        pie(doc, 'Gastos por persona');
        doc.save(`gastos-por-persona-${o.desde || 'inicio'}-${o.hasta || 'hoy'}.pdf`);
    }
}
