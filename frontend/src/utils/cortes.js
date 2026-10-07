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

export const fmtHoras = (n) => String(Math.round((Number(n) || 0) * 10) / 10).replace('.', ',');
