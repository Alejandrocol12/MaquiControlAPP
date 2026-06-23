import { useState, useEffect, useCallback } from 'react';
import { usePaginacion, Paginacion } from '../../utils/Paginacion';
import { useSortable } from '../../utils/useSortable';
import {
    getMaquinas,
    getIngresos, createIngreso, updateIngreso, deleteIngreso,
    getGastos, createGasto, updateGasto, deleteGasto,
    getSalarios, createSalario, updateSalario, deleteSalario,
    getPagos, createPago, updatePago, deletePago,
} from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import { TrendingUp, TrendingDown, BarChart2, Plus, Check, Pencil, Trash2, HardHat, CreditCard, CheckCircle, FileText, Paperclip, X, Search, Fuel, Wrench, Info, AlertTriangle } from 'lucide-react';
import MoneyInput from '../../utils/MoneyInput';
import { fmtFecha } from '../../utils/fmtFecha';
import { guardarFactura, eliminarFactura, abrirFactura } from '../../utils/facturaAPI';

const fmt = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().split('T')[0];

const FORM_ING  = { descripcion: '', tipoTrabajo: 'Horas', cantidad: 0, valorUnitario: 0, fecha: hoy(), maquinaNombre: '' };
const FORM_GAS  = { descripcion: '', categoria: '', monto: 0, fecha: hoy(), maquinaNombre: '' };
const FORM_SAL  = { operadorNombre: '', maquinaNombre: '', horasTrabajadas: 0, valorHora: 0, anticipos: 0, estado: 'Pendiente', fecha: hoy() };
const FORM_PAG  = { cliente: '', maquinaNombre: '', descripcion: '', valorTotal: 0, valorPagado: 0, fecha: hoy() };

const normalizarPago = (p) => {
    const valorTotal = Number(p.valorTotal ?? p.monto ?? 0) || 0;
    const valorPagado = Number(p.valorPagado ?? 0) || 0;
    const saldoPendiente = Number(p.saldoPendiente ?? Math.max(valorTotal - valorPagado, 0)) || 0;
    return {
        ...p,
        valorTotal,
        valorPagado,
        saldoPendiente,
        estado: p.estado || (saldoPendiente <= 0 ? 'Pagado' : valorPagado > 0 ? 'Parcial' : 'Pendiente'),
    };
};

