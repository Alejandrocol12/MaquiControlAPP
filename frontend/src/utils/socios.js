// Socios y reparto de una máquina: reparte lo que dejó cada tramo (corte) entre los socios
// según su porcentaje, y cuadra quién le debe a quién según quién recibió la plata y quién
// pagó gastos de su bolsillo. Todo se calcula con los datos que ya hay en la app.
import { ordenarCortes, diaSiguiente } from './cortes';

const dia = (f) => (f ? String(f).slice(0, 10) : '');
const num = (v) => Number(v) || 0;

export const SOCIOS_VACIO = { socios: [], recibe: 0, entregas: [], pagoGasto: {} };

export const leerSocios = (json) => {
    try {
        const o = json ? JSON.parse(json) : null;
        if (!o || !Array.isArray(o.socios)) return { ...SOCIOS_VACIO };
        return {
            socios: o.socios.map(s => ({ n: String(s.n || 'Socio'), pct: num(s.pct) })),
            recibe: Number.isInteger(o.recibe) && o.recibe < o.socios.length ? o.recibe : 0,
            entregas: Array.isArray(o.entregas) ? o.entregas : [],
            pagoGasto: o.pagoGasto && typeof o.pagoGasto === 'object' ? o.pagoGasto : {},
        };
    } catch { return { ...SOCIOS_VACIO }; }
};

export const sumaPct = (socios) => Math.round(socios.reduce((a, s) => a + num(s.pct), 0) * 100) / 100;

// Divide los periodos de la máquina en tramos: un tramo por corte (que recoge todo lo que
// hubo desde el corte anterior) y, si queda algo después del último, un tramo "sin cortar".
// Un periodo sin cortes es un solo tramo.
export function armarTramos(faenas, cortes, ingresos, gastos) {
    const tramos = [];
    const orden = [...faenas].sort((a, b) => dia(a.fechaInicio).localeCompare(dia(b.fechaInicio)));
    orden.forEach(f => {
        const ing = ingresos.filter(i => String(i.faenaId) === String(f.id));
        const gas = gastos.filter(g => String(g.faenaId) === String(f.id));
        const cs = ordenarCortes(cortes.filter(c => String(c.faenaId) === String(f.id)));
        const crear = (clave, nombre, desde, hasta, curso) => {
            const en = (x) => { const d = dia(x.fecha); return (!desde || !d || d >= desde) && (!hasta || !d || d <= hasta); };
            const ingT = ing.filter(en), gasT = gas.filter(en);
            return {
                clave, faenaId: f.id, faena: f.nombreObra || 'Periodo', nombre, desde, hasta, curso,
                ingresos: ingT.reduce((a, i) => a + num(i.total), 0),
                horas: ingT.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + num(i.cantidad), 0),
                gastos: gasT.map(g => ({ id: g.id, f: dia(g.fecha), d: g.descripcion || g.categoria || 'Gasto', cat: g.categoria, m: num(g.monto) })),
                gastosTotal: gasT.reduce((a, g) => a + num(g.monto), 0),
            };
        };
        if (cs.length === 0) {
            tramos.push(crear(`${f.id}:todo`, f.estado === 'activa' ? 'En curso' : 'Periodo completo', dia(f.fechaInicio), f.estado === 'activa' ? null : dia(f.fechaFin), f.estado === 'activa'));
            return;
        }
        let prev = null;
        cs.forEach((c, i) => {
            tramos.push(crear(`${f.id}:${c.id}`, `Corte ${i + 1}`, prev ? diaSiguiente(prev) : null, dia(c.fechaFin), false));
            prev = dia(c.fechaFin);
        });
        const resto = crear(`${f.id}:resto`, f.estado === 'activa' ? 'En curso' : 'Sin cortar', diaSiguiente(prev), f.estado === 'activa' ? null : (dia(f.fechaFin) || null), f.estado === 'activa');
        if (resto.ingresos > 0 || resto.gastos.length > 0) tramos.push(resto);
    });
    return tramos.filter(t => t.ingresos > 0 || t.gastos.length > 0 || t.curso);
}

// Reparto de un tramo: utilidad = ingresos − gastos; a cada socio su porcentaje, más los
// gastos que pagó de su bolsillo (se le devuelven).
export function repartirTramo(t, cfg) {
    const util = t.ingresos - t.gastosTotal;
    const filas = cfg.socios.map((s, i) => {
        const parte = util * num(s.pct) / 100;
        const reem = t.gastos.filter(g => cfg.pagoGasto[g.id] === i).reduce((a, g) => a + g.m, 0);
        return { i, s, parte, reem, corr: parte + reem };
    });
    return { util, filas };
}

// Cuenta de todos los tramos juntos: lo que le corresponde a cada uno contra la plata del
// negocio que tiene en la mano (cobros que recibió − gastos pagados con esa plata ± entregas).
export function cuentaSocios(tramos, cfg, cobrado) {
    const reps = tramos.map(t => repartirTramo(t, cfg));
    const ingresos = tramos.reduce((a, t) => a + t.ingresos, 0);
    const gastos = tramos.reduce((a, t) => a + t.gastosTotal, 0);
    const gastosBolsillo = tramos.reduce((a, t) => a + t.gastos.filter(g => cfg.pagoGasto[g.id] !== undefined).reduce((x, g) => x + g.m, 0), 0);
    const filas = cfg.socios.map((s, i) => {
        const corr = reps.reduce((a, r) => a + r.filas[i].corr, 0);
        const parte = reps.reduce((a, r) => a + r.filas[i].parte, 0);
        const reem = reps.reduce((a, r) => a + r.filas[i].reem, 0);
        const cobros = i === cfg.recibe ? cobrado : 0;
        const gcaja = i === cfg.recibe ? gastos - gastosBolsillo : 0;
        let ent = 0;
        cfg.entregas.forEach(e => { if (e.a === i) ent += num(e.v); if (e.de === i) ent -= num(e.v); });
        const tiene = cobros - gcaja + ent;
        return { i, s, parte, reem, corr, cobros, gcaja, ent, tiene, saldo: tiene - corr };
    });
    // Quién le entrega a quién: el que tiene de más le da al que tiene de menos
    const pos = filas.filter(f => f.saldo > 1).map(f => ({ i: f.i, v: f.saldo }));
    const neg = filas.filter(f => f.saldo < -1).map(f => ({ i: f.i, v: -f.saldo }));
    const trans = [];
    let a = 0, b = 0;
    while (a < pos.length && b < neg.length) {
        const m = Math.min(pos[a].v, neg[b].v);
        trans.push({ de: pos[a].i, a: neg[b].i, v: m });
        pos[a].v -= m; neg[b].v -= m;
        if (pos[a].v < 1) a++;
        if (neg[b].v < 1) b++;
    }
    const pendiente = neg.slice(b).reduce((x, y) => x + y.v, 0);
    return { reps, filas, trans, ingresos, gastos, util: ingresos - gastos, porCobrar: Math.max(0, ingresos - cobrado), pendiente };
}
