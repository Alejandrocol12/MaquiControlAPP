import { esSueldoOperador } from './nomina';

// Cuentas de los cortes, compartidas entre Periodos (corte con el cliente) y Operadores
// (corte con el operador). Todas las fechas son texto 'YYYY-MM-DD', que se compara bien
// como texto sin pasar por Date (y sin líos de zona horaria).

export const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const soloFecha = (f) => (f ? String(f).slice(0, 10) : '');

export const diaSiguiente = (iso) => {
    const [y, m, d] = soloFecha(iso).split('-').map(Number);
    const dt = new Date(y, m - 1, d + 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export const enRango = (fecha, desde, hasta) => {
    const f = soloFecha(fecha);
    return !!f && (!desde || f >= soloFecha(desde)) && (!hasta || f <= soloFecha(hasta));
};

export const ordenarCortes = (cortes) =>
    [...cortes].sort((a, b) => soloFecha(a.fechaInicio).localeCompare(soloFecha(b.fechaInicio)));

// Horas y plata a cobrar de un tramo, a partir de los trabajos (ingresos) del periodo.
export const resumenTramo = (ingresos, desde, hasta) => {
    const delTramo = ingresos.filter(i => enRango(i.fecha, desde, hasta));
    return {
        horas: delTramo.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0),
        total: delTramo.reduce((a, i) => a + (Number(i.total) || 0), 0),
        registros: delTramo.length,
    };
};

// Horas del operador y lo que se ganó en un tramo, a partir de sus horas trabajadas.
export const resumenOperador = (horas, desde, hasta) => {
    const delTramo = horas.filter(h => enRango(h.fecha, desde, hasta));
    return {
        horas: delTramo.reduce((a, h) => a + (Number(h.horas) || 0), 0),
        ganado: delTramo.reduce((a, h) => a + (Number(h.horas) || 0) * (Number(h.valorHora) || 0), 0),
    };
};

// ¿Algún trabajo del periodo quedó por fuera de todos los cortes, antes del último corte?
export const sinCortarAntesDe = (ingresos, cortes, limite) => {
    const sueltos = ingresos.filter(i => soloFecha(i.fecha) && soloFecha(i.fecha) <= soloFecha(limite)
        && !cortes.some(c => enRango(i.fecha, c.fechaInicio, c.fechaFin)));
    return {
        horas: sueltos.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0),
        total: sueltos.reduce((a, i) => a + (Number(i.total) || 0), 0),
        registros: sueltos.length,
    };
};

// Reparte lo pagado entre los tramos empezando por el más viejo: cada tramo se llena hasta
// lo que se ganó y lo que sobra pasa al siguiente. Devuelve los tramos con { pagado, debe }
// y, si se pagó más de lo ganado en total, cuánto quedó a favor.
export const repartirPagos = (tramos, totalPagado) => {
    let resto = Math.max(0, Number(totalPagado) || 0);
    const filas = tramos.map(t => {
        const ganado = Number(t.ganado) || 0;
        const pagado = Math.min(ganado, resto);
        resto -= pagado;
        return { ...t, pagado, debe: ganado - pagado };
    });
    return { filas, aFavor: resto };
};

// Nombre del corte: el que le puso el admin o, si no tiene, "Corte N" según su orden
export const nombreCorte = (c, n) => (c && c.nombre && String(c.nombre).trim()) || `Corte ${n}`;

export const fmtHoras = (n) => String(Math.round((Number(n) || 0) * 10) / 10).replace('.', ',');

// ── Gastos por corte ───────────────────────────────────────────────
// Los gastos de un corte son los de la máquina en esas fechas. El pago al operador cuenta como
// gasto salvo que se apague (por ejemplo si el operador no cobra). Esta preferencia se recuerda.
const CLAVE_OPERADOR = 'mc_cortes_gasto_operador';
export const leerContarOperador = () => { try { return localStorage.getItem(CLAVE_OPERADOR) !== '0'; } catch { return true; } };
export const guardarContarOperador = (v) => { try { localStorage.setItem(CLAVE_OPERADOR, v ? '1' : '0'); } catch { /* sin almacenamiento */ } };

const montoDe = (g) => Number(g.monto) || 0;

export const resumenGastosTramo = (gastos, desde, hasta, contarOperador = true) => {
    const lista = gastos
        .filter(g => enRango(g.fecha, desde, hasta) && (contarOperador || !esSueldoOperador(g)))
        .sort((a, b) => soloFecha(a.fecha).localeCompare(soloFecha(b.fecha)));
    const cats = {};
    lista.forEach(g => { const k = g.categoria || 'Sin categoría'; cats[k] = (cats[k] || 0) + montoDe(g); });
    return {
        total: lista.reduce((a, g) => a + montoDe(g), 0),
        n: lista.length,
        lista,
        categorias: Object.entries(cats).sort((a, b) => b[1] - a[1]),
    };
};

// Gastos que quedaron por fuera de todos los cortes, en fechas anteriores al último corte
export const gastosSinCortarAntesDe = (gastos, cortes, limite, contarOperador = true) => {
    const sueltos = gastos.filter(g => soloFecha(g.fecha) && soloFecha(g.fecha) <= soloFecha(limite)
        && (contarOperador || !esSueldoOperador(g))
        && !cortes.some(c => enRango(g.fecha, c.fechaInicio, c.fechaFin)));
    return { n: sueltos.length, total: sueltos.reduce((a, g) => a + montoDe(g), 0) };
};
