import { getCortes, getPagos, getHoras, getPagosOperador, getIngresos, getMaquinas } from '../api';
import { fmtFecha } from './fmtFecha';
import { ordenarCortes, resumenTramo, diaSiguiente, enRango, fmtHoras } from './cortes';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const dia = (f) => String(f || '').slice(0, 10);

// Lo que conviene resolver antes de rendir cuentas y cerrar un periodo. Devuelve una lista de frases
// (vacía si todo está en orden). Si algo no se puede consultar, no bloquea el cierre.
export async function pendientesDeCierre(faena) {
    if (!faena || faena.tipo === 'gastos') return [];
    const out = [];
    try {
        const [c, p, h, po, ing, mq] = await Promise.all([getCortes(), getPagos(), getHoras(), getPagosOperador(), getIngresos(), getMaquinas()]);
        const delPeriodo = (x) => String(x.faenaId) === String(faena.id);
        const cortes = ordenarCortes((c.data || []).filter(delPeriodo));
        const ingresos = (ing.data || []).filter(delPeriodo);

        // 1) Horas que no están en ningún corte: no tienen cobro en Pagos Clientes
        const ultimo = cortes[cortes.length - 1];
        const sigue = ultimo ? diaSiguiente(ultimo.fechaFin) : dia(faena.fechaInicio);
        const sinCortar = resumenTramo(ingresos, sigue, null);
        if (sinCortar.registros > 0) {
            out.push(`Hay ${fmtHoras(sinCortar.horas)} h (${fmt(sinCortar.total)}) sin cortar desde el ${fmtFecha(sigue)}. Si cierras así, no se crea el cobro de esas horas en Pagos Clientes: haz el corte primero.`);
        }

        // 2) Cobros de cortes que el cliente no ha pagado del todo (siguen en Pagos Clientes)
        const saldos = cortes.map(x => (x.pagoClienteId ? (p.data || []).find(y => String(y.id) === String(x.pagoClienteId)) : null))
            .filter(Boolean).map(y => Number(y.saldoPendiente ?? Math.max((Number(y.valorTotal) || 0) - (Number(y.valorPagado) || 0), 0)) || 0).filter(v => v > 0);
        if (saldos.length) {
            out.push(`El cliente aún debe ${fmt(saldos.reduce((a, v) => a + v, 0))} de ${saldos.length} corte${saldos.length === 1 ? '' : 's'}. Ese cobro sigue en Pagos Clientes.`);
        }

        // 3) Lo que se le debe al operador (aproximado): al cerrar, su cuenta del periodo empieza en cero
        const maq = (mq.data || []).find(m => m.nombre === faena.maquinaNombre);
        if (maq && maq.operadorNombre && Number(maq.valorHoraOperador) > 0) {
            const horas = (h.data || []).filter(x => delPeriodo(x) && x.operadorNombre === maq.operadorNombre).reduce((a, x) => a + (Number(x.horas) || 0), 0);
            const ganado = horas * Number(maq.valorHoraOperador);
            const pagado = (po.data || []).filter(x => x.operadorNombre === maq.operadorNombre && enRango(x.fecha, dia(faena.fechaInicio), null))
                .reduce((a, x) => a + (Number(x.monto) || 0), 0);
            if (ganado - pagado > 1000) {
                out.push(`Le debes a ${maq.operadorNombre} unos ${fmt(ganado - pagado)}. Al cerrar, su cuenta del periodo empieza en cero: págale antes o ese saldo ya no se verá en su resumen.`);
            }
        }
    } catch { return []; }
    return out;
}
