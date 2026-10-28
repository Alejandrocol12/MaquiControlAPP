import { hoyISO } from './cortes';

// Racha de turnos de un operador a partir de TODAS sus horas (no solo las del periodo actual):
// los días seguidos que trabajó hasta hoy. Si hoy todavía no registra horas pero ayer sí, la racha sigue viva.
const dia = (f) => String(f || '').slice(0, 10);
const aFecha = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const aISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
export const sumarDias = (iso, n) => { const dt = aFecha(iso); dt.setDate(dt.getDate() + n); return aISO(dt); };
const entre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);

export const DIAS_SIN_DESCANSO = 10; // desde aquí se avisa que lleva muchos turnos sin parar

export function calcularRacha(horas, { dias = 14, hoy = hoyISO() } = {}) {
    const porDia = {};
    (horas || []).forEach(h => {
        const f = dia(h.fecha);
        const v = parseFloat(h.horas) || 0;
        if (f && v > 0) porDia[f] = (porDia[f] || 0) + v;
    });
    const fechas = Object.keys(porDia).sort();
    const ultimo = fechas[fechas.length - 1] || null;

    // la racha actual cuenta hacia atrás desde el último día trabajado, si fue hoy o ayer
    let actual = 0;
    if (ultimo && entre(ultimo, hoy) <= 1) {
        actual = 1;
        for (let i = fechas.length - 1; i > 0; i--) {
            if (entre(fechas[i - 1], fechas[i]) === 1) actual++; else break;
        }
    }

    // la mejor racha de todo el historial
    let mejor = 0, corrida = 0;
    fechas.forEach((f, i) => {
        corrida = i > 0 && entre(fechas[i - 1], f) === 1 ? corrida + 1 : 1;
        if (corrida > mejor) mejor = corrida;
    });

    const tira = [];
    for (let k = dias - 1; k >= 0; k--) {
        const f = sumarDias(hoy, -k);
        tira.push({ fecha: f, horas: porDia[f] || 0, hoy: k === 0 });
    }

    return {
        actual, mejor, ultimo, hoyTrabajado: !!porDia[hoy], horasHoy: porDia[hoy] || 0,
        diasDesdeUltimo: ultimo ? entre(ultimo, hoy) : null, totalDias: fechas.length, tira,
        sinDescanso: actual >= DIAS_SIN_DESCANSO,
    };
}
