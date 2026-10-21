import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Check, CircleCheck, Clock } from 'lucide-react';
import { getCortes } from '../../api';
import MoneyInput from '../../utils/MoneyInput';
import { ErrorCampo } from '../../utils/useErrores';
import EmptyState from '../../utils/EmptyState';
import { fmtFecha } from '../../utils/fmtFecha';
import { nombreCorte, ordenarCortes } from '../../utils/cortes';
import './PagosClientesTab.css';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const METODOS = ['Transferencia', 'Consignación', 'Efectivo', 'Cheque', 'Otro'];
const ESTADO = { Pagado: ['ok', 'Recibido', CircleCheck], Parcial: ['parcial', 'Parcial', Clock], Deuda: ['pend', 'Pendiente', Clock] };

function Chip({ estado }) {
    const [clase, texto, Icono] = ESTADO[estado] || ['pend', estado || '—', Clock];
    return <span className={`pc-chip ${clase}`}><Icono size={13} aria-hidden="true" /> {texto}</span>;
}

// Pestaña Pagos Clientes: lo recibido, lo que falta por cobrar y el historial de recaudos y abonos de la máquina.
export default function PagosClientesTab({ maq, pagos, modalAbierto, editando, form, setForm, errores, onNuevo, onEditar, onEliminar, onGuardar, onCerrar }) {
    const [cortes, setCortes] = useState([]);
    useEffect(() => { getCortes().then(r => setCortes(r.data || [])).catch(() => {}); }, [pagos.length]);

    // A qué corte pertenece cada cobro (el número del corte dentro de su periodo)
    const corteDe = useMemo(() => {
        const mapa = {};
        const porFaena = {};
        cortes.forEach(c => { (porFaena[c.faenaId] = porFaena[c.faenaId] || []).push(c); });
        Object.values(porFaena).forEach(lista => ordenarCortes(lista).forEach((c, i) => { if (c.pagoClienteId) mapa[String(c.pagoClienteId)] = nombreCorte(c, i + 1); }));
        return mapa;
    }, [cortes]);

    const recibido = pagos.reduce((a, p) => a + (Number(p.valorPagado) || 0), 0);
    const porCobrar = pagos.reduce((a, p) => a + (Number(p.saldoPendiente) || 0), 0);
    const facturado = pagos.reduce((a, p) => a + (Number(p.valorTotal) || 0), 0);
    const conSaldo = pagos.filter(p => (Number(p.saldoPendiente) || 0) > 0).length;
    const conAbono = pagos.filter(p => (Number(p.valorPagado) || 0) > 0).length;
    const porCliente = {};
    pagos.forEach(p => { if (p.cliente) porCliente[p.cliente] = (porCliente[p.cliente] || 0) + (Number(p.valorTotal) || 0); });
    const principal = Object.entries(porCliente).sort((a, b) => b[1] - a[1])[0];
    const ordenados = [...pagos].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

    return (
        <>
            <div className="pc-tarjetas">
                <div className="pc-tarjeta">
                    <span className="pc-etq">Pagos recibidos</span>
                    <b className="pc-valor vd">{fmt(recibido)}</b>
                    <small>{conAbono} cobro{conAbono === 1 ? '' : 's'} con pagos registrados</small>
                </div>
                <div className="pc-tarjeta">
                    <span className="pc-etq">Saldos por cobrar</span>
                    <b className="pc-valor na">{fmt(porCobrar)}</b>
                    <small>{conSaldo} cobro{conSaldo === 1 ? '' : 's'} con saldo pendiente</small>
                </div>
                <div className="pc-tarjeta">
                    <span className="pc-etq">Cliente principal</span>
                    <b className="pc-valor cl">{principal ? principal[0] : 'Sin cobros todavía'}</b>
                    <small>{principal ? `${pagos.length} cobro${pagos.length === 1 ? '' : 's'} · facturado ${fmt(facturado)}` : 'Registra el primer pago'}</small>
                </div>
            </div>

            <section className="pc-historial">
                <header>
                    <div>
                        <h3>Historial de Recaudos y Abonos de Clientes</h3>
                        <p>Cobros de {maq.nombre} y lo que cada cliente ha pagado</p>
                    </div>
                    <button type="button" className="pc-nuevo" onClick={onNuevo}><Plus size={16} aria-hidden="true" /> Registrar pago</button>
                </header>

                {ordenados.length === 0 ? (
                    <EmptyState titulo="Aún no hay pagos de esta máquina" texto={`Los cobros de cada corte aparecen aquí, o registra lo que te paga un cliente por el trabajo de ${maq.nombre}.`}
                        accion={{ label: 'Registrar el primero', onClick: onNuevo }} />
                ) : (
                    <div className="pc-tabla">
                        <div className="pc-tr pc-th"><span>Fecha</span><span>Corte imputado</span><span>Cliente</span><span>Método de pago</span><span>Comprobante #</span>
                            <span className="r">Total</span><span className="r">Pagado</span><span className="r">Saldo</span><span>Estado</span><span /></div>
                        {ordenados.map(p => (
                            <div className="pc-tr" key={p.id}>
                                <span data-l="Fecha"><b>{fmtFecha(p.fecha)}</b></span>
                                <span data-l="Corte imputado" className="mono">{corteDe[String(p.id)] || '—'}</span>
                                <span data-l="Cliente">{p.cliente}{p.descripcion && <small>{p.descripcion}</small>}</span>
                                <span data-l="Método de pago">{p.metodoPago || '—'}</span>
                                <span data-l="Comprobante #" className="mono gris">{p.comprobante || '—'}</span>
                                <span data-l="Total" className="r mono">{fmt(p.valorTotal)}</span>
                                <span data-l="Pagado" className="r mono vd">{fmt(p.valorPagado)}</span>
                                <span data-l="Saldo" className={`r mono ${p.saldoPendiente > 0 ? 'na' : ''}`}>{fmt(p.saldoPendiente)}</span>
                                <span data-l="Estado"><Chip estado={p.estado} /></span>
                                <span className="pc-acc">
                                    <button type="button" aria-label="Editar pago" onClick={() => onEditar(p)}><Pencil size={14} /></button>
                                    <button type="button" aria-label="Borrar pago" onClick={() => onEliminar(p.id)}><Trash2 size={14} /></button>
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {modalAbierto && (
                <div className="pc-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
                    <div className="pc-modal" role="dialog" aria-modal="true" aria-labelledby="pc-titulo">
                        <header className="pc-m-cab">
                            <div>
                                <h3 id="pc-titulo">{editando ? 'Editar pago de cliente' : 'Registrar pago de cliente'}</h3>
                                <p>El pago queda asociado a {maq.nombre} automáticamente</p>
                            </div>
                            <button type="button" className="pc-m-x" aria-label="Cerrar" onClick={onCerrar}><X size={18} /></button>
                        </header>
                        <div className="pc-m-cuerpo">
                            <div className="pc-campo">
                                <label htmlFor="pc-cliente">Cliente *</label>
                                <input id="pc-cliente" className={`pc-in ${errores.errores.pagoCliente ? 'err' : ''}`} value={form.cliente} placeholder="Ej: Consorcio Vial San José"
                                    onChange={e => { setForm({ ...form, cliente: e.target.value }); errores.limpiar('pagoCliente'); }} />
                                <ErrorCampo msg={errores.errores.pagoCliente} />
                            </div>
                            <div className="pc-fila">
                                <div className="pc-campo"><label>Total del cobro ($)</label><MoneyInput className="pc-in" value={form.valorTotal} onChange={e => setForm({ ...form, valorTotal: e.target.value })} /></div>
                                <div className="pc-campo"><label>Pagado ($)</label><MoneyInput className="pc-in" value={form.valorPagado} onChange={e => setForm({ ...form, valorPagado: e.target.value })} /></div>
                            </div>
                            <div className="pc-fila">
                                <div className="pc-campo">
                                    <label htmlFor="pc-metodo">Método de pago</label>
                                    <select id="pc-metodo" className="pc-in" value={form.metodoPago || ''} onChange={e => setForm({ ...form, metodoPago: e.target.value })}>
                                        <option value="">Sin indicar</option>
                                        {form.metodoPago && !METODOS.includes(form.metodoPago) && <option value={form.metodoPago}>{form.metodoPago}</option>}
                                        {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="pc-campo">
                                    <label htmlFor="pc-comp">Comprobante #</label>
                                    <input id="pc-comp" className="pc-in" maxLength={60} value={form.comprobante || ''} placeholder="Ej: TR-99410294" onChange={e => setForm({ ...form, comprobante: e.target.value })} />
                                </div>
                            </div>
                            <div className="pc-fila">
                                <div className="pc-campo"><label htmlFor="pc-desc">Descripción</label><input id="pc-desc" className="pc-in" value={form.descripcion} placeholder="Ej: Abono obra" onChange={e => setForm({ ...form, descripcion: e.target.value })} /></div>
                                <div className="pc-campo"><label htmlFor="pc-fecha">Fecha</label><input id="pc-fecha" className="pc-in" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div>
                            </div>
                        </div>
                        <footer className="pc-m-pie">
                            <button type="button" className="pc-cancelar" onClick={onCerrar}>Cancelar</button>
                            <button type="button" className="pc-guardar" onClick={onGuardar}><Check size={16} aria-hidden="true" /> {editando ? 'Guardar cambios' : 'Registrar pago'}</button>
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
}
