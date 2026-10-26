import { useMemo, useState } from 'react';
import { ChevronRight, Pencil, Trash2, Plus, CircleCheck, Clock } from 'lucide-react';
import Monto from '../../utils/Monto';
import EmptyState from '../../utils/EmptyState';
import { fmtFecha } from '../../utils/fmtFecha';
import { nombreCorte, ordenarCortes } from '../../utils/cortes';
import './PorPeriodo.css';

const dia10 = (f) => String(f || '').slice(0, 10);
const n = (v) => Number(v) || 0;
const fmt = (v) => '$' + Math.round(n(v)).toLocaleString('es-CO');

// Agrupa movimientos por periodo (más reciente primero); lo que no se pudo ligar va al final
function agrupar(items, faenas, faenaDe) {
    const mapa = new Map();
    items.forEach(it => { const k = faenaDe(it) || 'sin'; if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(it); });
    const orden = [...faenas].sort((a, b) => dia10(b.fechaInicio).localeCompare(dia10(a.fechaInicio)));
    const out = orden.filter(f => mapa.has(String(f.id))).map(f => ({ key: String(f.id), faena: f, items: mapa.get(String(f.id)) }));
    if (mapa.has('sin')) out.push({ key: 'sin', faena: null, items: mapa.get('sin') });
    return out;
}

function Cabecera({ gr, abierto, alternar, cifras }) {
    const f = gr.faena;
    const activa = f && (f.estado === 'activa' || f.estado === 'abierta');
    return (
        <button type="button" className="pp2-cab" aria-expanded={abierto} onClick={alternar}>
            <ChevronRight size={16} className="pp2-flecha" aria-hidden="true" />
            <div className="pp2-tit">
                <b>{f ? (f.nombreObra || 'Periodo') : 'Sin periodo'}</b>
                <span>{f ? `${f.maquinaNombre || ''}${f.cliente ? ' · ' + f.cliente : ''} · ${fmtFecha(f.fechaInicio)}${f.fechaFin && !activa ? ' a ' + fmtFecha(f.fechaFin) : ' en adelante'}` : 'Movimientos que no se pudieron ligar a un periodo'}</span>
            </div>
            {f && <span className={`pp2-est ${activa ? 'on' : ''}`}>{activa ? 'Activo' : 'Cerrado'}</span>}
            <div className="pp2-cifras">
                {cifras.map(([l, v, t]) => <div key={l} className={t}><span>{l}</span><b><Monto v={v} /></b></div>)}
            </div>
        </button>
    );
}

const ESTADO_PAGO = { Pagado: ['ok', 'Recibido', CircleCheck], Parcial: ['parcial', 'Parcial', Clock], Deuda: ['pend', 'Pendiente', Clock], Pendiente: ['pend', 'Pendiente', Clock] };
function Chip({ estado }) {
    const [clase, texto, Icono] = ESTADO_PAGO[estado] || ['pend', estado || '—', Clock];
    return <span className={`pc-chip ${clase}`}><Icono size={13} aria-hidden="true" /> {texto}</span>;
}

