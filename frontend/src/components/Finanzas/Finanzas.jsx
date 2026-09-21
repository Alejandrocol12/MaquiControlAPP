import { useState, useEffect } from 'react';
import { usePaginacion, Paginacion } from '../../utils/Paginacion';
import { useSortable } from '../../utils/useSortable';
import {
    getMaquinas,
    getIngresos, createIngreso, updateIngreso, deleteIngreso,
    getGastos, createGasto, updateGasto, deleteGasto,
    getSalarios, createSalario, updateSalario, deleteSalario,
    getPagos, createPago, updatePago, deletePago,
    getFaenas,
} from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import { TrendingUp, TrendingDown, BarChart2, Plus, Check, Pencil, Trash2, HardHat, CreditCard, FileText, Paperclip, X, Search, Fuel, Wrench, Info, AlertTriangle, ChevronDown, ChevronUp, Tractor } from 'lucide-react';
import MoneyInput from '../../utils/MoneyInput';
import { fmtFecha } from '../../utils/fmtFecha';
import { guardarFactura, eliminarFactura, abrirFactura } from '../../utils/facturaAPI';
import './Finanzas.css';

const fmt = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().split('T')[0];

const FORM_ING  = { descripcion: '', tipoTrabajo: 'Horas', cantidad: 0, valorUnitario: 0, fecha: hoy(), maquinaNombre: '' };
const FORM_GAS  = { descripcion: '', categoria: '', monto: 0, fecha: hoy(), maquinaNombre: '' };
// Sugerencias fijas del selector de categoría — no se le agregan categorías personalizadas
// que el usuario haya escrito antes, para que el picker no crezca sin control
const CATEGORIAS_SUGERIDAS_GASTO = ['Reparación', 'Repuestos', 'Combustible', 'Lubricantes'];
const FORM_SAL  = { operadorNombre: '', maquinaNombre: '', horasTrabajadas: 0, valorHora: 0, anticipos: 0, estado: 'Pendiente', fecha: hoy() };
const FORM_PAG  = { cliente: '', maquinaNombre: '', descripcion: '', valorTotal: 0, valorPagado: 0, fecha: hoy() };

const CATEGORIA_CLASE = {
    'Reparación': 'info', 'Repuestos': 'gold', 'Combustible': 'orange',
    'Mantenimiento': 'golddeep', 'Salario': 'purple', 'Lubricantes': 'purple',
    'Otros': 'neutral', 'Otro': 'neutral',
};
const claseCategoria = (cat) => CATEGORIA_CLASE[cat] || 'neutral';

const GRID = {
    ingresos: '70px 1.8fr 1fr 84px 90px 104px 60px',
    gastos:   '70px 1.6fr 120px 1fr 100px 150px',
    salarios: '1.3fr 64px 84px 96px 96px 96px 84px 60px',
    pagos:    '70px 1.3fr 1fr 96px 96px 96px 84px 60px',
};

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