function Finanzas({ tabInicial = 'ingresos' }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [tab, setTab]           = useState(tabInicial);
    const [maquinas, setMaquinas] = useState([]);
    const [ingresos, setIngresos] = useState([]);
    const [gastos, setGastos]     = useState([]);
    const [salarios, setSalarios] = useState([]);
    const [pagos, setPagos]       = useState([]);

    const [cargando, setCargando] = useState(true);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [editandoId, setEditandoId]   = useState(null);
    const [gastoFactura, setGastoFactura] = useState(null);
    const [facturasIds, setFacturasIds]   = useState(new Set());
    const [buscar, setBuscar]             = useState('');
    const [periodoFiltro, setPeriodoFiltro] = useState('todo');
    const [fechaDesde, setFechaDesde]     = useState('');
    const [fechaHasta, setFechaHasta]     = useState('');

    const [formIng, setFormIng] = useState(FORM_ING);
    const [formGas, setFormGas] = useState(FORM_GAS);
    const [formSal, setFormSal] = useState(FORM_SAL);
    const [formPag, setFormPag] = useState(FORM_PAG);

    useEffect(() => { cargarTodo(); }, []);
    useEffect(() => { setTab(tabInicial); }, [tabInicial]);

    const cargarTodo = () => {
        setCargando(true);
        Promise.all([
            getMaquinas(),
            getIngresos(),
            getGastos(),
            getSalarios(),
            getPagos(),
        ]).then(([maqR, ingR, gasR, salR, pagR]) => {
            setMaquinas(maqR.data);
            setIngresos(ingR.data);
            setGastos(gasR.data);
            setFacturasIds(new Set((gasR.data || []).filter(g => g.tieneFactura).map(g => String(g.id))));
            setSalarios(salR.data);
            setPagos((pagR.data || []).map(normalizarPago));
        }).catch(console.error).finally(() => setCargando(false));
    };

    const abrirNuevo = () => {
        setEditandoId(null);
        setFormIng(FORM_ING); setFormGas(FORM_GAS); setFormSal(FORM_SAL); setFormPag(FORM_PAG);
        setMostrarForm(true);
    };

    const abrirEditar = (item) => {
        setEditandoId(item.id);
        if (tab === 'ingresos') setFormIng({ ...item });
        if (tab === 'gastos')   setFormGas({ ...item });
        if (tab === 'salarios') setFormSal({ ...item });
        if (tab === 'pagos')    setFormPag(normalizarPago(item));
        setMostrarForm(true);
    };

    const guardar = async () => {
        const esEditar = editandoId !== null;
        let op;
        if (tab === 'ingresos') op = esEditar ? updateIngreso(editandoId, formIng) : createIngreso(formIng);
        if (tab === 'gastos')   op = esEditar ? updateGasto(editandoId, formGas)   : createGasto(formGas);
        if (tab === 'salarios') op = esEditar ? updateSalario(editandoId, formSal) : createSalario(formSal);
        if (tab === 'pagos')    op = esEditar ? updatePago(editandoId, formPag)    : createPago(formPag);
        const res = await op.catch(console.error);
        if (!res) return;
        if (tab === 'gastos' && gastoFactura) {
            const targetId = esEditar ? editandoId : res.data?.id;
            if (targetId) {
                await guardarFactura(targetId, gastoFactura).catch(console.error);
                setFacturasIds(prev => new Set([...prev, String(targetId)]));
            }
            setGastoFactura(null);
        }
        cargarTodo();
        setMostrarForm(false);
        setEditandoId(null);
        toast(esEditar ? 'Registro actualizado' : 'Registro guardado');
    };

    const eliminar = async (tabNombre, id) => {
        if (!await confirm('¿Eliminar este registro?')) return;
        const ops = { ingresos: deleteIngreso, gastos: deleteGasto, salarios: deleteSalario, pagos: deletePago };
        await ops[tabNombre](id).catch(console.error);
        if (tabNombre === 'gastos') {
            await eliminarFactura(id).catch(() => {});
            setFacturasIds(prev => { const s = new Set(prev); s.delete(String(id)); return s; });
        }
        cargarTodo();
    };

    const nomsMaquinas = maquinas.map(m => m.nombre);

    const porFecha = (arr, campo) => {
        if (periodoFiltro === 'todo') return arr;
        if (periodoFiltro === 'rango') {
            return arr.filter(x => {
                const f = x[campo] || '';
                if (fechaDesde && f < fechaDesde) return false;
                if (fechaHasta && f > fechaHasta) return false;
                return true;
            });
        }
        const hoyD = new Date();
        let prefix;
        if (periodoFiltro === 'mes')    prefix = hoyD.toISOString().slice(0, 7);
        else if (periodoFiltro === 'ultimo') { const d = new Date(hoyD); d.setMonth(d.getMonth() - 1); prefix = d.toISOString().slice(0, 7); }
        else if (periodoFiltro === 'anio')   prefix = String(hoyD.getFullYear());
        return prefix ? arr.filter(x => x[campo]?.startsWith(prefix)) : arr;
    };

    const q = buscar.toLowerCase();
    const ingFiltrados = porFecha([...ingresos].reverse(), 'fecha').filter(i => !q || i.descripcion?.toLowerCase().includes(q) || i.maquinaNombre?.toLowerCase().includes(q) || i.tipoTrabajo?.toLowerCase().includes(q));
    const gasFiltrados = porFecha([...gastos].reverse(), 'fecha').filter(g =>
        g.categoria !== 'Salario' &&
        (!q || g.descripcion?.toLowerCase().includes(q) || g.maquinaNombre?.toLowerCase().includes(q) || g.categoria?.toLowerCase().includes(q))
    );
    const salFiltrados = porFecha([...salarios].reverse(), 'fecha').filter(s => !q || s.operadorNombre?.toLowerCase().includes(q) || s.maquinaNombre?.toLowerCase().includes(q));
    const pagFiltrados = porFecha([...pagos].reverse(), 'fecha').filter(p => !q || p.cliente?.toLowerCase().includes(q) || p.maquinaNombre?.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q));

    // totales respetan el filtro de período activo
    const totalIngresos  = ingFiltrados.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const totalGastos    = gasFiltrados.reduce((a, g) => a + (Number(g.monto) || 0), 0);
    const totalSalarios  = salFiltrados.reduce((a, s) => a + (Number(s.totalNeto) || 0), 0);
    const totalEgresos   = totalGastos + totalSalarios;
    const utilidad       = totalIngresos - totalEgresos;
    const totalPorCobrar = pagos.reduce((a, p) => a + (Number(p.saldoPendiente) || 0), 0);
    const totalCobrado   = pagos.reduce((a, p) => a + (Number(p.valorPagado) || 0), 0);

    const { sorted: ingSorted, Th: ThIng } = useSortable(ingFiltrados, 'fecha');
    const { sorted: gasSorted, Th: ThGas } = useSortable(gasFiltrados, 'fecha');
    const { sorted: salSorted, Th: ThSal } = useSortable(salFiltrados, 'fecha');
    const { sorted: pagSorted, Th: ThPag } = useSortable(pagFiltrados, 'fecha');

    const pagIng  = usePaginacion(ingSorted);
    const pagGas  = usePaginacion(gasSorted);
    const pagSal  = usePaginacion(salSorted);
    const pagPag  = usePaginacion(pagSorted);

    const TABS = [
        { key: 'ingresos', label: <><TrendingUp size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Ingresos</> },
        { key: 'gastos',   label: <><TrendingDown size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Gastos</> },
        { key: 'salarios', label: <><HardHat size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Salarios</> },
        { key: 'pagos',    label: <><CreditCard size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Pagos Clientes</> },
    ];

    // ── Helpers para selects de máquina/operador
    const SelectMaquina = ({ value, onChange }) => (
        <select className="fsel" value={value} onChange={onChange}>
            <option value="">Selecciona una máquina...</option>
            {nomsMaquinas.map(n => <option key={n}>{n}</option>)}
        </select>
    );
    const SelectOperador = ({ value, onChange }) => {
        const ops = [...new Set(maquinas.filter(m => m.operadorNombre).map(m => m.operadorNombre))];
        return (
            <select className="fsel" value={value} onChange={onChange}>
                <option value="">Selecciona un operador...</option>
                {ops.map(n => <option key={n}>{n}</option>)}
            </select>
        );
    };

    if (cargando) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar"><div><h1>Finanzas</h1><p>Cargando...</p></div></div>
            <div className="content"><div className="pad">
                <div className="g3" style={{ marginBottom: '20px' }}>
                    {[1,2,3].map(i => (
                        <div className="skel-card" key={i}>
                            <div className="skel skel-line" style={{ width: '40%' }} />
                            <div className="skel skel-val" />
                            <div className="skel skel-sub" />
                        </div>
                    ))}
                </div>
                <div className="skel-card">
                    <div className="skel skel-line" style={{ width: '60%', marginBottom: '10px' }} />
                    <div className="skel skel-line" style={{ width: '80%', marginBottom: '6px' }} />
                    <div className="skel skel-line" style={{ width: '70%' }} />
                </div>
            </div></div>
        </div>
    );

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Finanzas</h1><p>Ingresos, gastos, salarios y pagos</p></div>
                <div className="tb-r">
                    <button className="bp" onClick={abrirNuevo}><Plus size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> Nuevo</button>
                </div>
            </div>

            <div className="content"><div className="pad">

                {/* RESUMEN */}
                <div className="g3">
                    <div className="card green"><span className="ci"><TrendingUp size={22} /></span><div className="cl">Ingresos</div><div className="cv">{fmt(totalIngresos)}</div><div className="cs">total acumulado</div></div>
                    <div className="card red"><span className="ci"><TrendingDown size={22} /></span><div className="cl">Egresos</div><div className="cv">{fmt(totalEgresos)}</div><div className="cs">gastos + salarios</div></div>
                    <div className="card gold"><span className="ci"><BarChart2 size={22} /></span><div className="cl">Utilidad</div><div className="cv" style={{ color: utilidad >= 0 ? '#27ae60' : '#e74c3c' }}>{fmt(utilidad)}</div><div className="cs">ingresos − egresos</div></div>
                </div>

                {/* FILTRO PERÍODO */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {[
                        { key: 'todo',   label: 'Todo' },
                        { key: 'mes',    label: 'Este mes' },
                        { key: 'ultimo', label: 'Mes anterior' },
                        { key: 'anio',   label: 'Este año' },
                        { key: 'rango',  label: 'Personalizado' },
                    ].map(f => (
                        <button key={f.key}
                            onClick={() => setPeriodoFiltro(f.key)}
                            style={{
                                padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none',
                                background: periodoFiltro === f.key ? '#1a2d42' : '#f0f2f5',
                                color: periodoFiltro === f.key ? '#fff' : '#6b7a8d',
                                transition: 'all .15s',
                            }}>
                            {f.label}
                        </button>
                    ))}
                    {periodoFiltro === 'rango' && (
                        <>
                            <input type="date" className="fi"
                                style={{ margin: 0, width: 'auto', padding: '4px 10px', fontSize: '12px' }}
                                value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                            <span style={{ fontSize: '12px', color: '#6b7a8d' }}>→</span>
                            <input type="date" className="fi"
                                style={{ margin: 0, width: 'auto', padding: '4px 10px', fontSize: '12px' }}
                                value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                        </>
                    )}
                </div>

                {/* TABS */}
                <div className="tabs">
                    {TABS.map(t => (
                        <button key={t.key} className={`tab ${tab === t.key ? 'on' : ''}`}
                            onClick={() => { setTab(t.key); setMostrarForm(false); setEditandoId(null); setBuscar(''); }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── FORM INGRESOS ── */}
                {mostrarForm && tab === 'ingresos' && (
                    <div className="fc">
                        <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><TrendingUp size={18} /> {editandoId ? 'Editar' : 'Registrar'} Ingreso</h3>
                        <div className="fg2">
                            <div><label className="fl">Máquina *</label><SelectMaquina value={formIng.maquinaNombre} onChange={e => setFormIng({ ...formIng, maquinaNombre: e.target.value })} /></div>
                            <div><label className="fl">Tipo de trabajo</label>
                                <select className="fsel" value={formIng.tipoTrabajo} onChange={e => setFormIng({ ...formIng, tipoTrabajo: e.target.value })}>
                                    <option>Horas</option><option>Hectáreas</option><option>M³</option><option>Viajes</option><option>M²</option>
                                </select>
                            </div>
                        </div>
                        <div className="fg3">
                            <div><label className="fl">Cantidad</label><input className="fi" type="number" inputMode="decimal" value={formIng.cantidad} onChange={e => setFormIng({ ...formIng, cantidad: e.target.value })} /></div>
                            <div><label className="fl">Valor unitario ($)</label><MoneyInput className="fi" value={formIng.valorUnitario} onChange={e => setFormIng({ ...formIng, valorUnitario: e.target.value })} /></div>
                            <div><label className="fl">Fecha</label><input className="fi" type="date" value={formIng.fecha} onChange={e => setFormIng({ ...formIng, fecha: e.target.value })} /></div>
                        </div>
                        <div><label className="fl">Descripción</label><input className="fi" value={formIng.descripcion} onChange={e => setFormIng({ ...formIng, descripcion: e.target.value })} placeholder="Ej: Obra Av. 30" /></div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={guardar}><Check size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> {editandoId ? 'Actualizar' : 'Guardar'}</button>
                            <button className="bs" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* ── FORM GASTOS ── */}
                {mostrarForm && tab === 'gastos' && (
                    <div className="fc">
                        <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><TrendingDown size={18} /> {editandoId ? 'Editar' : 'Registrar'} Gasto</h3>
                        <div className="fg2">
                            <div><label className="fl">Máquina *</label><SelectMaquina value={formGas.maquinaNombre} onChange={e => setFormGas({ ...formGas, maquinaNombre: e.target.value })} /></div>
                            <div><label className="fl">Categoría</label>
                                <select className="fsel" value={formGas.categoria} onChange={e => setFormGas({ ...formGas, categoria: e.target.value })}>
                                    <option value="">Selecciona...</option>
                                    <option>Combustible</option><option>Mantenimiento</option><option>Repuestos</option><option>Otros</option>
                                </select>
                            </div>
                        </div>
                        <div className="fg2">
                            <div><label className="fl">Monto ($)</label><MoneyInput className="fi" value={formGas.monto} onChange={e => setFormGas({ ...formGas, monto: e.target.value })} /></div>
                            <div><label className="fl">Fecha</label><input className="fi" type="date" value={formGas.fecha} onChange={e => setFormGas({ ...formGas, fecha: e.target.value })} /></div>
                        </div>
                        <div><label className="fl">Descripción</label><input className="fi" value={formGas.descripcion} onChange={e => setFormGas({ ...formGas, descripcion: e.target.value })} placeholder="Ej: Mantenimiento preventivo" /></div>
                        <div>
                            <label className="fl">Factura (PDF)</label>
                            {editandoId && facturasIds.has(String(editandoId)) && !gastoFactura ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <div className="fi" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                        <FileText size={14} style={{ color: '#e74c3c', flexShrink: 0 }} />
                                        <span style={{ fontSize: '13px', flex: 1 }}>Factura adjunta</span>
                                        <button type="button" className="icon-btn" title="Ver factura"
                                            onClick={() => abrirFactura(editandoId)}>
                                            <FileText size={13} style={{ color: '#e74c3c' }} />
                                        </button>
                                    </div>
                                    <label className="bs" style={{ cursor: 'pointer', padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                        <Paperclip size={13} /> Cambiar
                                        <input type="file" accept="application/pdf" style={{ display: 'none' }}
                                            onChange={e => setGastoFactura(e.target.files[0] || null)} />
                                    </label>
                                    <button className="bs" style={{ padding: '6px 10px', fontSize: '12px', color: '#e74c3c', whiteSpace: 'nowrap' }}
                                        onClick={async () => { await eliminarFactura(editandoId).catch(() => {}); setFacturasIds(prev => { const s = new Set(prev); s.delete(String(editandoId)); return s; }); }}>
                                        × Quitar
                                    </button>
                                </div>
                            ) : (
                                <label className="fi" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Paperclip size={14} style={{ color: gastoFactura ? '#2980b9' : '#9aa5b4', flexShrink: 0 }} />
                                    <span style={{ color: gastoFactura ? '#1a1a2e' : '#9aa5b4', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                        {gastoFactura ? gastoFactura.name : 'Adjuntar factura (opcional)'}
                                    </span>
                                    {gastoFactura && (
                                        <span style={{ color: '#e74c3c', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}
                                            onClick={e => { e.preventDefault(); setGastoFactura(null); }}>×</span>
                                    )}
                                    <input type="file" accept="application/pdf" style={{ display: 'none' }}
                                        onChange={e => setGastoFactura(e.target.files[0] || null)} />
                                </label>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={guardar}><Check size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> {editandoId ? 'Actualizar' : 'Guardar'}</button>
                            <button className="bs" onClick={() => { setMostrarForm(false); setEditandoId(null); setGastoFactura(null); }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* ── FORM SALARIOS ── */}
                {mostrarForm && tab === 'salarios' && (
                    <div className="fc">
                        <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><HardHat size={18} /> {editandoId ? 'Editar' : 'Registrar'} Salario</h3>
                        <div className="fg2">
                            <div><label className="fl">Operador *</label><SelectOperador value={formSal.operadorNombre} onChange={e => {
                                const op = maquinas.find(m => m.operadorNombre === e.target.value);
                                setFormSal({ ...formSal, operadorNombre: e.target.value, maquinaNombre: op?.nombre || formSal.maquinaNombre, valorHora: op?.valorHoraOperador || formSal.valorHora });
                            }} /></div>
                            <div><label className="fl">Máquina</label><SelectMaquina value={formSal.maquinaNombre} onChange={e => setFormSal({ ...formSal, maquinaNombre: e.target.value })} /></div>
                        </div>
                        <div className="fg3">
                            <div><label className="fl">Horas trabajadas</label><input className="fi" type="number" inputMode="decimal" value={formSal.horasTrabajadas} onChange={e => setFormSal({ ...formSal, horasTrabajadas: e.target.value })} /></div>
                            <div><label className="fl">Valor por hora ($)</label><MoneyInput className="fi" value={formSal.valorHora} onChange={e => setFormSal({ ...formSal, valorHora: e.target.value })} /></div>
                            <div><label className="fl">Anticipos ($)</label><MoneyInput className="fi" value={formSal.anticipos} onChange={e => setFormSal({ ...formSal, anticipos: e.target.value })} /></div>
                        </div>
                        <div className="fg2">
                            <div><label className="fl">Estado</label>
                                <select className="fsel" value={formSal.estado} onChange={e => setFormSal({ ...formSal, estado: e.target.value })}>
                                    <option>Pendiente</option><option>Pagado</option>
                                </select>
                            </div>
                            <div><label className="fl">Fecha</label><input className="fi" type="date" value={formSal.fecha} onChange={e => setFormSal({ ...formSal, fecha: e.target.value })} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={guardar}><Check size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> {editandoId ? 'Actualizar' : 'Guardar'}</button>
                            <button className="bs" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* ── FORM PAGOS ── */}
                {mostrarForm && tab === 'pagos' && (
                    <div className="fc">
                        <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><CreditCard size={18} /> {editandoId ? 'Editar' : 'Registrar'} Pago de Cliente</h3>
                        <div className="fg2">
                            <div><label className="fl">Cliente *</label><input className="fi" value={formPag.cliente} onChange={e => setFormPag({ ...formPag, cliente: e.target.value })} placeholder="Nombre del cliente" /></div>
                            <div><label className="fl">Máquina *</label><SelectMaquina value={formPag.maquinaNombre} onChange={e => setFormPag({ ...formPag, maquinaNombre: e.target.value })} /></div>
                        </div>
                        <div><label className="fl">Descripción</label><input className="fi" value={formPag.descripcion} onChange={e => setFormPag({ ...formPag, descripcion: e.target.value })} placeholder="Ej: Obra Avenida 30" /></div>
                        <div className="fg3">
                            <div><label className="fl">Valor total ($)</label><MoneyInput className="fi" value={formPag.valorTotal} onChange={e => setFormPag({ ...formPag, valorTotal: e.target.value })} /></div>
                            <div><label className="fl">Valor pagado ($)</label><MoneyInput className="fi" value={formPag.valorPagado} onChange={e => setFormPag({ ...formPag, valorPagado: e.target.value })} /></div>
                            <div><label className="fl">Fecha</label><input className="fi" type="date" value={formPag.fecha} onChange={e => setFormPag({ ...formPag, fecha: e.target.value })} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={guardar}><Check size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> {editandoId ? 'Actualizar' : 'Guardar'}</button>
                            <button className="bs" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* ── TABLA INGRESOS ── */}
                {tab === 'ingresos' && (
                    <div className="tbl">
                        <div className="th">
                            <strong style={{display:'flex',alignItems:'center',gap:'5px'}}><TrendingUp size={14} /> Ingresos</strong>
                            <div className="th-s"><Search size={14} /><input type="text" placeholder="Buscar..." value={buscar} onChange={e => setBuscar(e.target.value)} /></div>
                            <a onClick={abrirNuevo}>+ Agregar</a>
                        </div>
                        <div className="tr hdr"><ThIng campo="fecha">Fecha</ThIng><ThIng campo="descripcion" className="w2">Descripción</ThIng><ThIng campo="maquinaNombre">Máquina</ThIng><ThIng campo="tipoTrabajo">Tipo</ThIng><ThIng campo="total">Total</ThIng><span>Acc.</span></div>
                        {ingFiltrados.length === 0 && <p className="vacio">Sin registros</p>}
                        {pagIng.paginados.map(i => (
                            <div className="tr" key={i.id}>
                                <span>{fmtFecha(i.fecha)}</span><span className="w2">{i.descripcion}</span><span>{i.maquinaNombre}</span>
                                <span><span className="b hrs">{i.tipoTrabajo}</span></span>
                                <span className="pos">{fmt(i.total)}</span>
                                <span style={{ display: 'flex', gap: '4px' }}>
                                    <button className="icon-btn" onClick={() => abrirEditar(i)}><Pencil size={14} /></button>
                                    <button className="icon-btn" onClick={() => eliminar('ingresos', i.id)}><Trash2 size={14} /></button>
                                </span>
                            </div>
                        ))}
                        <Paginacion pagina={pagIng.pagina} total={pagIng.total} ir={pagIng.ir} totalItems={ingFiltrados.length} porPagina={25} />
                    </div>
                )}

                {/* ── TABLA GASTOS ── */}
                {tab === 'gastos' && (
                    <div className="tbl">
                        <div className="th">
                            <strong style={{display:'flex',alignItems:'center',gap:'5px'}}><TrendingDown size={14} /> Gastos</strong>
                            <div className="th-s"><Search size={14} /><input type="text" placeholder="Buscar..." value={buscar} onChange={e => setBuscar(e.target.value)} /></div>
                            <a onClick={abrirNuevo}>+ Agregar</a>
                        </div>
                        <div className="tr hdr"><ThGas campo="fecha">Fecha</ThGas><ThGas campo="descripcion" className="w2">Descripción</ThGas><ThGas campo="categoria">Categoría</ThGas><ThGas campo="maquinaNombre">Máquina</ThGas><ThGas campo="monto">Monto</ThGas><span>Acc.</span></div>
                        {gasFiltrados.length === 0 && <p className="vacio">Sin registros</p>}
                        {pagGas.paginados.map(g => {
                            const esCombAuto = g.descripcion?.includes('Combustible —');
                            const esSalAuto  = g.categoria === 'Salario' && g.descripcion?.startsWith('Salario —');
                            const esMantAuto = g.categoria === 'Mantenimiento' && g.descripcion?.startsWith('Mantenimiento —');
                            const autoIcon   = esCombAuto
                                ? <Fuel size={10} />
                                : esSalAuto ? <HardHat size={10} />
                                : esMantAuto ? <Wrench size={10} /> : null;
                            const autoTip    = esCombAuto ? 'Auto desde Combustible'
                                : esSalAuto ? 'Auto desde Salarios'
                                : esMantAuto ? 'Auto desde Mantenimientos' : '';
                            return (
                            <div className="tr" key={g.id}>
                                <span>{fmtFecha(g.fecha)}</span><span className="w2">{g.descripcion}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    {g.categoria}
                                    {autoIcon && (
                                        <span title={autoTip}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#fff3e0', border: '1px solid #e67e22', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', color: '#e67e22', fontWeight: '700', lineHeight: 1.4 }}>
                                            {autoIcon} Auto
                                        </span>
                                    )}
                                </span>
                                <span>{g.maquinaNombre}</span>
                                <span className="neg">{fmt(g.monto)}</span>
                                <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    {facturasIds.has(String(g.id)) && (
                                        <button className="icon-btn" title="Ver factura" onClick={() => abrirFactura(g.id)}>
                                            <FileText size={14} style={{ color: '#e74c3c' }} />
                                        </button>
                                    )}
                                    <label className="icon-btn" title={facturasIds.has(String(g.id)) ? 'Cambiar factura PDF' : 'Adjuntar factura PDF'}
                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Paperclip size={14} style={{ color: facturasIds.has(String(g.id)) ? '#e67e22' : '#9aa5b4' }} />
                                        <input type="file" accept="application/pdf" style={{ display: 'none' }}
                                            onChange={async e => {
                                                if (e.target.files[0]) {
                                                    await guardarFactura(g.id, e.target.files[0]).catch(console.error);
                                                    setFacturasIds(prev => new Set([...prev, String(g.id)]));
                                                }
                                            }} />
                                    </label>
                                    {facturasIds.has(String(g.id)) && (
                                        <button className="icon-btn" title="Quitar factura" onClick={async () => {
                                            await eliminarFactura(g.id).catch(() => {});
                                            setFacturasIds(prev => { const s = new Set(prev); s.delete(String(g.id)); return s; });
                                        }}>
                                            <X size={14} style={{ color: '#9aa5b4' }} />
                                        </button>
                                    )}
                                    <button className="icon-btn" onClick={() => abrirEditar(g)}><Pencil size={14} /></button>
                                    <button className="icon-btn" onClick={() => eliminar('gastos', g.id)}><Trash2 size={14} /></button>
                                </span>
                            </div>
                            );
                        })}
                        <Paginacion pagina={pagGas.pagina} total={pagGas.total} ir={pagGas.ir} totalItems={gasFiltrados.length} porPagina={25} />
                    </div>
                )}

                {/* ── TABLA SALARIOS ── */}
                {tab === 'salarios' && (
                    <div className="ale" style={{ background: '#f0f7ff', borderColor: '#2980b9', marginBottom: '8px' }}>
                        <Info size={16} style={{ color: '#2980b9', flexShrink: 0 }} />
                        <div>
                            <p style={{ color: '#1a2d42', margin: 0 }}>Cada salario genera automáticamente un Gasto — así se incluye en el P&L. Los <strong>anticipos</strong> se descuentan del neto, pero si fueron pagados en una fecha distinta deberías registrarlos también como un Gasto separado con la fecha real.</p>
                        </div>
                    </div>
                )}
                {tab === 'salarios' && (
                    <div className="tbl">
                        <div className="th">
                            <strong style={{display:'flex',alignItems:'center',gap:'5px'}}><HardHat size={14} /> Salarios</strong>
                            <div className="th-s"><Search size={14} /><input type="text" placeholder="Buscar..." value={buscar} onChange={e => setBuscar(e.target.value)} /></div>
                            <a onClick={abrirNuevo}>+ Registrar Pago</a>
                        </div>
                        <div className="tr hdr"><ThSal campo="operadorNombre" className="w2">Operador</ThSal><ThSal campo="horasTrabajadas">Horas</ThSal><span>$/Hora</span><ThSal campo="totalBruto">Bruto</ThSal><span>Anticipos</span><ThSal campo="totalNeto">Neto</ThSal><ThSal campo="estado">Estado</ThSal><span>Acc.</span></div>
                        {salFiltrados.length === 0 && <p className="vacio">Sin registros</p>}
                        {pagSal.paginados.map(s => (
                            <div className="tr" key={s.id}>
                                <span className="w2">{s.operadorNombre}</span><span>{s.horasTrabajadas} hrs</span>
                                <span>{fmt(s.valorHora)}</span><span className="pos">{fmt(s.totalBruto)}</span>
                                <span className="neg">-{fmt(s.anticipos)}</span><span className="pos">{fmt(s.totalNeto)}</span>
                                <span><span className={`b ${s.estado === 'Pagado' ? 'ok' : 'pend'}`}>{s.estado}</span></span>
                                <span style={{ display: 'flex', gap: '4px' }}>
                                    <button className="icon-btn" onClick={() => abrirEditar(s)}><Pencil size={14} /></button>
                                    <button className="icon-btn" onClick={() => eliminar('salarios', s.id)}><Trash2 size={14} /></button>
                                </span>
                            </div>
                        ))}
                        <Paginacion pagina={pagSal.pagina} total={pagSal.total} ir={pagSal.ir} totalItems={salFiltrados.length} porPagina={25} />
                    </div>
                )}

                {/* ── TABLA PAGOS ── */}
                {tab === 'pagos' && (
                    <>
                        <div className="ale" style={{ background: '#f0f7ff', borderColor: '#2980b9', marginBottom: '8px' }}>
                            <Info size={16} style={{ color: '#2980b9', flexShrink: 0 }} />
                            <div>
                                <p style={{ color: '#1a2d42', margin: 0 }}>Los pagos de clientes son seguimiento de cobros — <strong>no se suman al total de Ingresos</strong>. Registra el trabajo en la pestaña Ingresos y usa esta pestaña para rastrear cuánto te han pagado.</p>
                            </div>
                        </div>
                        <div className="g2" style={{ marginBottom: '14px' }}>
                            <div className="dbox"><div style={{ fontSize: '12px', fontWeight: '700', color: '#e74c3c', display:'flex', alignItems:'center', gap:'4px' }}><TrendingDown size={13} /> Por cobrar</div><div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '24px', fontWeight: '800', color: '#e74c3c' }}>{fmt(totalPorCobrar)}</div></div>
                            <div className="cbox"><div style={{ fontSize: '12px', fontWeight: '700', color: '#27ae60', display:'flex', alignItems:'center', gap:'4px' }}><CheckCircle size={13} /> Cobrado</div><div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '24px', fontWeight: '800', color: '#27ae60' }}>{fmt(totalCobrado)}</div></div>
                        </div>
                        <div className="tbl">
                            <div className="th">
                                <strong style={{display:'flex',alignItems:'center',gap:'5px'}}><CreditCard size={14} /> Pagos de Clientes</strong>
                                <div className="th-s"><Search size={14} /><input type="text" placeholder="Buscar..." value={buscar} onChange={e => setBuscar(e.target.value)} /></div>
                                <a onClick={abrirNuevo}>+ Nuevo</a>
                            </div>
                            <div className="tr hdr"><ThPag campo="fecha">Fecha</ThPag><ThPag campo="cliente" className="w2">Cliente</ThPag><ThPag campo="maquinaNombre">Máquina</ThPag><ThPag campo="valorTotal">Total</ThPag><ThPag campo="valorPagado">Pagado</ThPag><ThPag campo="saldoPendiente">Saldo</ThPag><ThPag campo="estado">Estado</ThPag><span>Acc.</span></div>
                            {pagFiltrados.length === 0 && <p className="vacio">Sin registros</p>}
                            {pagPag.paginados.map(p => {
                                // #11: advertir si lo cobrado en pagos supera los ingresos registrados para esa máquina
                                const ingMaq = ingresos.filter(i => i.maquinaNombre === p.maquinaNombre)
                                    .reduce((a, i) => a + (Number(i.total) || 0), 0);
                                const pagMaq = pagos.filter(x => x.maquinaNombre === p.maquinaNombre)
                                    .reduce((a, x) => a + (Number(x.valorPagado) || 0), 0);
                                const sobrecobro = pagMaq > ingMaq && ingMaq > 0;
                                return (
                                <div className="tr" key={p.id} style={sobrecobro ? { background: '#fff8e7' } : {}}>
                                    <span>{fmtFecha(p.fecha)}</span><span className="w2">{p.cliente}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {p.maquinaNombre}
                                        {sobrecobro && <span title={`Cobrado total (${fmt(pagMaq)}) supera ingresos registrados (${fmt(ingMaq)}) para esta máquina`} style={{ color: '#e67e22', cursor: 'help' }}><AlertTriangle size={12} /></span>}
                                    </span>
                                    <span>{fmt(p.valorTotal)}</span><span className="pos">{fmt(p.valorPagado)}</span><span className="neg">{fmt(p.saldoPendiente)}</span>
                                    <span><span className={`b ${p.estado === 'Pagado' ? 'pag' : p.estado === 'Parcial' ? 'par' : 'deu'}`}>{p.estado}</span></span>
                                    <span style={{ display: 'flex', gap: '4px' }}>
                                        <button className="icon-btn" onClick={() => abrirEditar(p)}><Pencil size={14} /></button>
                                        <button className="icon-btn" onClick={() => eliminar('pagos', p.id)}><Trash2 size={14} /></button>
                                    </span>
                                </div>
                                );
                            })}
                            <Paginacion pagina={pagPag.pagina} total={pagPag.total} ir={pagPag.ir} totalItems={pagFiltrados.length} porPagina={25} />
                        </div>
                    </>
                )}

            </div></div>
        </div>
        </>
    );
}

export default Finanzas;
