import { useCallback, useEffect, useState } from 'react';
import {
    getMaquinas, getIngresos, getGastos, getFaenas, getPagos, getPagosOperador, getHoras,
    getOperadoresAPI, getMantenimientos, getNovedadesAPI, updateNovedadEstado,
} from '../api';
import { hoyISO } from './cortes';
import { fmtFecha } from './fmtFecha';

// Avisos de la campana. Se calculan siempre con todo el historial (no hace falta que algo "pase" para que
// aparezca): lo que ya estaba mal o pendiente antes de hoy también sale. Cuando se resuelve, desaparece solo.

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const dia = (f) => String(f || '').slice(0, 10);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const DIAS_SIN_PAGO = 20; // el mismo umbral con el que la ficha del operador marca «último pago» en alerta
const DIAS_SIN_HORAS = 3;
const DIAS_PERIODO_LARGO = 30;

const diasEntre = (desde, hasta) => {
    const [a, b, c] = dia(desde).split('-').map(Number);
    const [d, e, f] = dia(hasta).split('-').map(Number);
    return Math.round((new Date(d, e - 1, f) - new Date(a, b - 1, c)) / 86400000);
};
const hace = (n) => (n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`);

const vacio = { data: [] };
const seguro = (p) => p.catch(() => vacio);

export async function calcularAvisos() {
    const [maq, ing, gas, fae, pag, pagOp, hor, ope, man, nov] = await Promise.all([
        seguro(getMaquinas()), seguro(getIngresos()), seguro(getGastos()), seguro(getFaenas()), seguro(getPagos()),
        seguro(getPagosOperador()), seguro(getHoras()), seguro(getOperadoresAPI()), seguro(getMantenimientos()), seguro(getNovedadesAPI()),
    ]);
    const maquinas = maq.data || [], ingresos = ing.data || [], gastos = gas.data || [], faenas = fae.data || [];
    const pagos = pag.data || [], pagosOp = pagOp.data || [], horas = hor.data || [], operadores = ope.data || [];
    const mantenimientos = man.data || [], novedades = nov.data || [];
    const hoy = hoyISO();
    const out = [];

    // 1) Gastos sin fecha: no entran a ningún corte ni a los reportes
    const sinFecha = gastos.filter(g => !g.fecha);
    if (sinFecha.length) {
        out.push({
            id: `gastos-sin-fecha:${sinFecha.length}`, tipo: 'crit', icono: 'gasto',
            titulo: `${plural(sinFecha.length, 'gasto sin fecha', 'gastos sin fecha')} por ${fmt(sinFecha.reduce((a, g) => a + (Number(g.monto) || 0), 0))}`,
            detalle: 'No se cuentan en ningún corte ni en los reportes. Ponles fecha.', destino: { modulo: 'finanzas', tab: 'gastos' },
        });
    }

    // 2) Novedades que reportó el operador y nadie ha revisado
    novedades.filter(n => String(n.estado || '').toLowerCase() === 'pendiente').forEach(n => {
        const d = diasEntre(n.fecha || hoy, hoy);
        out.push({
            id: `novedad:${n.id}`, tipo: 'warn', icono: 'novedad',
            titulo: `${n.operadorNombre || 'Un operador'} reportó una novedad${n.maquinaNombre ? ` en ${n.maquinaNombre}` : ''}`,
            detalle: `${[n.tipo, n.descripcion].filter(Boolean).join(': ').slice(0, 110)} · ${hace(d)}`,
            destino: { modulo: 'maquinaria' },
            accion: { label: 'Marcar revisada', run: () => updateNovedadEstado(n.id, 'revisada') },
        });
    });

    // 3) Mantenimientos pendientes, del más viejo al más nuevo
    mantenimientos.filter(m => m.estado === 'Pendiente').sort((a, b) => dia(a.fecha).localeCompare(dia(b.fecha))).forEach(m => {
        const d = diasEntre(m.fecha || hoy, hoy);
        out.push({
            id: `mant:${m.id}`, tipo: d > 15 ? 'warn' : 'info', icono: 'mant',
            titulo: `${m.maquinaNombre || 'Máquina'} — mantenimiento ${m.tipo || 'pendiente'}`,
            detalle: `Pendiente desde el ${fmtFecha(m.fecha)} (${hace(d)})`, destino: { modulo: 'mantenimientos' },
        });
    });

    // 4) Máquinas paradas en mantenimiento
    const enMant = maquinas.filter(m => m.estado === 'En mantenimiento');
    if (enMant.length) {
        out.push({
            id: `maq-mant:${enMant.map(m => m.id).join(',')}`, tipo: 'warn', icono: 'mant',
            titulo: `${enMant.map(m => m.nombre).join(', ')} — en mantenimiento`, detalle: 'No está generando horas mientras tanto.', destino: { modulo: 'maquinaria' },
        });
    }

    // 5) Cobros de clientes sin completar
    const porCobrar = pagos.filter(p => p.estado !== 'Pagado' && (Number(p.saldoPendiente) || 0) > 0);
    if (porCobrar.length) {
        const total = porCobrar.reduce((a, p) => a + (Number(p.saldoPendiente) || 0), 0);
        out.push({
            id: `cobrar:${Math.round(total)}`, tipo: 'warn', icono: 'cobro',
            titulo: `${fmt(total)} por cobrar`, detalle: `${plural(porCobrar.length, 'cobro', 'cobros')} de clientes sin completar`, destino: { modulo: 'finanzas', tab: 'pagos' },
        });
    }

    // 6) Operadores con horas trabajadas después de su último pago y más de 20 días sin pagarles
    operadores.filter(o => o.activo !== false).forEach(o => {
        const suyas = horas.filter(h => h.operadorNombre === o.nombre && Number(h.horas) > 0);
        if (!suyas.length) return;
        const pagosDe = pagosOp.filter(p => p.operadorNombre === o.nombre).map(p => dia(p.fecha)).filter(Boolean).sort();
        const ultimo = pagosDe[pagosDe.length - 1] || null;
        const horasNuevas = suyas.filter(h => !ultimo || dia(h.fecha) > ultimo);
        if (!horasNuevas.length) return;
        const desde = ultimo || horasNuevas.map(h => dia(h.fecha)).sort()[0];
        const d = diasEntre(desde, hoy);
        if (d <= DIAS_SIN_PAGO) return;
        const hs = horasNuevas.reduce((a, h) => a + (Number(h.horas) || 0), 0);
        out.push({
            id: `sin-pago:${o.id}:${ultimo || 'nunca'}`, tipo: 'warn', icono: 'operador',
            titulo: ultimo ? `${o.nombre} lleva ${d} días sin pago` : `${o.nombre} no ha recibido ningún pago`,
            detalle: `${String(Math.round(hs * 10) / 10).replace('.', ',')} h trabajadas desde ${ultimo ? `el último pago (${fmtFecha(ultimo)})` : `el ${fmtFecha(desde)}`}`,
            destino: { modulo: 'operadores' },
        });
    });

    // 7) Periodos abiertos con la máquina sin horas hace varios días
    faenas.filter(f => f.estado === 'activa' && f.tipo !== 'gastos').forEach(f => {
        const fechas = ingresos.filter(i => i.maquinaNombre === f.maquinaNombre && i.tipoTrabajo === 'Horas').map(i => dia(i.fecha)).sort();
        const ultima = fechas[fechas.length - 1];
        const d = ultima ? diasEntre(ultima, hoy) : diasEntre(f.fechaInicio, hoy);
        if (d < DIAS_SIN_HORAS) return;
        out.push({
            id: `sin-horas:${f.id}:${ultima || 'nunca'}`, tipo: 'info', icono: 'reloj',
            titulo: `${f.maquinaNombre} lleva ${d} días sin horas`,
            detalle: ultima ? `Última lectura registrada el ${fmtFecha(ultima)}` : 'Aún no se registran horas en este periodo', destino: { modulo: 'maquinaria' },
        });
    });

    // 8) Periodos abiertos hace más de un mes: puede ser hora de rendir cuentas
    faenas.filter(f => f.estado === 'activa' && f.fechaInicio).forEach(f => {
        const d = diasEntre(f.fechaInicio, hoy);
        if (d > DIAS_PERIODO_LARGO) {
            out.push({
                id: `periodo-largo:${f.id}`, tipo: 'info', icono: 'periodo',
                titulo: `Periodo de ${f.maquinaNombre} lleva ${d} días abierto`, detalle: 'Puede ser momento de hacer el corte y rendir cuentas', destino: { modulo: 'faenas' },
            });
        }
    });

    // 9) Ingresos repetidos exactos (doble clic o doble registro)
    const grupos = {};
    ingresos.forEach(i => { const k = `${i.maquinaNombre}|${dia(i.fecha)}|${i.tipoTrabajo}|${i.cantidad}|${i.valorUnitario}`; (grupos[k] = grupos[k] || []).push(i); });
    const dups = Object.values(grupos).filter(g => g.length > 1);
    if (dups.length) {
        const riesgo = dups.reduce((a, g) => a + (g.length - 1) * (Number(g[0].total) || 0), 0);
        out.push({
            id: `duplicados:${dups.length}`, tipo: 'warn', icono: 'dup',
            titulo: `${plural(dups.length, 'posible ingreso duplicado', 'posibles ingresos duplicados')} — ${fmt(riesgo)} en riesgo`,
            detalle: 'Misma máquina, fecha, tipo y valor registrados más de una vez', destino: { modulo: 'finanzas', tab: 'ingresos' },
        });
    }

    const orden = { crit: 0, warn: 1, info: 2 };
    return out.sort((a, b) => orden[a.tipo] - orden[b.tipo]);
}

const CLAVE = 'mc_avisos_leidos';
const leerLeidos = () => { try { return new Set(JSON.parse(localStorage.getItem(CLAVE) || '[]')); } catch { return new Set(); } };

// Avisos + cuáles ya se vieron (se recuerda en este navegador). `clave` cambia cuando algo se guardó y toca recalcular.
export function useAvisos(clave, activo = true) {
    const [avisos, setAvisos] = useState([]);
    const [leidos, setLeidos] = useState(leerLeidos);
    const [cargando, setCargando] = useState(true);

    const recargar = useCallback(async () => {
        if (!activo) return;
        try { setAvisos(await calcularAvisos()); } catch { /* se queda con lo anterior */ }
        setCargando(false);
    }, [activo]);

    // Solo con una sesión de administrador abierta: sin sesión las consultas darían 401 y cerrarían la pantalla de acceso
    useEffect(() => {
        if (!activo) { setAvisos([]); return undefined; }
        recargar();
        const t = setInterval(recargar, 5 * 60 * 1000);
        return () => clearInterval(t);
    }, [recargar, clave, activo]);

    const guardar = (set) => {
        // solo se recuerdan los que siguen vigentes, para que la lista no crezca sin fin
        const vigentes = new Set(avisos.map(a => a.id));
        const lista = [...set].filter(id => vigentes.has(id));
        try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
        setLeidos(new Set(lista));
    };
    const marcar = (id) => guardar(new Set([...leidos, id]));
    const marcarTodos = () => guardar(new Set(avisos.map(a => a.id)));
    const noLeidos = avisos.filter(a => !leidos.has(a.id)).length;

    return { avisos, leidos, noLeidos, cargando, recargar, marcar, marcarTodos };
}