// Agrupa Ingresos/Gastos de una máquina por periodo — el nombre y el total colapsados,
// el detalle solo aparece al hacer clic (mismo patrón de acordeón usado en Faenas.jsx).
function GruposPeriodo({ grupos, periodoAbierto, setPeriodoAbierto, cols, tono, renderFila }) {
    if (grupos.length === 0) return <p className="fin-vacio">Sin registros para esta máquina</p>;
    return (
        <div style={{ padding: '12px 18px' }}>
            {grupos.map(g => {
                const abierto = periodoAbierto === g.id;
                return (
                    <div className={`fin-percard ${abierto ? 'open' : ''}`} key={g.id}>
                        <div className="fin-perhead" onClick={() => setPeriodoAbierto(abierto ? null : g.id)}>
                            <span className={`dot ${g.activa ? '' : 'cerrado'}`}></span>
                            <div className="fin-perinfo">
                                <div className="t">{g.nombre}</div>
                                {g.rango && <div className="s">{g.rango}</div>}
                            </div>
                            <div className={`fin-pertotal ${tono === 'neg' ? 'neg' : ''} fin-num`}>{fmt(g.total)}</div>
                            {abierto ? <ChevronUp size={16} className="fin-perchev" /> : <ChevronDown size={16} className="fin-perchev" />}
                        </div>
                        {abierto && (
                            <div className="fin-perbody">
                                {g.items.length === 0 && <p className="fin-vacio">Sin registros en este periodo</p>}
                                {g.items.map(item => (
                                    <div className="fin-lrow" key={item.id} style={{ gridTemplateColumns: cols }}>
                                        {renderFila(item)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function Finanzas({ tabInicial = 'ingresos' }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [tab, setTab]           = useState(tabInicial);
    const [maquinas, setMaquinas] = useState([]);
    const [ingresos, setIngresos] = useState([]);
    const [gastos, setGastos]     = useState([]);
    const [salarios, setSalarios] = useState([]);
    const [pagos, setPagos]       = useState([]);
    const [faenas, setFaenas]     = useState([]);

    const [maqFiltro, setMaqFiltro]         = useState('');
    const [periodoAbierto, setPeriodoAbierto] = useState(null);

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
            getFaenas(),
        ]).then(([maqR, ingR, gasR, salR, pagR, faeR]) => {
            setMaquinas(maqR.data);
            setIngresos(ingR.data);
            setGastos(gasR.data);
            setFacturasIds(new Set((gasR.data || []).filter(g => g.tieneFactura).map(g => String(g.id))));
            setSalarios(salR.data);
            setPagos((pagR.data || []).map(normalizarPago));
            setFaenas(faeR.data || []);
        }).catch(console.error).finally(() => setCargando(false));
    };

    const abrirNuevo = () => {
        setEditandoId(null);
        setFormIng(FORM_ING); setFormGas(FORM_GAS); setFormSal(FORM_SAL); setFormPag(FORM_PAG);
        setGastoFactura(null);
        setMostrarForm(true);
    };

    const abrirEditar = (item) => {
        setEditandoId(item.id);
        if (tab === 'ingresos') setFormIng({ ...item });
        if (tab === 'gastos')   setFormGas({ ...item });
        if (tab === 'salarios') setFormSal({ ...item });
        if (tab === 'pagos')    setFormPag(normalizarPago(item));
        setGastoFactura(null);
        setMostrarForm(true);
    };

    const cerrarCompose = () => {
        setMostrarForm(false);
        setEditandoId(null);
        setGastoFactura(null);
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
    const ingPeriodo = porFecha([...ingresos].reverse(), 'fecha');
    const gasPeriodo = porFecha([...gastos].reverse(), 'fecha').filter(g => g.categoria !== 'Salario');
    const salPeriodo = porFecha([...salarios].reverse(), 'fecha');
    const pagPeriodo = porFecha([...pagos].reverse(), 'fecha');

    const ingFiltrados = ingPeriodo.filter(i => !q || i.descripcion?.toLowerCase().includes(q) || i.maquinaNombre?.toLowerCase().includes(q) || i.tipoTrabajo?.toLowerCase().includes(q)).filter(i => !maqFiltro || i.maquinaNombre === maqFiltro);
    const gasFiltrados = gasPeriodo.filter(g => !q || g.descripcion?.toLowerCase().includes(q) || g.maquinaNombre?.toLowerCase().includes(q) || g.categoria?.toLowerCase().includes(q)).filter(g => !maqFiltro || g.maquinaNombre === maqFiltro);
    const salFiltrados = salPeriodo.filter(s => !q || s.operadorNombre?.toLowerCase().includes(q) || s.maquinaNombre?.toLowerCase().includes(q)).filter(s => !maqFiltro || s.maquinaNombre === maqFiltro);
    const pagFiltrados = pagPeriodo.filter(p => !q || p.cliente?.toLowerCase().includes(q) || p.maquinaNombre?.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q)).filter(p => !maqFiltro || p.maquinaNombre === maqFiltro);

    // Periodos (faenas) de la máquina seleccionada, para agrupar Ingresos/Gastos por periodo
    // en vez de mostrar todo el historial plano — más recientes primero.
    const periodosDeMaqFiltro = maqFiltro
        ? faenas.filter(f => f.maquinaNombre === maqFiltro).sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''))
        : [];
    const agruparPorPeriodo = (items, campoTotal) => {
        const grupos = periodosDeMaqFiltro.map(f => {
            const propios = items.filter(x => String(x.faenaId) === String(f.id));
            return {
                id: String(f.id),
                nombre: f.nombreObra || 'Periodo',
                activa: f.estado === 'activa',
                rango: f.estado === 'activa' ? `Activo desde ${fmtFecha(f.fechaInicio)}` : `${fmtFecha(f.fechaInicio)} → ${fmtFecha(f.fechaFin)}`,
                items: propios,
                total: propios.reduce((a, x) => a + (Number(x[campoTotal]) || 0), 0),
            };
        });
        const idsConocidos = new Set(periodosDeMaqFiltro.map(f => String(f.id)));
        const sinPeriodo = items.filter(x => !x.faenaId || !idsConocidos.has(String(x.faenaId)));
        if (sinPeriodo.length) {
            grupos.push({
                id: 'sin-periodo', nombre: 'Sin periodo asignado', activa: false, rango: '',
                items: sinPeriodo, total: sinPeriodo.reduce((a, x) => a + (Number(x[campoTotal]) || 0), 0),
            });
        }
        return grupos;
    };

    // totales respetan el filtro de período activo
    const totalIngresos  = ingFiltrados.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const totalGastos    = gasFiltrados.reduce((a, g) => a + (Number(g.monto) || 0), 0);
    const totalSalarios  = salFiltrados.reduce((a, s) => a + (Number(s.totalNeto) || 0), 0);
    const totalEgresos   = totalGastos + totalSalarios;
    const utilidad       = totalIngresos - totalEgresos;
    const margen         = totalIngresos > 0 ? Math.round((utilidad / totalIngresos) * 100) : 0;

    // cobranza: ignora el filtro de período (es saldo vivo, no un movimiento del mes), pero sí
    // respeta la máquina seleccionada — si no, "Ver finanzas de X" mostraba cobranza de otras máquinas.
    const pagosCobranza     = maqFiltro ? pagos.filter(p => p.maquinaNombre === maqFiltro) : pagos;
    const totalPorCobrar   = pagosCobranza.reduce((a, p) => a + (Number(p.saldoPendiente) || 0), 0);
    const totalCobrado     = pagosCobranza.reduce((a, p) => a + (Number(p.valorPagado) || 0), 0);
    const totalContratado  = pagosCobranza.reduce((a, p) => a + (Number(p.valorTotal) || 0), 0);
    const pctCobrado       = totalContratado > 0 ? Math.round((totalCobrado / totalContratado) * 100) : 0;

    const { sorted: ingSorted, Th: ThIng } = useSortable(ingFiltrados, 'fecha');
    const { sorted: gasSorted, Th: ThGas } = useSortable(gasFiltrados, 'fecha');
    const { sorted: salSorted, Th: ThSal } = useSortable(salFiltrados, 'fecha');
    const { sorted: pagSorted, Th: ThPag } = useSortable(pagFiltrados, 'fecha');

    const pagIng  = usePaginacion(ingSorted, 20);
    const pagGas  = usePaginacion(gasSorted, 20);
    const pagSal  = usePaginacion(salSorted, 20);
    const pagPag  = usePaginacion(pagSorted, 20);

    const TABS = [
        { key: 'ingresos', label: 'Ingresos', icon: <TrendingUp size={14} />, count: ingPeriodo.length },
        { key: 'gastos',   label: 'Gastos',   icon: <TrendingDown size={14} />, count: gasPeriodo.length },
        { key: 'salarios', label: 'Salarios', icon: <HardHat size={14} />, count: salPeriodo.length },
        { key: 'pagos',    label: 'Pagos Clientes', icon: <CreditCard size={14} />, count: pagPeriodo.length },
    ];

    // ── Helpers para selects de máquina/operador
    const SelectMaquina = ({ value, onChange }) => (
        <select className="fin-select" value={value} onChange={onChange}>
            <option value="">Selecciona una máquina...</option>
            {nomsMaquinas.map(n => <option key={n}>{n}</option>)}
        </select>
    );
    const SelectOperador = ({ value, onChange }) => {
        const ops = [...new Set(maquinas.filter(m => m.operadorNombre).map(m => m.operadorNombre))];
        return (
            <select className="fin-select" value={value} onChange={onChange}>
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

    const footTotal = tab === 'ingresos' ? totalIngresos
        : tab === 'gastos' ? totalGastos
        : tab === 'salarios' ? totalSalarios
        : pagFiltrados.reduce((a, p) => a + (Number(p.valorPagado) || 0), 0);
    const footLabel = tab === 'pagos' ? 'Cobrado en el periodo' : 'Total del periodo';
    const footTono = tab === 'ingresos' ? 'pos' : tab === 'pagos' ? 'pos' : 'neg';
    const listaTab = { ingresos: ingFiltrados, gastos: gasFiltrados, salarios: salFiltrados, pagos: pagFiltrados }[tab];
    const paginadosTab = { ingresos: pagIng, gastos: pagGas, salarios: pagSal, pagos: pagPag }[tab];

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

                {/* HERO: 4 KPIs incluyendo cobranza */}
                <div className="fin-hero">
                    <div className="fin-kpi good">
                        <div className="fin-kpi-top"><span className="fin-kpi-label">Ingresos</span><span className="fin-kpi-ico"><TrendingUp size={14} /></span></div>
                        <div className="fin-kpi-val fin-num">{fmt(totalIngresos)}</div>
                        <div className="fin-kpi-sub">{ingFiltrados.length} registros</div>
                    </div>
                    <div className="fin-kpi bad">
                        <div className="fin-kpi-top"><span className="fin-kpi-label">Egresos</span><span className="fin-kpi-ico"><TrendingDown size={14} /></span></div>
                        <div className="fin-kpi-val fin-num">{fmt(totalEgresos)}</div>
                        <div className="fin-kpi-sub">{gasFiltrados.length} gastos + {salFiltrados.length} nóminas</div>
                    </div>
                    <div className="fin-kpi profit">
                        <div className="fin-kpi-top"><span className="fin-kpi-label">Utilidad</span><span className="fin-kpi-ico"><BarChart2 size={14} /></span></div>
                        <div className="fin-kpi-val fin-num">{fmt(utilidad)}</div>
                        <div className="fin-kpi-sub">margen del {margen}%</div>
                    </div>
                    <div className="fin-kpi cobranza">
                        <div className="fin-kpi-top"><span className="fin-kpi-label">Cobranza</span><span className="fin-kpi-ico" style={{ background: 'rgba(41,128,185,.1)', color: '#2980b9' }}><CreditCard size={14} /></span></div>
                        <div className="fin-cob-nums"><span className="a fin-num">{fmt(totalCobrado)}</span><span className="b fin-num">de {fmt(totalContratado)}</span></div>
                        <div className="fin-cob-track"><div className="fin-cob-fill" style={{ width: `${Math.min(pctCobrado, 100)}%` }} /></div>
                        <div className="fin-cob-foot"><span>{pctCobrado}% cobrado</span>{totalPorCobrar > 0 && <span className="warn">{fmt(totalPorCobrar)} por cobrar</span>}</div>
                    </div>
                </div>

                {/* SELECCIONAR MÁQUINA */}
                <div className="fin-machinebar">
                    <Tractor size={15} />
                    <label>Ver finanzas de</label>
                    <select className="fin-select" style={{ width: 'auto', minWidth: '220px' }}
                        value={maqFiltro}
                        onChange={e => { setMaqFiltro(e.target.value); setPeriodoAbierto(null); }}>
                        <option value="">Todas las máquinas</option>
                        {nomsMaquinas.map(n => <option key={n}>{n}</option>)}
                    </select>
                    {maqFiltro && (tab === 'ingresos' || tab === 'gastos') && (
                        <span className="fin-machinebar-note">Agrupado por periodo — clic en uno para ver el detalle</span>
                    )}
                </div>

                {/* FILTRO PERÍODO */}
                <div className="fin-filters">
                    {[
                        { key: 'todo',   label: 'Todo' },
                        { key: 'mes',    label: 'Este mes' },
                        { key: 'ultimo', label: 'Mes anterior' },
                        { key: 'anio',   label: 'Este año' },
                        { key: 'rango',  label: 'Personalizado' },
                    ].map(f => (
                        <button key={f.key} className={`fin-chip ${periodoFiltro === f.key ? 'on' : ''}`} onClick={() => setPeriodoFiltro(f.key)}>
                            {f.label}
                        </button>
                    ))}
                    {periodoFiltro === 'rango' && (
                        <>
                            <input type="date" className="fin-input" style={{ width: 'auto', padding: '5px 10px', fontSize: '12px' }} value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                            <span style={{ fontSize: '12px', color: '#6b7a8d' }}>→</span>
                            <input type="date" className="fin-input" style={{ width: 'auto', padding: '5px 10px', fontSize: '12px' }} value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                        </>
                    )}
                </div>

                {/* TABS */}
                <div className="fin-tabs">
                    {TABS.map(t => (
                        <button key={t.key} className={`fin-tab ${tab === t.key ? 'on' : ''}`}
                            onClick={() => { setTab(t.key); cerrarCompose(); setBuscar(''); }}>
                            {t.icon} {t.label} <span className="n">{t.count}</span>
                        </button>
                    ))}
                </div>

                {tab === 'salarios' && (
                    <div className="fin-note">
                        <Info size={16} />
                        <p>Cada salario genera automáticamente un Gasto — así se incluye en el P&amp;L. Los <strong>anticipos</strong> se descuentan del neto, pero si fueron pagados en una fecha distinta deberías registrarlos también como un Gasto separado con la fecha real.</p>
                    </div>
                )}
                {tab === 'pagos' && (
                    <div className="fin-note">
                        <Info size={16} />
                        <p>Los pagos de clientes son seguimiento de cobros — <strong>no se suman al total de Ingresos</strong>. Registra el trabajo en la pestaña Ingresos y usa esta pestaña para rastrear cuánto te han pagado.</p>
                    </div>
                )}

                {/* LEDGER + COMPOSE */}
                <div className={`fin-layout ${mostrarForm ? 'split' : ''}`}>
                    <div className="fin-panel fin-scrollx">
                        <div style={{ minWidth: 560 }}>
                            <div className="fin-ledger-head">
                                <h2>{TABS.find(t => t.key === tab).label}</h2>
                                <div className="fin-search">
                                    <Search size={14} />
                                    <input type="text" placeholder="Buscar..." value={buscar} onChange={e => setBuscar(e.target.value)} />
                                </div>
                            </div>

                            {/* ── INGRESOS ── */}
                            {tab === 'ingresos' && maqFiltro && (
                                <GruposPeriodo grupos={agruparPorPeriodo(ingFiltrados, 'total')}
                                    periodoAbierto={periodoAbierto} setPeriodoAbierto={setPeriodoAbierto}
                                    cols={GRID.ingresos} tono="pos"
                                    renderFila={i => (
                                        <>
                                            <span className="date">{fmtFecha(i.fecha)}</span>
                                            <div className="fin-desc"><div className="t">{i.descripcion}</div></div>
                                            <span className="fin-cell">{i.maquinaNombre}</span>
                                            <span className="fin-catpill fin-cat-info"><i />{i.tipoTrabajo}</span>
                                            <span className="fin-cell">{i.cantidad}{i.tipoTrabajo === 'Horas' ? ' hrs' : ''}</span>
                                            <span className="fin-money pos">{fmt(i.total)}</span>
                                            <div className="fin-actions">
                                                <button className="fin-iconbtn" onClick={() => abrirEditar(i)}><Pencil size={14} /></button>
                                                <button className="fin-iconbtn" onClick={() => eliminar('ingresos', i.id)}><Trash2 size={14} /></button>
                                            </div>
                                        </>
                                    )} />
                            )}
                            {tab === 'ingresos' && !maqFiltro && (
                                <>
                                    <div className="fin-lrow-head" style={{ gridTemplateColumns: GRID.ingresos }}>
                                        <ThIng campo="fecha">Fecha</ThIng>
                                        <ThIng campo="descripcion">Descripción</ThIng>
                                        <ThIng campo="maquinaNombre">Máquina</ThIng>
                                        <ThIng campo="tipoTrabajo">Tipo</ThIng>
                                        <ThIng campo="cantidad">Cant.</ThIng>
                                        <span style={{ textAlign: 'right' }}>Total</span>
                                        <span style={{ textAlign: 'right' }}>Acc.</span>
                                    </div>
                                    {ingFiltrados.length === 0 && <p className="fin-vacio">Sin registros</p>}
                                    {pagIng.paginados.map(i => (
                                        <div className={`fin-lrow ${editandoId === i.id ? 'sel' : ''}`} key={i.id} style={{ gridTemplateColumns: GRID.ingresos }}>
                                            <span className="date">{fmtFecha(i.fecha)}</span>
                                            <div className="fin-desc"><div className="t">{i.descripcion}</div></div>
                                            <span className="fin-cell">{i.maquinaNombre}</span>
                                            <span className="fin-catpill fin-cat-info"><i />{i.tipoTrabajo}</span>
                                            <span className="fin-cell">{i.cantidad}{i.tipoTrabajo === 'Horas' ? ' hrs' : ''}</span>
                                            <span className="fin-money pos">{fmt(i.total)}</span>
                                            <div className="fin-actions">
                                                <button className="fin-iconbtn" onClick={() => abrirEditar(i)}><Pencil size={14} /></button>
                                                <button className="fin-iconbtn" onClick={() => eliminar('ingresos', i.id)}><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* ── GASTOS ── */}
                            {tab === 'gastos' && maqFiltro && (
                                <GruposPeriodo grupos={agruparPorPeriodo(gasFiltrados, 'monto')}
                                    periodoAbierto={periodoAbierto} setPeriodoAbierto={setPeriodoAbierto}
                                    cols={GRID.gastos} tono="neg"
                                    renderFila={g => {
                                        const tieneFact = facturasIds.has(String(g.id));
                                        return (
                                            <>
                                                <span className="date">{fmtFecha(g.fecha)}</span>
                                                <div className="fin-desc"><div className="t">{g.descripcion}</div></div>
                                                <span className={`fin-catpill fin-cat-${claseCategoria(g.categoria)}`}><i />{g.categoria}</span>
                                                <span className="fin-cell">{g.maquinaNombre}</span>
                                                <span className="fin-money neg">{fmt(g.monto)}</span>
                                                <div className="fin-actions">
                                                    {tieneFact && <button className="fin-iconbtn has" title="Ver factura" onClick={() => abrirFactura(g.id)}><FileText size={14} /></button>}
                                                    <button className="fin-iconbtn" onClick={() => abrirEditar(g)}><Pencil size={14} /></button>
                                                    <button className="fin-iconbtn" onClick={() => eliminar('gastos', g.id)}><Trash2 size={14} /></button>
                                                </div>
                                            </>
                                        );
                                    }} />
                            )}
                            {tab === 'gastos' && !maqFiltro && (
                                <>
                                    <div className="fin-lrow-head" style={{ gridTemplateColumns: GRID.gastos }}>
                                        <ThGas campo="fecha">Fecha</ThGas>
                                        <ThGas campo="descripcion">Descripción</ThGas>
                                        <ThGas campo="categoria">Categoría</ThGas>
                                        <ThGas campo="maquinaNombre">Máquina</ThGas>
                                        <span style={{ textAlign: 'right' }}>Monto</span>
                                        <span style={{ textAlign: 'right' }}>Acc.</span>
                                    </div>
                                    {gasFiltrados.length === 0 && <p className="fin-vacio">Sin registros</p>}
                                    {pagGas.paginados.map(g => {
                                        const esCombAuto = g.descripcion?.includes('Combustible —');
                                        const esSalAuto  = g.categoria === 'Salario' && g.descripcion?.startsWith('Salario —');
                                        const esMantAuto = g.categoria === 'Mantenimiento' && g.descripcion?.startsWith('Mantenimiento —');
                                        const autoIcon   = esCombAuto ? <Fuel size={10} /> : esSalAuto ? <HardHat size={10} /> : esMantAuto ? <Wrench size={10} /> : null;
                                        const autoTexto  = esCombAuto ? 'Automático desde Combustible' : esSalAuto ? 'Automático desde Salarios' : esMantAuto ? 'Automático desde Mantenimientos' : null;
                                        const tieneFact  = facturasIds.has(String(g.id));
                                        return (
                                            <div className={`fin-lrow ${editandoId === g.id ? 'sel' : ''}`} key={g.id} style={{ gridTemplateColumns: GRID.gastos }}>
                                                <span className="date">{fmtFecha(g.fecha)}</span>
                                                <div className="fin-desc">
                                                    <div className="t">{g.descripcion}</div>
                                                    {autoTexto && <div className="auto">{autoIcon} {autoTexto}</div>}
                                                </div>
                                                <span className={`fin-catpill fin-cat-${claseCategoria(g.categoria)}`}><i />{g.categoria}</span>
                                                <span className="fin-cell">{g.maquinaNombre}</span>
                                                <span className="fin-money neg">{fmt(g.monto)}</span>
                                                <div className="fin-actions">
                                                    {tieneFact && (
                                                        <button className="fin-iconbtn has" title="Ver factura" onClick={() => abrirFactura(g.id)}><FileText size={14} /></button>
                                                    )}
                                                    <label className="fin-iconbtn" title={tieneFact ? 'Cambiar factura PDF' : 'Adjuntar factura PDF'}>
                                                        <Paperclip size={14} style={{ color: tieneFact ? '#e67e22' : undefined }} />
                                                        <input type="file" accept="application/pdf" style={{ display: 'none' }}
                                                            onChange={async e => {
                                                                if (e.target.files[0]) {
                                                                    await guardarFactura(g.id, e.target.files[0]).catch(console.error);
                                                                    setFacturasIds(prev => new Set([...prev, String(g.id)]));
                                                                }
                                                            }} />
                                                    </label>
                                                    {tieneFact && (
                                                        <button className="fin-iconbtn" title="Quitar factura" onClick={async () => {
                                                            await eliminarFactura(g.id).catch(() => {});
                                                            setFacturasIds(prev => { const s = new Set(prev); s.delete(String(g.id)); return s; });
                                                        }}><X size={14} /></button>
                                                    )}
                                                    <button className="fin-iconbtn" onClick={() => abrirEditar(g)}><Pencil size={14} /></button>
                                                    <button className="fin-iconbtn" onClick={() => eliminar('gastos', g.id)}><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            {/* ── SALARIOS ── */}
                            {tab === 'salarios' && (
                                <>
                                    <div className="fin-lrow-head" style={{ gridTemplateColumns: GRID.salarios }}>
                                        <ThSal campo="operadorNombre">Operador</ThSal>
                                        <ThSal campo="horasTrabajadas">Horas</ThSal>
                                        <span style={{ textAlign: 'right' }}>$/Hora</span>
                                        <ThSal campo="totalBruto" style={{ justifyContent: 'flex-end' }}>Bruto</ThSal>
                                        <span style={{ textAlign: 'right' }}>Anticipos</span>
                                        <ThSal campo="totalNeto" style={{ justifyContent: 'flex-end' }}>Neto</ThSal>
                                        <ThSal campo="estado">Estado</ThSal>
                                        <span style={{ textAlign: 'right' }}>Acc.</span>
                                    </div>
                                    {salFiltrados.length === 0 && <p className="fin-vacio">Sin registros</p>}
                                    {pagSal.paginados.map(s => (
                                        <div className={`fin-lrow ${editandoId === s.id ? 'sel' : ''}`} key={s.id} style={{ gridTemplateColumns: GRID.salarios }}>
                                            <span className="fin-cell strong">{s.operadorNombre}</span>
                                            <span className="fin-cell">{s.horasTrabajadas} hrs</span>
                                            <span className="fin-money mut">{fmt(s.valorHora)}</span>
                                            <span className="fin-money pos">{fmt(s.totalBruto)}</span>
                                            <span className="fin-money neg">-{fmt(s.anticipos)}</span>
                                            <span className="fin-money pos">{fmt(s.totalNeto)}</span>
                                            <span><span className={`fin-badge ${s.estado === 'Pagado' ? 'ok' : 'pend'}`}>{s.estado}</span></span>
                                            <div className="fin-actions">
                                                <button className="fin-iconbtn" onClick={() => abrirEditar(s)}><Pencil size={14} /></button>
                                                <button className="fin-iconbtn" onClick={() => eliminar('salarios', s.id)}><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* ── PAGOS ── */}
                            {tab === 'pagos' && (
                                <>
                                    <div className="fin-lrow-head" style={{ gridTemplateColumns: GRID.pagos }}>
                                        <ThPag campo="fecha">Fecha</ThPag>
                                        <ThPag campo="cliente">Cliente</ThPag>
                                        <ThPag campo="maquinaNombre">Máquina</ThPag>
                                        <ThPag campo="valorTotal" style={{ justifyContent: 'flex-end' }}>Total</ThPag>
                                        <ThPag campo="valorPagado" style={{ justifyContent: 'flex-end' }}>Pagado</ThPag>
                                        <ThPag campo="saldoPendiente" style={{ justifyContent: 'flex-end' }}>Saldo</ThPag>
                                        <ThPag campo="estado">Estado</ThPag>
                                        <span style={{ textAlign: 'right' }}>Acc.</span>
                                    </div>
                                    {pagFiltrados.length === 0 && <p className="fin-vacio">Sin registros</p>}
                                    {pagPag.paginados.map(p => {
                                        const ingMaq = ingresos.filter(i => i.maquinaNombre === p.maquinaNombre).reduce((a, i) => a + (Number(i.total) || 0), 0);
                                        const pagMaq = pagos.filter(x => x.maquinaNombre === p.maquinaNombre).reduce((a, x) => a + (Number(x.valorPagado) || 0), 0);
                                        const sobrecobro = pagMaq > ingMaq && ingMaq > 0;
                                        return (
                                            <div className={`fin-lrow ${editandoId === p.id ? 'sel' : ''}`} key={p.id} style={{ gridTemplateColumns: GRID.pagos }}>
                                                <span className="date">{fmtFecha(p.fecha)}</span>
                                                <span className="fin-cell strong">{p.cliente}</span>
                                                <span className="fin-cell" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {p.maquinaNombre}
                                                    {sobrecobro && <span title={`Cobrado total (${fmt(pagMaq)}) supera ingresos registrados (${fmt(ingMaq)}) para esta máquina`} className="fin-iconbtn warn" style={{ width: 16, height: 16, cursor: 'help' }}><AlertTriangle size={12} /></span>}
                                                </span>
                                                <span className="fin-money mut">{fmt(p.valorTotal)}</span>
                                                <span className="fin-money pos">{fmt(p.valorPagado)}</span>
                                                <span className="fin-money neg">{fmt(p.saldoPendiente)}</span>
                                                <span><span className={`fin-badge ${p.estado === 'Pagado' ? 'ok' : p.estado === 'Parcial' ? 'par' : 'deu'}`}>{p.estado}</span></span>
                                                <div className="fin-actions">
                                                    <button className="fin-iconbtn" onClick={() => abrirEditar(p)}><Pencil size={14} /></button>
                                                    <button className="fin-iconbtn" onClick={() => eliminar('pagos', p.id)}><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            <div className="fin-ledger-foot">
                                <span>{listaTab.length} registros · mostrando {paginadosTab.paginados.length}</span>
                                <span>{footLabel} <span className={`fin-ledger-total fin-num ${footTono === 'pos' ? 'fin-money pos' : 'fin-money neg'}`}>{fmt(footTotal)}</span></span>
                            </div>
                            {!(maqFiltro && (tab === 'ingresos' || tab === 'gastos')) && (
                                <Paginacion pagina={paginadosTab.pagina} total={paginadosTab.total} ir={paginadosTab.ir} totalItems={listaTab.length} porPagina={20} />
                            )}
                        </div>
                    </div>

                    {/* ── COMPOSE PANEL ── */}
                    {mostrarForm && (
                        <div className="fin-panel fin-compose">
                            <div className="fin-compose-head">
                                <h2>{editandoId ? 'Editar' : 'Nuevo'} {tab === 'ingresos' ? 'ingreso' : tab === 'gastos' ? 'gasto' : tab === 'salarios' ? 'salario' : 'pago'}</h2>
                                <button className="fin-compose-x" onClick={cerrarCompose}><X size={14} /></button>
                            </div>
                            <div className="fin-compose-body">
                                {tab === 'ingresos' && (
                                    <>
                                        <div className="fin-fld"><label>Máquina *</label><SelectMaquina value={formIng.maquinaNombre} onChange={e => setFormIng({ ...formIng, maquinaNombre: e.target.value })} /></div>
                                        <div className="fin-fld">
                                            <label>Tipo de trabajo</label>
                                            <select className="fin-select" value={formIng.tipoTrabajo} onChange={e => setFormIng({ ...formIng, tipoTrabajo: e.target.value })}>
                                                <option>Horas</option><option>Hectáreas</option><option>M³</option><option>Viajes</option><option>M²</option>
                                            </select>
                                        </div>
                                        <div className="fin-fld-row">
                                            <div className="fin-fld"><label>Cantidad</label><input className="fin-input" type="number" inputMode="decimal" value={formIng.cantidad} onChange={e => setFormIng({ ...formIng, cantidad: e.target.value })} /></div>
                                            <div className="fin-fld"><label>Valor unitario</label><MoneyInput className="fin-input money" value={formIng.valorUnitario} onChange={e => setFormIng({ ...formIng, valorUnitario: e.target.value })} /></div>
                                        </div>
                                        <div className="fin-fld"><label>Fecha</label><input className="fin-input" type="date" value={formIng.fecha} onChange={e => setFormIng({ ...formIng, fecha: e.target.value })} /></div>
                                        <div className="fin-fld"><label>Descripción</label><input className="fin-input" value={formIng.descripcion} onChange={e => setFormIng({ ...formIng, descripcion: e.target.value })} placeholder="Ej: Obra Av. 30" /></div>
                                    </>
                                )}

                                {tab === 'gastos' && (
                                    <>
                                        <div className="fin-fld"><label>Máquina *</label><SelectMaquina value={formGas.maquinaNombre} onChange={e => setFormGas({ ...formGas, maquinaNombre: e.target.value })} /></div>
                                        <div className="fin-fld">
                                            <label>Categoría</label>
                                            <div className="fin-catpick">
                                                {CATEGORIAS_SUGERIDAS_GASTO.map(c => (
                                                    <span key={c}
                                                        className={`fin-catopt fin-cat-${claseCategoria(c)} ${formGas.categoria === c ? 'sel' : ''}`}
                                                        onClick={() => setFormGas({ ...formGas, categoria: c })}>{c}</span>
                                                ))}
                                            </div>
                                            <input className="fin-input" style={{ marginTop: '8px' }} value={formGas.categoria}
                                                onChange={e => setFormGas({ ...formGas, categoria: e.target.value })}
                                                placeholder="O escribe una categoría distinta" />
                                        </div>
                                        <div className="fin-fld-row">
                                            <div className="fin-fld"><label>Monto</label><MoneyInput className="fin-input money" value={formGas.monto} onChange={e => setFormGas({ ...formGas, monto: e.target.value })} /></div>
                                            <div className="fin-fld"><label>Fecha</label><input className="fin-input" type="date" value={formGas.fecha} onChange={e => setFormGas({ ...formGas, fecha: e.target.value })} /></div>
                                        </div>
                                        <div className="fin-fld"><label>Descripción</label><input className="fin-input" value={formGas.descripcion} onChange={e => setFormGas({ ...formGas, descripcion: e.target.value })} placeholder="Ej: Mantenimiento preventivo" /></div>
                                        <div className="fin-fld">
                                            <label>Factura (PDF)</label>
                                            {editandoId && facturasIds.has(String(editandoId)) && !gastoFactura ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <div className="fin-drop"><FileText size={16} style={{ color: '#e74c3c' }} /><span className="fin-drop-text">Factura adjunta</span>
                                                        <button type="button" className="fin-iconbtn" title="Ver factura" onClick={() => abrirFactura(editandoId)}><FileText size={13} style={{ color: '#e74c3c' }} /></button>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <label className="fin-btn" style={{ cursor: 'pointer', padding: '6px 10px', fontSize: '12px', flex: 1 }}>
                                                            <Paperclip size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Cambiar
                                                            <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => setGastoFactura(e.target.files[0] || null)} />
                                                        </label>
                                                        <button className="fin-btn" style={{ color: '#e74c3c' }} onClick={async () => { await eliminarFactura(editandoId).catch(() => {}); setFacturasIds(prev => { const s = new Set(prev); s.delete(String(editandoId)); return s; }); }}>Quitar</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <label className={`fin-drop ${gastoFactura ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                                                    <Paperclip size={16} style={{ color: gastoFactura ? '#e67e22' : '#93a2b3' }} />
                                                    <span className="fin-drop-text">{gastoFactura ? gastoFactura.name : 'Adjuntar factura (opcional)'}</span>
                                                    {gastoFactura && <span onClick={e => { e.preventDefault(); setGastoFactura(null); }} style={{ color: '#e74c3c', fontSize: '16px', lineHeight: 1 }}>×</span>}
                                                    <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => setGastoFactura(e.target.files[0] || null)} />
                                                </label>
                                            )}
                                        </div>
                                    </>
                                )}

                                {tab === 'salarios' && (
                                    <>
                                        <div className="fin-fld"><label>Operador *</label><SelectOperador value={formSal.operadorNombre} onChange={e => {
                                            const op = maquinas.find(m => m.operadorNombre === e.target.value);
                                            setFormSal({ ...formSal, operadorNombre: e.target.value, maquinaNombre: op?.nombre || formSal.maquinaNombre, valorHora: op?.valorHoraOperador || formSal.valorHora });
                                        }} /></div>
                                        <div className="fin-fld"><label>Máquina</label><SelectMaquina value={formSal.maquinaNombre} onChange={e => setFormSal({ ...formSal, maquinaNombre: e.target.value })} /></div>
                                        <div className="fin-fld-row">
                                            <div className="fin-fld"><label>Horas</label><input className="fin-input" type="number" inputMode="decimal" value={formSal.horasTrabajadas} onChange={e => setFormSal({ ...formSal, horasTrabajadas: e.target.value })} /></div>
                                            <div className="fin-fld"><label>Valor/hora</label><MoneyInput className="fin-input money" value={formSal.valorHora} onChange={e => setFormSal({ ...formSal, valorHora: e.target.value })} /></div>
                                        </div>
                                        <div className="fin-fld"><label>Anticipos</label><MoneyInput className="fin-input money" value={formSal.anticipos} onChange={e => setFormSal({ ...formSal, anticipos: e.target.value })} /></div>
                                        <div className="fin-fld-row">
                                            <div className="fin-fld"><label>Estado</label>
                                                <select className="fin-select" value={formSal.estado} onChange={e => setFormSal({ ...formSal, estado: e.target.value })}>
                                                    <option>Pendiente</option><option>Pagado</option>
                                                </select>
                                            </div>
                                            <div className="fin-fld"><label>Fecha</label><input className="fin-input" type="date" value={formSal.fecha} onChange={e => setFormSal({ ...formSal, fecha: e.target.value })} /></div>
                                        </div>
                                    </>
                                )}

                                {tab === 'pagos' && (
                                    <>
                                        <div className="fin-fld"><label>Cliente *</label><input className="fin-input" value={formPag.cliente} onChange={e => setFormPag({ ...formPag, cliente: e.target.value })} placeholder="Nombre del cliente" /></div>
                                        <div className="fin-fld"><label>Máquina *</label><SelectMaquina value={formPag.maquinaNombre} onChange={e => setFormPag({ ...formPag, maquinaNombre: e.target.value })} /></div>
                                        <div className="fin-fld"><label>Descripción</label><input className="fin-input" value={formPag.descripcion} onChange={e => setFormPag({ ...formPag, descripcion: e.target.value })} placeholder="Ej: Obra Avenida 30" /></div>
                                        <div className="fin-fld-row">
                                            <div className="fin-fld"><label>Valor total</label><MoneyInput className="fin-input money" value={formPag.valorTotal} onChange={e => setFormPag({ ...formPag, valorTotal: e.target.value })} /></div>
                                            <div className="fin-fld"><label>Valor pagado</label><MoneyInput className="fin-input money" value={formPag.valorPagado} onChange={e => setFormPag({ ...formPag, valorPagado: e.target.value })} /></div>
                                        </div>
                                        <div className="fin-fld"><label>Fecha</label><input className="fin-input" type="date" value={formPag.fecha} onChange={e => setFormPag({ ...formPag, fecha: e.target.value })} /></div>
                                    </>
                                )}
                            </div>
                            <div className="fin-compose-actions">
                                <button className="fin-btn" onClick={cerrarCompose}>Cancelar</button>
                                <button className="fin-btn pri" onClick={guardar}><Check size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{editandoId ? 'Actualizar' : 'Guardar'}</button>
                            </div>
                        </div>
                    )}
                </div>

            </div></div>
        </div>
        </>
    );
}

export default Finanzas;
