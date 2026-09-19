const diasEnMes = (y, m) => new Date(y, m + 1, 0).getDate();
const clampDia = (y, m, d) => Math.min(d, diasEnMes(y, m));

// Dada una máquina con "día de corte" fijo (ej: 24), devuelve la ventana de
// fechas [inicio, fin) que está corriendo hoy. Si hoy cae justo en el día de
// corte, devuelve la ventana que se está cerrando (no la que apenas empieza) —
// así el corte del día muestra lo acumulado, no cero.
export function ventanaCorte(diaCorte, hoyConHora = new Date()) {
    // Se compara solo por fecha (sin hora) — si no, "inicio >= hoy" casi nunca
    // se cumple en el día de corte, porque "inicio" queda en medianoche y
    // "hoy" ya trae la hora actual.
    const hoy = new Date(hoyConHora.getFullYear(), hoyConHora.getMonth(), hoyConHora.getDate());
    let y = hoy.getFullYear(), m = hoy.getMonth();
    let inicio = new Date(y, m, clampDia(y, m, diaCorte));
    if (inicio >= hoy) {
        m -= 1;
        if (m < 0) { m = 11; y -= 1; }
        inicio = new Date(y, m, clampDia(y, m, diaCorte));
    }
    let fy = inicio.getFullYear(), fm = inicio.getMonth() + 1;
    if (fm > 11) { fm = 0; fy += 1; }
    const fin = new Date(fy, fm, clampDia(fy, fm, diaCorte));
    return { inicio, fin };
}

export const enVentanaCorte = (fechaStr, inicio, fin) => {
    if (!fechaStr) return false;
    const f = new Date(fechaStr + 'T00:00:00');
    return f >= inicio && f < fin;
};

export const diasHastaCierre = (fin, hoy = new Date()) =>
    Math.ceil((fin - hoy) / 86400000);