// ── Pagos Clientes: el mismo diseño de la pestaña de la máquina, con los cobros agrupados por periodo ──
export function PagosClientesPeriodo({ pagos, faenas, cortes, onNuevo, onEditar, onEliminar }) {
    const [abiertos, setAbiertos] = useState({});

    // Número del corte dentro de su periodo, para cada cobro
    const corteDe = useMemo(() => {
        const mapa = {};
        const porFaena = {};
        cortes.forEach(c => { (porFaena[c.faenaId] = porFaena[c.faenaId] || []).push(c); });
        Object.values(porFaena).forEach(lista => ordenarCortes(lista).forEach((c, i) => { if (c.pagoClienteId) mapa[String(c.pagoClienteId)] = { nombre: nombreCorte(c, i + 1), faenaId: String(c.faenaId) }; }));
        return mapa;
    }, [cortes]);

    const faenaDe = (p) => {
        const c = corteDe[String(p.id)];
        if (c) return c.faenaId;
        const f = faenas.find(x => x.maquinaNombre === p.maquinaNombre && x.tipo !== 'gastos'
            && dia10(p.fecha) >= dia10(x.fechaInicio) && (!x.fechaFin || x.estado === 'activa' || dia10(p.fecha) <= dia10(x.fechaFin)));
        return f ? String(f.id) : null;
    };
    const grupos = useMemo(() => agrupar(pagos, faenas, faenaDe), [pagos, faenas, cortes]); // eslint-disable-line react-hooks/exhaustive-deps

    const recibido = pagos.reduce((a, p) => a + n(p.valorPagado), 0);
    const facturado = pagos.reduce((a, p) => a + n(p.valorTotal), 0);
    const porCobrar = pagos.reduce((a, p) => a + Math.max(0, n(p.saldoPendiente)), 0);
    const pct = facturado > 0 ? Math.round(recibido / facturado * 100) : 0;
    const conSaldo = pagos.filter(p => n(p.saldoPendiente) > 0).length;
    const conAbono = pagos.filter(p => n(p.valorPagado) > 0).length;

    return (
        <>
            <div className="pc-tarjetas">
                <div className="pc-tarjeta"><span className="pc-etq">Pagos recibidos</span><b className="pc-valor vd"><Monto v={recibido} /></b><small>{conAbono} cobro{conAbono === 1 ? '' : 's'} con pagos registrados</small></div>
                <div className="pc-tarjeta"><span className="pc-etq">Total facturado</span><b className="pc-valor"><Monto v={facturado} /></b><small>{pagos.length} cobro{pagos.length === 1 ? '' : 's'} · {pct}% ya recibido</small></div>
                <div className="pc-tarjeta"><span className="pc-etq">Saldos por cobrar</span><b className="pc-valor na"><Monto v={porCobrar} /></b><small>{conSaldo} cobro{conSaldo === 1 ? '' : 's'} con saldo pendiente</small></div>
            </div>

            <section className="pc-historial">
                <header>
                    <div><h3>Historial de Recaudos y Abonos de Clientes</h3><p>Cobros agrupados por periodo y lo que cada cliente ha pagado</p></div>
                    <button type="button" className="pc-nuevo" onClick={onNuevo}><Plus size={16} aria-hidden="true" /> Registrar pago</button>
                </header>

                {pagos.length === 0 ? (
                    <EmptyState titulo="No hay pagos de clientes para mostrar" texto="Cambia el filtro de fechas o la búsqueda, o registra lo que te paga un cliente."
                        accion={{ label: 'Registrar el primero', onClick: onNuevo }} />
                ) : grupos.map((gr, gi) => {
                    const abierto = abiertos[gr.key] === undefined ? gi === 0 : abiertos[gr.key];
                    const t = gr.items.reduce((a, p) => a + n(p.valorTotal), 0);
                    const c = gr.items.reduce((a, p) => a + n(p.valorPagado), 0);
                    return (
                        <div className={`pp2-grupo pcp ${abierto ? 'abierto' : ''}`} key={gr.key}>
                            <Cabecera gr={gr} abierto={abierto} alternar={() => setAbiertos(a => ({ ...a, [gr.key]: !abierto }))}
                                cifras={[['Cobrado', c, 'pos'], ['Por cobrar', Math.max(0, t - c), t - c > 0.5 ? 'neg' : 'zero']]} />
                            {abierto && (
                                <div className="pc-tabla">
                                    <div className="pc-tr pc-th"><span>Fecha</span><span>Corte imputado</span><span>Cliente</span><span>Método de pago</span><span>Comprobante #</span>
                                        <span className="r">Total</span><span className="r">Pagado</span><span className="r">Saldo</span><span>Estado</span><span /></div>
                                    {[...gr.items].sort((a, b) => dia10(b.fecha).localeCompare(dia10(a.fecha))).map(p => (
                                        <div className="pc-tr" key={p.id}>
                                            <span data-l="Fecha"><b>{fmtFecha(p.fecha)}</b></span>
                                            <span data-l="Corte imputado" className="mono">{corteDe[String(p.id)]?.nombre || '—'}</span>
                                            <span data-l="Cliente">{p.cliente}{p.descripcion && <small>{p.descripcion}</small>}</span>
                                            <span data-l="Método de pago">{p.metodoPago || '—'}</span>
                                            <span data-l="Comprobante #" className="mono gris">{p.comprobante || '—'}</span>
                                            <span data-l="Total" className="r mono">{fmt(p.valorTotal)}</span>
                                            <span data-l="Pagado" className="r mono vd">{fmt(p.valorPagado)}</span>
                                            <span data-l="Saldo" className={`r mono ${n(p.saldoPendiente) > 0 ? 'na' : ''}`}>{fmt(p.saldoPendiente)}</span>
                                            <span data-l="Estado"><Chip estado={p.estado} /></span>
                                            <span className="pc-acc">
                                                <button type="button" aria-label="Editar pago" onClick={() => onEditar(p)}><Pencil size={14} /></button>
                                                <button type="button" aria-label="Borrar pago" onClick={() => onEliminar(p)}><Trash2 size={14} /></button>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>
        </>
    );
}

const ESTADO_OP = { Pagado: ['ok', 'Pagado', CircleCheck], Parcial: ['parcial', 'Parcial', Clock], 'Por pagar': ['pend', 'Pendiente', Clock] };
function ChipOp({ estado }) {
    const [clase, texto, Icono] = ESTADO_OP[estado] || ['pend', estado || '—', Clock];
    return <span className={`pc-chip ${clase}`}><Icono size={13} aria-hidden="true" /> {texto}</span>;
}

// ── Salarios: el mismo diseño de Pagos Clientes. Cortes causados y pagos a operadores, agrupados por periodo ──
// filas: { key, tipo: 'corte' | 'pago', id, fecha, operador, desc, maquina, monto, pagado, faenaId, estado, debe }
export function OperadoresPeriodo({ resumen, filas, faenas, onEditar, onEliminar }) {
    const [abiertos, setAbiertos] = useState({});
    const grupos = useMemo(() => agrupar(filas, faenas, f => (f.faenaId != null ? String(f.faenaId) : null)), [filas, faenas]);
    const pct = resumen.causado > 0 ? Math.round(Math.min(resumen.pagado, resumen.causado) / resumen.causado * 100) : 0;
    const conSaldo = filas.filter(f => f.tipo === 'corte' && n(f.debe) > 0.5).length;
    const nPagos = filas.filter(f => f.tipo === 'pago').length;

    return (
        <>
            <div className="pc-tarjetas">
                <div className="pc-tarjeta"><span className="pc-etq">Pagado a operadores</span><b className="pc-valor vd"><Monto v={resumen.pagado} /></b><small>{nPagos} pago{nPagos === 1 ? '' : 's'} registrado{nPagos === 1 ? '' : 's'}</small></div>
                <div className="pc-tarjeta"><span className="pc-etq">Total de cortes cerrados</span><b className="pc-valor"><Monto v={resumen.causado} /></b><small>{pct}% ya pagado</small></div>
                <div className="pc-tarjeta"><span className="pc-etq">Por pagar</span><b className="pc-valor na"><Monto v={resumen.pendiente} /></b><small>{conSaldo} corte{conSaldo === 1 ? '' : 's'} con saldo pendiente</small></div>
            </div>

            <section className="pc-historial">
                <header>
                    <div><h3>Historial de Cortes y Pagos a Operadores</h3><p>Lo que se causó en cada corte y lo que se le ha pagado al operador, por periodo</p></div>
                </header>

                {grupos.map((gr, gi) => {
                    const abierto = abiertos[gr.key] === undefined ? gi === 0 : abiertos[gr.key];
                    const pagado = gr.items.filter(f => f.tipo === 'pago').reduce((a, f) => a + n(f.monto), 0);
                    const debe = gr.items.filter(f => f.tipo === 'corte').reduce((a, f) => a + n(f.debe), 0);
                    return (
                        <div className={`pp2-grupo pcp ${abierto ? 'abierto' : ''}`} key={gr.key}>
                            <Cabecera gr={gr} abierto={abierto} alternar={() => setAbiertos(a => ({ ...a, [gr.key]: !abierto }))}
                                cifras={[['Pagado', pagado, 'pos'], ['Por pagar', debe, debe > 0.5 ? 'neg' : 'zero']]} />
                            {abierto && (
                                <div className="pc-tabla">
                                    <div className="pc-tr pc-th op"><span>Fecha</span><span>Concepto</span><span>Operador</span><span>Máquina</span>
                                        <span className="r">Total</span><span className="r">Pagado</span><span className="r">Saldo</span><span>Estado</span><span /></div>
                                    {[...gr.items].sort((a, b) => dia10(b.fecha).localeCompare(dia10(a.fecha))).map(f => {
                                        const corte = f.tipo === 'corte';
                                        return (
                                            <div className="pc-tr op" key={f.key}>
                                                <span data-l="Fecha"><b>{fmtFecha(f.fecha)}</b></span>
                                                <span data-l="Concepto" className="mono">{corte ? String(f.desc || '').split(' · ')[0] || 'Corte' : 'Pago'}</span>
                                                <span data-l="Operador">{f.operador}{f.desc && <small>{f.desc}</small>}</span>
                                                <span data-l="Máquina" className="gris">{f.maquina || '—'}</span>
                                                <span data-l="Total" className="r mono">{corte ? fmt(f.monto) : '—'}</span>
                                                <span data-l="Pagado" className="r mono vd">{corte ? fmt(f.pagado) : fmt(f.monto)}</span>
                                                <span data-l="Saldo" className={`r mono ${corte && n(f.debe) > 0.5 ? 'na' : ''}`}>{corte ? fmt(f.debe) : '—'}</span>
                                                <span data-l="Estado">{corte ? <ChipOp estado={f.estado} /> : <ChipOp estado="Pagado" />}</span>
                                                <span className="pc-acc">
                                                    <button type="button" aria-label="Editar" onClick={() => onEditar(f)}><Pencil size={14} /></button>
                                                    <button type="button" aria-label="Eliminar" onClick={() => onEliminar(f)}><Trash2 size={14} /></button>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>
        </>
    );
}
