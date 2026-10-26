import { useMemo, useState } from 'react';
import { ChevronRight, Pencil, Trash2, Inbox } from 'lucide-react';
import Estado from '../../utils/Estado';
import Monto from '../../utils/Monto';
import { fmtFecha } from '../../utils/fmtFecha';
import { estadoCausado, nombreEstadoCausado } from '../../utils/causacion';
import './PorPeriodo.css';

const dia10 = (f) => String(f || '').slice(0, 10);
const n = (v) => Number(v) || 0;

// Pagos de clientes o pagos a operadores agrupados por periodo: cada periodo es un bloque con lo cobrado
// y lo pendiente (clientes) o lo causado y lo por pagar (operadores), y se abre para ver sus movimientos.
// modo: 'clientes' (items = pagos) | 'operadores' (items = gastos "Pago operador")
export default function PorPeriodo({ modo, items, faenas, cortes = [], pagosOperador = [], onEditar, onEliminar, partes }) {
    const [abiertos, setAbiertos] = useState({});
    const clientes = modo === 'clientes';

    // A qué periodo pertenece cada movimiento
    const faenaDe = (it) => {
        if (!clientes) return it.faenaId != null ? String(it.faenaId) : null;
        const corte = cortes.find(c => String(c.pagoClienteId) === String(it.id));
        if (corte) return String(corte.faenaId);
        const f = faenas.find(x => x.maquinaNombre === it.maquinaNombre && x.tipo !== 'gastos'
            && dia10(it.fecha) >= dia10(x.fechaInicio) && (!x.fechaFin || x.estado === 'activa' || dia10(it.fecha) <= dia10(x.fechaFin)));
        return f ? String(f.id) : null;
    };

    const grupos = useMemo(() => {
        const mapa = new Map();
        items.forEach(it => { const k = faenaDe(it) || 'sin'; if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(it); });
        const orden = [...faenas].sort((a, b) => dia10(b.fechaInicio).localeCompare(dia10(a.fechaInicio)));
        const out = orden.filter(f => mapa.has(String(f.id))).map(f => ({ key: String(f.id), faena: f, items: mapa.get(String(f.id)) }));
        if (mapa.has('sin')) out.push({ key: 'sin', faena: null, items: mapa.get('sin') });
        return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, faenas, cortes]);

    if (!items.length) {
        return <div className="pp2-vacio"><Inbox size={20} aria-hidden="true" /> No hay movimientos para mostrar con estos filtros.</div>;
    }

    const resumen = (its) => {
        if (clientes) {
            const total = its.reduce((a, p) => a + n(p.valorTotal), 0);
            const pagado = its.reduce((a, p) => a + n(p.valorPagado), 0);
            return [['Total', total, ''], ['Cobrado', pagado, 'pos'], ['Por cobrar', Math.max(0, total - pagado), total - pagado > 0.5 ? 'neg' : 'zero']];
        }
        const costo = its.reduce((a, g) => a + n(g.monto), 0);
        const debe = its.reduce((a, g) => a + (estadoCausado(g, pagosOperador)?.debe || 0), 0);
        return [['Costo', costo, 'neg'], ['Por pagar', debe, debe > 0.5 ? 'neg' : 'zero']];
    };

    return (
        <div className="pp2">
            {grupos.map(gr => {
                const f = gr.faena;
                const abierto = !!abiertos[gr.key];
                const activa = f && (f.estado === 'activa' || f.estado === 'abierta');
                const r = resumen(gr.items);
                return (
                    <section className={`pp2-grupo ${abierto ? 'abierto' : ''}`} key={gr.key}>
                        <button type="button" className="pp2-cab" aria-expanded={abierto} onClick={() => setAbiertos(a => ({ ...a, [gr.key]: !a[gr.key] }))}>
                            <ChevronRight size={16} className="pp2-flecha" aria-hidden="true" />
                            <div className="pp2-tit">
                                <b>{f ? (f.nombreObra || 'Periodo') : 'Sin periodo'}</b>
                                <span>{f ? `${f.maquinaNombre || ''}${f.cliente ? ' · ' + f.cliente : ''} · ${fmtFecha(f.fechaInicio)}${f.fechaFin && !activa ? ' a ' + fmtFecha(f.fechaFin) : ' en adelante'}` : 'Movimientos que no se pudieron ligar a un periodo'}</span>
                            </div>
                            {f && <span className={`pp2-est ${activa ? 'on' : ''}`}>{activa ? 'Activo' : 'Cerrado'}</span>}
                            <div className="pp2-cifras">
                                {r.map(([l, v, t]) => <div key={l} className={t}><span>{l}</span><b><Monto v={v} /></b></div>)}
                            </div>
                        </button>
                        {abierto && (
                            <div className="pp2-cuerpo">
                                {gr.items.slice().sort((a, b) => dia10(b.fecha).localeCompare(dia10(a.fecha))).map(it => clientes ? (
                                    <div className="pp2-fila" key={it.id}>
                                        <span className="pp2-fecha">{fmtFecha(it.fecha)}</span>
                                        <div className="pp2-desc"><b>{it.cliente}</b><span>{it.descripcion || it.maquinaNombre}</span></div>
                                        <span className="pp2-num mut"><Monto v={n(it.valorTotal)} /></span>
                                        <span className="pp2-num pos"><Monto v={n(it.valorPagado)} /></span>
                                        <span className="pp2-num neg"><Monto v={n(it.saldoPendiente)} /></span>
                                        <span><Estado valor={it.estado} /></span>
                                        <span className="pp2-acc">
                                            <button type="button" className="fin-iconbtn" aria-label="Editar" onClick={() => onEditar(it)}><Pencil size={14} /></button>
                                            <button type="button" className="fin-iconbtn" aria-label="Eliminar" onClick={() => onEliminar(it)}><Trash2 size={14} /></button>
                                        </span>
                                    </div>
                                ) : (() => {
                                    const e = estadoCausado(it, pagosOperador);
                                    const p = partes(it);
                                    return (
                                        <div className="pp2-fila op" key={it.id}>
                                            <span className="pp2-fecha">{fmtFecha(it.fecha)}</span>
                                            <div className="pp2-desc"><b>{p.operador}</b><span>{e ? 'Causado al hacer el corte' : 'Pago registrado'}{p.detalle ? ` · ${p.detalle}` : ''}</span></div>
                                            <span className="pp2-num neg"><Monto v={n(it.monto)} /></span>
                                            <span>{e ? <Estado valor={nombreEstadoCausado(e) === 'Por pagar' ? 'Pendiente' : nombreEstadoCausado(e)} /> : <Estado valor="Pagado" />}</span>
                                            <span className="pp2-acc"><small className="fin-info-tag" title="Se edita desde Operadores">Operadores</small></span>
                                        </div>
                                    );
                                })())}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
