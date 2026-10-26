import { enRango, ordenarCortes, nombreCorte } from './cortes';

const dia10 = (f) => String(f || '').slice(0, 10);
const n = (v) => Number(v) || 0;

// Cuenta de un operador: lo que ganó en cada corte, lo que se le ha pagado y lo que falta.
// Los pagos con "corte imputado" llenan primero ese corte; el resto se reparte desde el corte más viejo,
// como en la ficha del operador. Devuelve las filas del historial (un pago por fila y los cortes sin pagos).
export function cuentaOperador({ nombre, maquinas = [], horas = [], cortes = [], pagosOp = [], faenas = [] }) {
    const hs = horas.filter(h => h.operadorNombre === nombre);
    const maqs = new Set([...maquinas.filter(m => m.operadorNombre === nombre).map(m => m.nombre), ...hs.map(h => h.maquinaNombre)].filter(Boolean));

    // "Corte N" dentro de su periodo, contando todos los cortes del periodo
    const nombres = {};
    const porFaena = {};
    cortes.forEach(c => { (porFaena[c.faenaId] = porFaena[c.faenaId] || []).push(c); });
    Object.values(porFaena).forEach(l => ordenarCortes(l).forEach((c, i) => { nombres[c.id] = nombreCorte(c, i + 1); }));

    // Todos los cortes de sus máquinas: la casilla "con operador" solo decide si el corte crea el gasto, y los cortes anteriores a esa casilla quedaron marcados como "sin operador"
    const propios = ordenarCortes(cortes.filter(c => maqs.has(c.maquinaNombre)));
    const gana = (lista) => lista.reduce((a, h) => a + n(h.horas) * n(h.valorHora), 0);
    const tramos = propios.map(c => {
        const delTramo = hs.filter(h => h.maquinaNombre === c.maquinaNombre && enRango(h.fecha, c.fechaInicio, c.fechaFin));
        const ganado = gana(delTramo);
        return { id: c.id, nombre: nombres[c.id] || 'Corte', faenaId: c.faenaId, fecha: dia10(c.fechaFin), inicio: dia10(c.fechaInicio), horas: delTramo.reduce((a, h) => a + n(h.horas), 0), ganado, pagado: 0, debe: ganado };
    });
    // lo trabajado antes del primer corte también es trabajo ya hecho: los pagos lo cubren primero
    if (tramos.length) {
        const antes = hs.filter(h => dia10(h.fecha) < tramos[0].inicio);
        const g = gana(antes);
        if (g > 0.5) tramos.unshift({ id: 'antes', nombre: 'Antes del primer corte', faenaId: null, fecha: tramos[0].inicio, inicio: '', horas: antes.reduce((a, h) => a + n(h.horas), 0), ganado: g, pagado: 0, debe: g });
    }
    const ultimoFin = tramos.length ? tramos[tramos.length - 1].fecha : '';
    const curso = hs.filter(h => !ultimoFin || dia10(h.fecha) > ultimoFin);
    const enCurso = { horas: curso.reduce((a, h) => a + n(h.horas), 0), ganado: gana(curso) };

    // Reparto de los pagos
    const pagos = pagosOp.filter(p => p.operadorNombre === nombre)
        .sort((a, b) => dia10(a.fecha).localeCompare(dia10(b.fecha)) || n(a.id) - n(b.id))
        .map(p => ({ p, resto: n(p.monto), imp: null }));
    pagos.forEach(x => {
        if (x.p.corteId == null) return;
        const t = tramos.find(t2 => String(t2.id) === String(x.p.corteId));
        if (!t) return;
        const a = Math.min(Math.max(0, t.debe), x.resto);
        t.debe -= a; t.pagado += a; x.resto -= a; x.imp = t;
    });
    pagos.forEach(x => {
        for (const t of tramos) {
            if (x.resto <= 0.5) break;
            if (t.debe <= 0.5) continue;
            const a = Math.min(t.debe, x.resto);
            t.debe -= a; t.pagado += a; x.resto -= a;
            if (!x.imp) x.imp = t;
        }
    });

    const faenaPorFecha = (fecha) => {
        const d = dia10(fecha);
        const f = faenas.find(x => maqs.has(x.maquinaNombre) && x.tipo !== 'gastos' && d >= dia10(x.fechaInicio) && (!x.fechaFin || x.estado === 'activa' || d <= dia10(x.fechaFin)));
        return f ? f.id : null;
    };
    const filas = [];
    pagos.forEach(({ p, imp }) => {
        filas.push({
            key: 'p' + p.id, tipo: 'pago', id: p.id, fecha: p.fecha, operador: nombre, imputado: imp ? imp.nombre : null,
            metodo: p.metodoPago || '', comprobante: p.comprobante || '', desc: p.descripcion || '',
            total: imp ? imp.ganado : 0, pagado: n(p.monto), saldo: imp ? imp.debe : 0,
            estado: !imp ? 'Adelanto' : imp.debe <= 0.5 ? 'Pagado' : 'Parcial',
            faenaId: imp ? imp.faenaId : faenaPorFecha(p.fecha), raw: p,
        });
    });
    tramos.filter(t => t.pagado <= 0.5).forEach(t => {
        filas.push({
            key: 'c' + t.id, tipo: 'corte', id: t.id, fecha: t.fecha, operador: nombre, imputado: t.nombre, metodo: '', comprobante: '',
            desc: t.horas ? `${Math.round(t.horas * 10) / 10} h` : '', total: t.ganado, pagado: 0, saldo: t.debe,
            estado: 'Pendiente', faenaId: t.faenaId != null ? t.faenaId : faenaPorFecha(t.fecha), raw: null,
        });
    });

    return {
        nombre, tramos, filas, enCurso,
        pagado: pagos.reduce((a, x) => a + n(x.p.monto), 0),
        causado: tramos.reduce((a, t) => a + t.ganado, 0),
        pendiente: tramos.reduce((a, t) => a + Math.max(0, t.debe), 0),
    };
}
