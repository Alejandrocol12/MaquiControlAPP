import { useState, useEffect } from 'react';
import { usePaginacion, Paginacion } from '../../utils/Paginacion';
import {
    getMaquinas, createMaquina, updateMaquina, deleteMaquina,
    getIngresos, getGastos, createIngreso, updateIngreso, createGasto, updateGasto,
    createCombustible, getCombustible, deleteIngreso, deleteGasto, deleteCombustible,
    createHora, getOperadoresAPI,
    getFaenaActiva, createFaena, cerrarFaena, getFaenas,
    crearEnlace, getEnlaces, revocarEnlace, getVistasEnlace,
    leerFacturaIA,
    getPagos, createPago, updatePago, deletePago,
    getMantenimientos, getCortes,
} from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import MoneyInput from '../../utils/MoneyInput';
import FiltroChips from '../../utils/FiltroChips';
import Estado from '../../utils/Estado';
import EmptyState from '../../utils/EmptyState';
import Opcional from '../../utils/Opcional';
import { useErrores, ErrorCampo } from '../../utils/useErrores';
import HistoriaMaquina from './HistoriaMaquina';
import { moduloVisible } from '../../utils/modulosOcultos';
import CortesFaena from '../Faenas/CortesFaena';
import AgrupadoPorCorte from '../Faenas/AgrupadoPorCorte';
import { nombreCorte, fmtHoras } from '../../utils/cortes';
import { pendientesDeCierre } from '../../utils/pendientesCierre';
import { fmtHoro, redondearHoro } from '../../utils/horometro';
import CorteEnCurso from '../Faenas/CorteEnCurso';
import CalendarioTrabajo from './CalendarioTrabajo';
import { TarjetasPeriodo, PronosticoMes } from './ResumenMaquina';
import FacturacionPorCorte from './FacturacionPorCorte';
import GastoModal from './GastoModal';
import GastosPorCorte from './GastosPorCorte';
import { usePagadores, AdministrarPagadores } from '../Gastos/QuienPago';
import { destinoPorDefecto, faenaIdDeDestino, destinoDeGasto, gastosExternosAbierto } from '../Gastos/DestinoGasto';
import ScrollTabs from '../../utils/ScrollTabs';
import { fmtFecha } from '../../utils/fmtFecha';
import {
    Tractor, Plus, Check, Pencil, Trash2, Settings, ClipboardList,
    TrendingUp, TrendingDown, Fuel, Clock, Leaf, Box, FileText, Paperclip, X,
    Briefcase, StopCircle, Search, AlertTriangle, Calendar, Share2, Copy, Trash, ChevronLeft,
    Eye, CreditCard, History,
} from 'lucide-react';
import { GiBulldozer } from 'react-icons/gi';
import { TbBackhoe } from 'react-icons/tb';
import { guardarFactura, eliminarFactura, abrirFactura } from '../../utils/facturaAPI';
import { useSortable } from '../../utils/useSortable';
import './Maquinaria.css';

const IcoMaquina = ({ tipo, size = 22 }) => {
    if (tipo === 'Excavadora') return <TbBackhoe size={size} />;
    if (tipo === 'Bulldozer')  return <GiBulldozer size={size} />;
    return <Tractor size={size} />;
};

const isoLocal   = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseLocal = (str) => { const [y, m, d] = str.split('-').map(Number); return new Date(y, m - 1, d); };

// Pronostica las horas que la máquina alcanzará a trabajar antes de fin de mes, a partir
// de su propio patrón histórico: qué días de la semana suele trabajar y cuántas horas hace
// esos días (no asume un calendario fijo de días hábiles — se basa en los datos reales).
function calcularPronosticoHoras(ingresosHoras, valorHoraMaquina) {
    const conFecha = ingresosHoras.filter(i => i.fecha);
    if (conFecha.length === 0) return null;

    const hoyD = new Date();
    const hoyStr = isoLocal(hoyD);
    const inicioMesStr = `${hoyD.getFullYear()}-${String(hoyD.getMonth() + 1).padStart(2, '0')}-01`;
    const finMes = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0);

    const horasEsteMes = conFecha
        .filter(i => i.fecha >= inicioMesStr && i.fecha <= hoyStr)
        .reduce((a, i) => a + (Number(i.cantidad) || 0), 0);

    // Ventana de historial para el patrón semanal: hasta 60 días atrás, o desde el primer registro
    const primerRegistro = parseLocal(conFecha.map(i => i.fecha).sort()[0]);
    const limite60 = new Date(hoyD); limite60.setDate(limite60.getDate() - 60);
    const ventanaInicio = primerRegistro > limite60 ? primerRegistro : limite60;

    const horasPorFecha = {};
    conFecha.forEach(i => { horasPorFecha[i.fecha] = (horasPorFecha[i.fecha] || 0) + (Number(i.cantidad) || 0); });

    const ocurrencias = Array(7).fill(0);
    const diasTrabajados = Array(7).fill(0);
    const sumaHoras = Array(7).fill(0);
    for (let d = new Date(ventanaInicio); d <= hoyD; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        ocurrencias[dow]++;
        const horas = horasPorFecha[isoLocal(d)] || 0;
        if (horas > 0) { diasTrabajados[dow]++; sumaHoras[dow] += horas; }
    }

    if (diasTrabajados.reduce((a, b) => a + b, 0) < 3) return null; // historial insuficiente

    // Horas esperadas por cada ocurrencia de ese día de la semana = frecuencia con que se
    // trabaja ese día × promedio de horas cuando sí se trabaja (naturalmente maneja "solo
    // trabajamos la mitad de los sábados" sin necesidad de reglas fijas)
    const horasEsperadasPorDia = Array(7).fill(0).map((_, dow) => {
        const frecuencia = ocurrencias[dow] > 0 ? diasTrabajados[dow] / ocurrencias[dow] : 0;
        const promedio    = diasTrabajados[dow] > 0 ? sumaHoras[dow] / diasTrabajados[dow] : 0;
        return frecuencia * promedio;
    });

    let horasRestantes = 0, diasRestantes = 0;
    for (let d = new Date(hoyD); d <= finMes; d.setDate(d.getDate() + 1)) {
        if (isoLocal(d) === hoyStr) continue; // hoy ya está contado en horasEsteMes
        horasRestantes += horasEsperadasPorDia[d.getDay()];
        diasRestantes++;
    }

    const totalProyectado = horasEsteMes + horasRestantes;
    return {
        horasEsteMes: Math.round(horasEsteMes * 10) / 10,
        horasRestantes: Math.round(horasRestantes * 10) / 10,
        totalProyectado: Math.round(totalProyectado * 10) / 10,
        ingresoProyectado: Math.round(totalProyectado * (valorHoraMaquina || 0)),
        diasRestantes,
        esperadoPorDia: horasEsperadasPorDia, // horas esperadas por día de la semana (0 = domingo)
    };
}

const TIPOS_TRABAJO = {
    Excavadora: ['Horas', 'Hectáreas', 'M³'],
    Bulldozer:  ['Horas', 'Hectáreas'],
};
const TODOS_TIPOS = [
    { key: 'Horas',     ico: <Clock size={22} />, uni: 'cant × valor/hora' },
    { key: 'Hectáreas', ico: <Leaf size={22} />,  uni: 'cant × valor/Ha' },
    { key: 'M³',        ico: <Box size={22} />,   uni: 'cant × valor/m³' },
];

const fmt = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().split('T')[0];

// Sugerencias fijas del selector de categoría — no crece con categorías personalizadas
// que el usuario haya escrito antes
const CATEGORIA_CLASE = { 'Reparación': 'info', 'Repuestos': 'gold', 'Combustible': 'orange', 'Mantenimiento': 'golddeep', 'Lubricantes': 'purple', 'Otros': 'neutral', 'Otro': 'neutral' };
const claseCategoria = (cat) => CATEGORIA_CLASE[cat] || 'neutral';

const FORM_VACIO = { nombre: '', tipo: '', placa: '', horometroActual: 0, estado: 'Activa', operadorNombre: '', valorHoraOperador: 0, valorHoraMaquina: 0 };

const PAGO_VACIO = { cliente: '', descripcion: '', valorTotal: '', valorPagado: '', fecha: hoy() };
const normalizarPago = (p) => {
    const valorTotal = Number(p.valorTotal ?? 0) || 0;
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

function Maquinaria({ vistaInicial = 'lista' }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [maquinas, setMaquinas] = useState([]);
    const [vista, setVista] = useState(vistaInicial);
    const [maqActual, setMaqActual] = useState(null);
    const [form, setForm] = useState(FORM_VACIO);
    const [operadoresAPI, setOperadoresAPI] = useState([]);
    const [faenasActivas, setFaenasActivas] = useState([]);
    const [ingresosAll, setIngresosAll] = useState([]);
    const [gastosAll, setGastosAll] = useState([]);

    useEffect(() => {
        cargar();
        getOperadoresAPI().then(r => setOperadoresAPI(r.data || [])).catch(() => {});
        getFaenas().then(r => setFaenasActivas((r.data || []).filter(f => f.estado === 'activa'))).catch(() => {});
        getIngresos().then(r => setIngresosAll(r.data || [])).catch(() => {});
        getGastos().then(r => setGastosAll(r.data || [])).catch(() => {});
    }, []);

    const cargar = () => getMaquinas().then(r => setMaquinas(r.data)).catch(console.error);

    // Periodo activo + utilidad en vivo de cada máquina, para que se vea desde la lista
    // sin tener que entrar al detalle
    const infoPeriodo = (m) => {
        const faena = faenasActivas.find(f => f.maquinaNombre === m.nombre);
        if (!faena) return null;
        const ing = ingresosAll.filter(i => String(i.faenaId) === String(faena.id)).reduce((a, i) => a + (Number(i.total) || 0), 0);
        const gas = gastosAll.filter(g => String(g.faenaId) === String(faena.id)).reduce((a, g) => a + (Number(g.monto) || 0), 0);
        const dias = faena.fechaInicio ? Math.max(1, Math.round((new Date() - parseLocal(faena.fechaInicio)) / 86400000)) : null;
        return { faena, ing, gas, util: ing - gas, dias };
    };

    const abrirEditar = (m, e) => { e.stopPropagation(); setForm({ ...m }); setMaqActual(m); setVista('editar'); };
    const abrirDetalle = (m) => { setMaqActual(m); setVista('detalle'); };
    const hc = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const guardar = () => {
        const op = vista === 'nueva' ? createMaquina(form) : updateMaquina(maqActual.id, form);
        op.then(() => { cargar(); setVista('lista'); setForm(FORM_VACIO); }).catch(console.error);
    };

    const eliminar = async (id, e) => {
        e.stopPropagation();
        if (await confirm('¿Eliminar esta máquina? Esta acción no se puede deshacer.'))
            deleteMaquina(id).then(() => { cargar(); toast('Máquina eliminada'); }).catch(console.error);
    };

    if (vista === 'detalle' && maqActual) {
        return <DetalleMaquina
            maquina={maqActual}
            onVolver={() => { cargar(); setVista('lista'); }}
            onEditar={() => { setForm({ ...maqActual }); setVista('editar'); }}
            onActualizar={(m) => setMaqActual(m)}
        />;
    }

    if (vista === 'nueva' || vista === 'editar') return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div>
                    <h1>{vista === 'nueva' ? 'Nueva Máquina' : 'Editar Máquina'}</h1>
                    <p>{vista === 'editar' ? `Modificando: ${maqActual?.nombre}` : 'Registra una nueva máquina'}</p>
                </div>
                <button className="bs" onClick={() => setVista('lista')}>← Volver</button>
            </div>
            <div className="content"><div className="pad">
                <div className="fc">
                    <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><Tractor size={18} /> Datos de la máquina</h3>
                    <p className="fd">Todos los campos marcados son obligatorios</p>
                    <div className="fg2">
                        <div><label className="fl">Nombre *</label><input className="fi" name="nombre" value={form.nombre} onChange={hc} placeholder="Ej: Excavadora CAT 320" /></div>
                        <div><label className="fl">Tipo *</label>
                            <select className="fsel" name="tipo" value={form.tipo} onChange={hc}>
                                <option value="">Selecciona...</option>
                                {Object.keys(TIPOS_TRABAJO).map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="fg2">
                        <div><label className="fl">Placa *</label><input className="fi" name="placa" value={form.placa} onChange={hc} placeholder="Ej: EXC-001" /></div>
                        <div><label className="fl">Horómetro (hrs)</label><input className="fi" type="number" name="horometroActual" value={form.horometroActual} onChange={hc} /></div>
                    </div>
                    <div className="fg2">
                        <div>
                            <label className="fl">Operador asignado</label>
                            <select className="fsel" name="operadorNombre" value={form.operadorNombre} onChange={hc}>
                                <option value="">— Sin operador —</option>
                                {operadoresAPI.map(o => (
                                    <option key={o.id} value={o.nombre}>{o.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div><label className="fl">Valor hora operador ($)</label><MoneyInput className="fi" name="valorHoraOperador" value={form.valorHoraOperador} onChange={hc} placeholder="Ej: 15.000" /></div>
                    </div>
                    <div className="fg2">
                        <div>
                            <label className="fl">Valor hora máquina al cliente ($)</label>
                            <MoneyInput className="fi" name="valorHoraMaquina" value={form.valorHoraMaquina} onChange={hc} placeholder="Ej: 180.000" />
                            <span style={{ fontSize: '11px', color: '#6b7a8d' }}>Lo que cobra la máquina por hora trabajada</span>
                        </div>
                        <div>
                            <label className="fl">Estado</label>
                            <select className="fsel" name="estado" value={form.estado} onChange={hc}>
                                <option>Activa</option><option>En mantenimiento</option><option>Inactiva</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="fa">
                    <button className="bp" style={{ flex: 1, justifyContent: 'center', padding: '13px' }} onClick={guardar}>
                        <Check size={14} style={{marginRight:'6px',verticalAlign:'middle'}} />{vista === 'nueva' ? 'Registrar máquina' : 'Guardar cambios'}
                    </button>
                    <button className="bs" onClick={() => setVista('lista')}>Cancelar</button>
                </div>
            </div></div>
        </div>
    );

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Maquinaria</h1><p>Máquinas registradas</p></div>
                <button className="bp" onClick={() => { setForm(FORM_VACIO); setVista('nueva'); }}><Plus size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> Nueva Máquina</button>
            </div>
            <div className="content"><div className="pad">
                <div className="mq-fleet">
                    {maquinas.map(m => {
                        const info = infoPeriodo(m);
                        const estadoCls = info ? 'working' : m.estado === 'En mantenimiento' ? 'mant' : m.estado !== 'Activa' ? 'inactiva' : '';
                        return (
                        <div className={`mq-fcard ${estadoCls}`} key={m.id} onClick={() => abrirDetalle(m)}>
                            <div className="mq-fc-top">
                                <div className="mq-fc-ico"><IcoMaquina tipo={m.tipo} size={22} /></div>
                                <div>
                                    <div className="mq-fc-name">{m.nombre}</div>
                                    <div className="mq-fc-sub">{m.tipo} · {m.placa}</div>
                                </div>
                            </div>
                            <div className="mq-fc-badges">
                                <span className={`mq-pill ${m.estado === 'Activa' ? 'ok' : m.estado === 'En mantenimiento' ? 'warn' : 'off'}`}><i></i>{m.estado}</span>
                                {info
                                    ? <span className="mq-pill job">{info.faena.nombreObra}</span>
                                    : <span className="mq-pill nojob">Sin periodo</span>}
                            </div>
                            <div className="mq-fc-rows">
                                <div className="mq-fc-row"><span>Operador</span><b>{m.operadorNombre || '—'}</b></div>
                                <div className="mq-fc-row"><span>Horómetro</span><b className="mq-num">{fmtHoro(m.horometroActual)} hrs</b></div>
                                <div className="mq-fc-row"><span>Valor/hora máquina</span><b className="mq-num">{fmt(m.valorHoraMaquina)}</b></div>
                            </div>
                            {info && (
                                <div className="mq-fc-money">
                                    <div className="mq-fc-money-head"><span>Utilidad del periodo</span><span>{info.dias} días</span></div>
                                    <div className="mq-fc-money-val mq-num" style={{ color: info.util >= 0 ? '#27ae60' : '#e74c3c' }}>{fmt(info.util)}</div>
                                    <div className="mq-fc-money-sub">Ingresos {fmt(info.ing)} − Gastos {fmt(info.gas)}</div>
                                </div>
                            )}
                            <div className="mq-fc-actions">
                                <button className="mq-fbtn" onClick={(e) => abrirEditar(m, e)}><Pencil size={12} style={{marginRight:'4px',verticalAlign:'middle'}} /> Editar</button>
                                <button className="mq-fbtn" style={{ flex: '0 0 auto', padding: '8px 10px' }} onClick={(e) => eliminar(m.id, e)}><Trash2 size={13} /></button>
                                <button className="mq-fbtn pri" onClick={() => abrirDetalle(m)}>Abrir hoja de vida</button>
                            </div>
                        </div>
                        );
                    })}
                    <div className="mq-newcard" onClick={() => { setForm(FORM_VACIO); setVista('nueva'); }}>
                        <Plus size={22} />
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>Nueva Máquina</span>
                    </div>
                </div>
            </div></div>
        </div>
        </>
    );
}

function FiltroRango({ rangoFiltro, setRangoFiltro, fechaDesde, setFechaDesde, fechaHasta, setFechaHasta, extra = [] }) {
    return (
        <FiltroChips
            className="mq-filtros"
            valor={rangoFiltro}
            onChange={setRangoFiltro}
            opciones={[
                { key: 'periodo', label: 'Periodo activo' },
                ...extra,
                { key: 'todo',    label: 'Todo' },
                { key: 'mes',     label: 'Este mes' },
                { key: 'ultimo',  label: 'Mes anterior' },
                { key: 'anio',    label: 'Este año' },
                { key: 'rango',   label: 'Personalizado' },
            ]}
        >
            {rangoFiltro === 'rango' && (
                <>
                    <input type="date" aria-label="Desde" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                    <span style={{ fontSize: '12px', color: '#93a2b3' }}>→</span>
                    <input type="date" aria-label="Hasta" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                </>
            )}
        </FiltroChips>
    );
}

// ═══════════════════════════════════════════════════════════════
// DETALLE MÁQUINA
// ══════════════════════════════════════════════════════════════
function DetalleMaquina({ maquina, onVolver, onEditar, onActualizar }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [tab, setTab] = useState(0);
    const [ingresos, setIngresos] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [combustibles, setCombustibles] = useState([]);
    const [pagos, setPagos] = useState([]);
    const [maq, setMaq] = useState(maquina);
    const [operadoresAPI, setOperadoresAPI] = useState([]);

    // Pagos clientes
    const [pagoForm, setPagoForm] = useState(PAGO_VACIO);
    const [editandoPagoId, setEditandoPagoId] = useState(null);
    const editarPago = (p) => { setPagoForm(normalizarPago(p)); setEditandoPagoId(p.id); };
    const cancelarEditarPago = () => { setEditandoPagoId(null); setPagoForm(PAGO_VACIO); errPago.setErrores({}); };
    const errPago = useErrores();
    const errTrabajo = useErrores();
    const errGasto = useErrores();
    const errComb = useErrores();
    const errFaena = useErrores();

    // Faena
    const [faenaActiva, setFaenaActiva] = useState(null);
    const [formFaena, setFormFaena] = useState({ nombreObra: '', cliente: '', fechaInicio: hoy(), nota: '' });
    const [mostrarFormFaena, setMostrarFormFaena] = useState(false);
    const [faenasCerradas, setFaenasCerradas] = useState([]);
    const [faenasMaq, setFaenasMaq] = useState([]);
    const [mantenimientos, setMantenimientos] = useState([]);

    // Compartir
    const [modalCompartir, setModalCompartir] = useState(false);
    const [enlaces, setEnlaces] = useState([]);
    const [nombreEnlace, setNombreEnlace] = useState('');
    const [cargandoEnlaces, setCargandoEnlaces] = useState(false);
    const [faenasCompartir, setFaenasCompartir] = useState([]);
    const [cortesCompartir, setCortesCompartir] = useState([]);
    const [alcanceCompartir, setAlcanceCompartir] = useState(''); // '' = toda la máquina, o el id de una faena
    const [vistasAbiertas, setVistasAbiertas] = useState(null); // token del enlace cuyas visitas se están mostrando
    const [vistasPorToken, setVistasPorToken] = useState({});
    const [cargandoVistas, setCargandoVistas] = useState(false);

    // Búsqueda en tablas
    const [formGastoAbierto, setFormGastoAbierto] = useState(false);
    const [buscarComb, setBuscarComb] = useState('');

    // Rango de fechas para las tablas de Ingresos/Gastos/Combustible (independiente del periodo activo)
    const [rangoFiltro, setRangoFiltro] = useState('periodo'); // 'periodo' | 'todo' | 'mes' | 'ultimo' | 'anio' | 'rango'
    const [fechaDesdeMaq, setFechaDesdeMaq] = useState('');
    const [fechaHastaMaq, setFechaHastaMaq] = useState('');

    // "¿Cuántas horas se han hecho desde tal fecha?" — usa todo el historial de la máquina

    useEffect(() => {
        getOperadoresAPI().then(r => setOperadoresAPI(r.data || [])).catch(() => {});
    }, []);

    // Registro trabajo
    const [tipoTrabajo, setTipoTrabajo] = useState('Horas');
    useEffect(() => {
        // Al entrar en modo edición, editarIngreso() ya deja cargados los valores reales del
        // ingreso — este efecto (pensado para el selector de tipo al crear) no debe pisarlos.
        if (editandoIngresoId) return;
        if (tipoTrabajo === 'Horas') {
            setValorUnitario(String(maq.valorHoraMaquina || ''));
            setHorometroFin(String(redondearHoro(maq.horometroActual) || ''));
        } else {
            setValorUnitario('');
        }
    }, [tipoTrabajo]);
    const [cantidad, setCantidad] = useState('');
    const [horometroFin, setHorometroFin] = useState(String(redondearHoro(maq.horometroActual) || ''));
    const [valorUnitario, setValorUnitario] = useState(String(maq.valorHoraMaquina || ''));
    const [fechaTrabajo, setFechaTrabajo] = useState(hoy());
    const [descTrabajo, setDescTrabajo] = useState('');
    const [editandoIngresoId, setEditandoIngresoId] = useState(null);

    const editarIngreso = (i) => {
        setTipoTrabajo(i.tipoTrabajo);
        setCantidad(String(i.cantidad ?? ''));
        setValorUnitario(String(i.valorUnitario ?? ''));
        setFechaTrabajo(i.fecha || hoy());
        setDescTrabajo(i.descripcion || '');
        setEditandoIngresoId(i.id);
        setTab(1);
    };
    const cancelarEditarIngreso = () => {
        setEditandoIngresoId(null);
        setTipoTrabajo('Horas');
        setCantidad('');
        setValorUnitario(String(maq.valorHoraMaquina || ''));
        setHorometroFin(String(redondearHoro(maq.horometroActual) || ''));
        setFechaTrabajo(hoy());
        setDescTrabajo('');
    };

    // Gastos
    const GASTO_VACIO = { descripcion: '', monto: '', categoria: 'Combustible', fecha: hoy(), pagadoPor: '', proveedor: '', numeroFactura: '' };
    const { pagadores, recargar: recargarPagadores, crear: crearPagador } = usePagadores();
    const [adminPag, setAdminPag] = useState(false);
    const [gastoDestino, setGastoDestino] = useState(''); // '' = el que corresponda por defecto
    const [gastoForm, setGastoForm] = useState(GASTO_VACIO);
    const [gastoFactura, setGastoFactura] = useState(null);
    const [facturasIds, setFacturasIds] = useState(new Set());
    const [editandoGastoId, setEditandoGastoId] = useState(null);
    const [cargandoIA, setCargandoIA] = useState(false);

    const editarGasto = (g) => {
        setGastoForm({ descripcion: g.descripcion, monto: String(g.monto || ''), categoria: g.categoria || 'Reparación', fecha: g.fecha, pagadoPor: g.pagadoPor || '', proveedor: g.proveedor || '', numeroFactura: g.numeroFactura || '' });
        setGastoDestino(destinoDeGasto(g));
        setEditandoGastoId(g.id);
        setGastoFactura(null);
    };
    const cancelarEditar = () => { setEditandoGastoId(null); setGastoDestino(''); setGastoForm(GASTO_VACIO); setGastoFactura(null); errGasto.setErrores({}); };

    const leerConIA = async (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;
        setGastoFactura(archivo);
        setCargandoIA(true);
        try {
            const fd = new FormData();
            fd.append('file', archivo);
            const { data } = await leerFacturaIA(fd);
            console.log('IA respuesta:', data);
            const desc  = data.descripcion ?? '';
            const monto = data.monto != null ? String(data.monto) : '';
            const cat   = data.categoria ?? 'Reparación';
            const fecha = data.fecha ?? hoy();
            setGastoForm(f => ({ ...f, descripcion: desc, monto, categoria: cat, fecha }));
            if (desc || monto) {
                toast(`Formulario llenado con IA — revisa y guarda`, 's');
            } else {
                toast('IA no pudo leer el documento. Ingresa los datos manualmente.', 'e');
            }
        } catch (err) {
            console.error('IA error:', err);
            const msg = err?.response?.data?.error;
            toast(msg ? `IA: ${msg}` : 'No se pudo leer el documento', 'e');
        } finally {
            setCargandoIA(false);
            e.target.value = '';
        }
    };

    // Combustible
    const [galones, setGalones] = useState('');
    const [precioPorGalon, setPrecioPorGalon] = useState('');
    const [fechaComb, setFechaComb] = useState(hoy());
    const [horoComb, setHoroComb] = useState(maq.horometroActual || 0);

    useEffect(() => { cargarTodo(); }, []);

    const cargarFaena = () => {
        getFaenaActiva(maq.nombre)
            .then(r => setFaenaActiva(r.data))
            .catch(() => setFaenaActiva(null));
        getFaenas()
            .then(r => {
                const propias = (r.data || []).filter(f => f.maquinaNombre === maq.nombre);
                setFaenasMaq(propias);
                setFaenasCerradas(propias.filter(f => f.estado === 'cerrada' && f.fechaInicio && f.fechaFin));
            })
            .catch(() => {});
    };

    // Promedio histórico de días en campo por periodo, para avisar si el actual ya se alargó
    const promedioDiasCampo = faenasCerradas.length > 0
        ? Math.round(faenasCerradas.reduce((a, f) => a + Math.max(1, Math.round((parseLocal(f.fechaFin) - parseLocal(f.fechaInicio)) / 86400000)), 0) / faenasCerradas.length)
        : null;
    const diasCampoActual = faenaActiva?.fechaInicio ? Math.max(1, Math.round((new Date() - parseLocal(faenaActiva.fechaInicio)) / 86400000)) : 0;

    const refreshGastos = () =>
        getGastos().then(r => {
            const filtrados = r.data.filter(g => g.maquinaNombre === maq.nombre);
            setGastos(filtrados);
            setFacturasIds(new Set(filtrados.filter(g => g.tieneFactura).map(g => String(g.id))));
        }).catch(console.error);

    const refreshPagos = () =>
        getPagos().then(r => setPagos((r.data || []).filter(p => p.maquinaNombre === maq.nombre).map(normalizarPago))).catch(console.error);

    const cargarDatos = () => {
        getIngresos().then(r => setIngresos(r.data.filter(i => i.maquinaNombre === maq.nombre))).catch(console.error);
        refreshGastos();
        getCombustible().then(r => setCombustibles(r.data.filter(c => c.maquinaNombre === maq.nombre))).catch(console.error);
        refreshPagos();
        getMantenimientos().then(r => setMantenimientos((r.data || []).filter(m => m.maquinaNombre === maq.nombre))).catch(() => {});
    };

    const guardarPago = async () => {
        if (!errPago.validar([{ campo: 'pagoCliente', ok: !!pagoForm.cliente?.trim(), msg: 'Escribe el nombre del cliente' }])) return;
        const payload = { ...pagoForm, maquinaNombre: maq.nombre, valorTotal: parseFloat(pagoForm.valorTotal) || 0, valorPagado: parseFloat(pagoForm.valorPagado) || 0 };
        try {
            if (editandoPagoId) {
                await updatePago(editandoPagoId, payload);
                toast('Pago actualizado');
            } else {
                await createPago(payload);
                toast('Pago registrado');
            }
        } catch {
            return toast('Error al guardar el pago', 'e');
        }
        cancelarEditarPago();
        refreshPagos();
    };

    const eliminarPago = async (id) => {
        if (!await confirm('¿Eliminar este pago?')) return;
        const prev = pagos;
        setPagos(p => p.filter(x => x.id !== id));
        deletePago(id).catch(() => { setPagos(prev); toast('Error al eliminar', 'e'); });
    };

    const guardarGasto = async () => {
                            if (!errGasto.validar([
                                { campo: 'gsDesc', ok: !!gastoForm.descripcion?.trim(), msg: 'Escribe qué se compró o se pagó' },
                                { campo: 'gsMonto', ok: !!gastoForm.monto, msg: 'Escribe el valor del gasto' },
                            ])) return;
    setFormGastoAbierto(false); // el modal se cierra al guardar
                            if (editandoGastoId) {
                                const fidU = faenaIdDeDestino(gastoDestino || destinoPorDefecto(faenasMaq, maq.nombre));
                                const gastoActualizado = { ...gastoForm, id: editandoGastoId, maquinaNombre: maq.nombre, monto: parseFloat(gastoForm.monto), ...(fidU !== undefined ? { faenaId: fidU } : {}) };
                                const gastoLocal = { ...gastoActualizado, faenaId: fidU === undefined ? (gastos.find(x => x.id === editandoGastoId)?.faenaId ?? null) : (fidU === -1 ? null : fidU) };
                                setGastos(prev => prev.map(g => g.id === editandoGastoId ? gastoLocal : g));
                                cancelarEditar(); toast('Gasto actualizado');
                                updateGasto(editandoGastoId, gastoActualizado).catch(() => { refreshGastos(); toast('Error al guardar', 'e'); });
                                if (gastoFactura) guardarFactura(editandoGastoId, gastoFactura).then(() => setFacturasIds(prev => new Set([...prev, String(editandoGastoId)]))).catch(console.error);
                            } else {
                                const tempId = `tmp_${Date.now()}`;
                                const fidC = faenaIdDeDestino(gastoDestino || destinoPorDefecto(faenasMaq, maq.nombre));
                                const gastoOptimista = { ...gastoForm, id: tempId, maquinaNombre: maq.nombre, monto: parseFloat(gastoForm.monto), faenaId: fidC === undefined ? (faenaActiva?.id ?? null) : (fidC === -1 ? null : fidC) };
                                setGastos(prev => [...prev, gastoOptimista]);
                                const facturaCapturada = gastoFactura;
                                setGastoForm(GASTO_VACIO); setGastoFactura(null); toast('Gasto registrado');
                                createGasto({ ...gastoForm, maquinaNombre: maq.nombre, monto: parseFloat(gastoForm.monto), ...(fidC !== undefined ? { faenaId: fidC } : {}) }).then(res => {
                                    if (res?.data) setGastos(prev => prev.map(g => g.id === tempId ? res.data : g));
                                    if (facturaCapturada && res?.data?.id) guardarFactura(res.data.id, facturaCapturada).then(() => setFacturasIds(prev => new Set([...prev, String(res.data.id)]))).catch(console.error);
                                }).catch(() => { setGastos(prev => prev.filter(g => g.id !== tempId)); toast('Error al guardar', 'e'); });
                            }
    };

    const accionesGasto = (g) => (
    <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {facturasIds.has(String(g.id)) && (
                <button className="icon-btn" title="Ver factura" onClick={() => abrirFactura(g.id)}>
                    <FileText size={14} style={{ color: '#e74c3c' }} />
                </button>
            )}
            <label className="icon-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paperclip size={14} style={{ color: facturasIds.has(String(g.id)) ? '#e67e22' : '#9aa5b4' }} />
                <input type="file" accept="application/pdf" style={{ display: 'none' }}
                    onChange={async e => {
                        if (e.target.files[0]) {
                            await guardarFactura(g.id, e.target.files[0]).catch(console.error);
                            setFacturasIds(prev => new Set([...prev, String(g.id)]));
                            toast('Factura actualizada');
                        }
                    }} />
            </label>
            {facturasIds.has(String(g.id)) && (
                <button className="icon-btn" onClick={async () => {
                    await eliminarFactura(g.id).catch(() => {});
                    setFacturasIds(prev => { const s = new Set(prev); s.delete(String(g.id)); return s; });
                }}><X size={14} style={{ color: '#9aa5b4' }} /></button>
            )}
            {g.categoria !== 'Pago operador' && <button className="icon-btn" onClick={() => editarGasto(g)}><Pencil size={14} /></button>}
            {g.categoria !== 'Pago operador' ? <button className="icon-btn" onClick={() => eliminarGasto(g.id)}><Trash2 size={14} /></button> : <small title="Se edita desde Operadores, pestaña Pago Operador" style={{ color: '#93a2b3', fontSize: '10.5px' }}>Operadores</small>}
        </span>
    );

    const cargarTodo = () => { cargarDatos(); cargarFaena(); };

    // Meta de horas del mes (0 la quita)
    const guardarMeta = (horas) => {
        const nueva = { ...maq, metaMensualHoras: horas > 0 ? horas : null };
        setMaq(nueva);
        onActualizar(nueva);
        updateMaquina(maq.id, { ...maq, metaMensualHoras: horas }).catch(() => toast('No se pudo guardar la meta', 'e'));
    };

    // Tras guardar un parte diario: recarga los datos y el horómetro de la máquina, que pudo cambiar
    const refrescarTrasParte = () => {
        cargarTodo();
        getMaquinas().then(r => {
            const actualizada = (r.data || []).find(m => m.nombre === maq.nombre);
            if (actualizada) { setMaq(actualizada); onActualizar(actualizada); }
        }).catch(() => {});
    };

    // alcanceInicial (opcional): 'c:<id del corte>' o 'curso:<id del periodo>' para abrir con eso ya elegido
    const abrirCompartir = (alcanceInicial) => {
        setModalCompartir(true);
        setAlcanceCompartir('');
        setCargandoEnlaces(true);
        getEnlaces().then(r => {
            const propios = (r.data || []).filter(e => e.maquinaNombre === maq.nombre);
            setEnlaces(propios);
        }).catch(() => {}).finally(() => setCargandoEnlaces(false));
        Promise.all([getFaenas(), getCortes()]).then(([f, c]) => {
            const propias = (f.data || []).filter(x => x.maquinaNombre === maq.nombre);
            setFaenasCompartir(propias);
            const porFaena = {};
            (c.data || []).filter(x => propias.some(p => String(p.id) === String(x.faenaId))).sort((a, b) => String(a.fechaInicio).localeCompare(String(b.fechaInicio)))
                .forEach(x => { porFaena[x.faenaId] = (porFaena[x.faenaId] || 0) + 1; x._n = porFaena[x.faenaId]; });
            setCortesCompartir((c.data || []).filter(x => x._n).sort((a, b) => String(b.fechaInicio).localeCompare(String(a.fechaInicio))));
            if (typeof alcanceInicial === 'string') setAlcanceCompartir(alcanceInicial);
        }).catch(() => {});
    };
    // Día en que arranca el corte en curso de un periodo: el siguiente al último corte, o el inicio del periodo
    const desdeEnCurso = (f) => {
        const ult = cortesCompartir.filter(c => String(c.faenaId) === String(f.id)).map(c => String(c.fechaFin).slice(0, 10)).sort().pop();
        if (!ult) return String(f.fechaInicio || '').slice(0, 10);
        const d = new Date(ult + 'T00:00:00'); d.setDate(d.getDate() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const etiquetaCorte = (c) => {
        const f = faenasCompartir.find(x => String(x.id) === String(c.faenaId));
        return `${nombreCorte(c, c._n)} (${fmtFecha(c.fechaInicio)} a ${fmtFecha(c.fechaFin)})${f ? ' · ' + (f.nombreObra || 'periodo') : ''}`;
    };

    const crearNuevoEnlace = () => {
        const esCurso = alcanceCompartir.startsWith('curso:');
        const faenaCurso = esCurso ? faenasCompartir.find(f => String(f.id) === alcanceCompartir.slice(6)) : null;
        const esCorte = alcanceCompartir.startsWith('c:');
        const corteElegido = esCorte ? cortesCompartir.find(c => String(c.id) === alcanceCompartir.slice(2)) : null;
        const faenaElegida = !esCorte && alcanceCompartir ? faenasCompartir.find(f => String(f.id) === alcanceCompartir) : null;
        const etiquetaPorDefecto = faenaCurso ? `${maq.nombre} — Corte en curso` : corteElegido ? `${maq.nombre} — Corte ${corteElegido._n}` : faenaElegida ? `${maq.nombre} — ${faenaElegida.nombreObra}` : `Enlace de ${maq.nombre}`;
        crearEnlace({ maquinaId: maq.id, nombre: nombreEnlace || etiquetaPorDefecto, faenaId: faenaCurso ? faenaCurso.id : (!esCorte && alcanceCompartir ? Number(alcanceCompartir) : null), corteId: corteElegido ? corteElegido.id : null, corteEnCurso: !!faenaCurso })
            .then(r => { setEnlaces(prev => [...prev, r.data]); setNombreEnlace(''); setAlcanceCompartir(''); toast('Enlace creado'); })
            .catch(() => toast('Error al crear enlace', 'e'));
    };

    const revocar = (token) => {
        revocarEnlace(token)
            .then(() => { setEnlaces(prev => prev.filter(e => e.token !== token)); toast('Enlace revocado'); })
            .catch(() => toast('Error al revocar', 'e'));
    };

    const copiarLink = (token) => {
        const url = `${window.location.origin}${window.location.pathname}?token=${token}`;
        navigator.clipboard.writeText(url).then(() => toast('Enlace copiado'));
    };

    const toggleVistas = (token) => {
        if (vistasAbiertas === token) { setVistasAbiertas(null); return; }
        setVistasAbiertas(token);
        if (vistasPorToken[token]) return;
        setCargandoVistas(true);
        getVistasEnlace(token)
            .then(r => setVistasPorToken(prev => ({ ...prev, [token]: r.data || [] })))
            .catch(() => setVistasPorToken(prev => ({ ...prev, [token]: [] })))
            .finally(() => setCargandoVistas(false));
    };

    // Filtrar por faena activa
    const ingFaena  = faenaActiva ? ingresos.filter(i => String(i.faenaId) === String(faenaActiva.id)) : [];
    const gasFaena  = faenaActiva ? gastos.filter(g => String(g.faenaId) === String(faenaActiva.id)) : [];
    const combFaena = faenaActiva ? combustibles.filter(c => String(c.faenaId) === String(faenaActiva.id)) : [];

    // Horas trabajadas en la faena actual
    const horasFaena = ingFaena.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0);

    // Días con horas en el periodo y horas del mes en curso, para las tarjetas y la meta
    const diasTrabajadosFaena = new Set(ingFaena.filter(i => i.tipoTrabajo === 'Horas' && Number(i.cantidad) > 0).map(i => i.fecha)).size;
    const ahoraMes = new Date();
    const prefijoMes = `${ahoraMes.getFullYear()}-${String(ahoraMes.getMonth() + 1).padStart(2, '0')}`;
    const horasEsteMes = ingresos.filter(i => i.tipoTrabajo === 'Horas' && String(i.fecha || '').startsWith(prefijoMes)).reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
    const diasDelMes = new Date(ahoraMes.getFullYear(), ahoraMes.getMonth() + 1, 0).getDate();

    // Totales de la faena
    const totalIngresos = ingFaena.reduce((a, i) => a + (i.total || 0), 0);
    const totalGastos   = gasFaena.reduce((a, g) => a + (g.monto || 0), 0);

    // Pronóstico de horas a fin de mes, basado en TODO el historial de la máquina (no solo el periodo actual)
    const pronostico = calcularPronosticoHoras(ingresos.filter(i => i.tipoTrabajo === 'Horas'), maq.valorHoraMaquina);



    // Tablas de Ingresos/Gastos/Combustible (tabs 2-4): respetan rangoFiltro además del periodo
    // activo — "periodo" reproduce exactamente lo de arriba, el resto navega todo el historial
    // de la máquina por fecha, sin depender de si hay un periodo activo.
    const porFechaMaq = (arr) => {
        if (rangoFiltro === 'todo') return arr;
        if (rangoFiltro === 'rango') {
            return arr.filter(x => {
                const f = x.fecha || '';
                if (fechaDesdeMaq && f < fechaDesdeMaq) return false;
                if (fechaHastaMaq && f > fechaHastaMaq) return false;
                return true;
            });
        }
        const hoyD = new Date();
        let prefix;
        if (rangoFiltro === 'mes')    prefix = hoyD.toISOString().slice(0, 7);
        else if (rangoFiltro === 'ultimo') { const d = new Date(hoyD); d.setMonth(d.getMonth() - 1); prefix = d.toISOString().slice(0, 7); }
        else if (rangoFiltro === 'anio')   prefix = String(hoyD.getFullYear());
        return prefix ? arr.filter(x => x.fecha?.startsWith(prefix)) : arr;
    };
    const ingBaseF  = rangoFiltro === 'periodo' ? ingFaena  : porFechaMaq(ingresos);
    const extAbierto = gastosExternosAbierto(faenasMaq, maq.nombre);
    const gasBaseF  = rangoFiltro === 'periodo' ? gasFaena
        : rangoFiltro === 'externo' ? (extAbierto ? gastos.filter(g => String(g.faenaId) === String(extAbierto.id)) : [])
        : porFechaMaq(gastos);
    const combBaseF = rangoFiltro === 'periodo' ? combFaena : porFechaMaq(combustibles);
    const ingFiltradosF  = ingBaseF;
    const gasFiltradosF  = gasBaseF;
    const combFiltradosF = combBaseF.filter(c =>
        !buscarComb || String(c.galones).includes(buscarComb) || c.fecha?.includes(buscarComb)
    );
    const { sorted: ingOrdenadosF } = useSortable(ingFiltradosF,  'fecha', 'desc');
    const { sorted: gasOrdenadosF } = useSortable(gasFiltradosF,  'fecha', 'desc');
    const { sorted: combOrdenadosF, Th: ThCombF } = useSortable(combFiltradosF, 'fecha', 'desc');
    const pagCombF  = usePaginacion(combOrdenadosF, 20);
    const totalIngF  = ingOrdenadosF.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const totalGasF  = gasOrdenadosF.reduce((a, g) => a + (Number(g.monto) || 0), 0);
    const totalCombF = combOrdenadosF.reduce((a, c) => a + (Number(c.total) || 0), 0);

    const tiposPermitidos = TIPOS_TRABAJO[maq.tipo] || ['Horas'];
    // Para 'Horas' las horas se derivan del horómetro (fin - inicio), no se digitan a mano
    // Redondeado a 1 decimal para evitar arrastrar errores de coma flotante (ej: 11.199999999999999)
    const horasCalculadas = Math.round((parseFloat(horometroFin || 0) - (maq.horometroActual || 0)) * 10) / 10;
    // Al editar, la cantidad/horas se digita directamente — no se deriva del horómetro actual
    // de la máquina, porque ese ya avanzó desde que se creó el registro que se está corrigiendo.
    const cantidadEfectiva = editandoIngresoId
        ? parseFloat(cantidad || 0)
        : (tipoTrabajo === 'Horas' ? horasCalculadas : parseFloat(cantidad || 0));
    const totalTrabajo = cantidadEfectiva * parseFloat(valorUnitario || 0);
    const nuevoHoro = tipoTrabajo === 'Horas' ? parseFloat(horometroFin || 0) : maq.horometroActual;
    const totalComb = parseFloat(galones || 0) * parseFloat(precioPorGalon || 0);

    const registrarTrabajo = () => {
        const okTrabajo = tipoTrabajo === 'Horas'
            ? errTrabajo.validar([
                { campo: 'trHorometro', ok: !!horometroFin, msg: 'Escribe el horómetro al terminar' },
                { campo: 'trHorometro', ok: horasCalculadas > 0, msg: `Debe ser mayor al horómetro inicial (${fmtHoro(maq.horometroActual)})` },
                { campo: 'trValor', ok: !!valorUnitario, msg: 'Escribe el valor por hora' },
            ])
            : errTrabajo.validar([
                { campo: 'trCantidad', ok: !!cantidad, msg: `Escribe la cantidad de ${tipoTrabajo}` },
                { campo: 'trValor', ok: !!valorUnitario, msg: 'Escribe el valor unitario' },
            ]);
        if (!okTrabajo) return;
        const horometroInicioAlRegistrar = maq.horometroActual || 0;
        const payload = {
            maquinaNombre: maq.nombre, tipoTrabajo, cantidad: cantidadEfectiva,
            valorUnitario: parseFloat(valorUnitario),
            total: cantidadEfectiva * parseFloat(valorUnitario),
            fecha: fechaTrabajo, descripcion: descTrabajo || `${tipoTrabajo} – ${maq.nombre}`,
            ...(tipoTrabajo === 'Horas' ? { horometroInicio: horometroInicioAlRegistrar, horometroFin: nuevoHoro } : {}),
        };
        const tempId = `tmp_${Date.now()}`;
        const optimista = { ...payload, id: tempId, faenaId: faenaActiva?.id ?? null };
        setIngresos(prev => [...prev, optimista]);
        if (tipoTrabajo === 'Horas') {
            const maqActualizada = { ...maq, horometroActual: nuevoHoro };
            setMaq(maqActualizada);
            onActualizar(maqActualizada);
            setHorometroFin(String(nuevoHoro));
        }
        setCantidad(''); setValorUnitario(''); setDescTrabajo('');
        toast('Trabajo registrado');

        createIngreso(payload).then(res => {
            if (res?.data) setIngresos(prev => prev.map(i => i.id === tempId ? res.data : i));
            const promises = [];
            if (tipoTrabajo === 'Horas') {
                const maqActualizada = { ...maq, horometroActual: nuevoHoro };
                promises.push(updateMaquina(maq.id, maqActualizada));
                if (maq.operadorNombre) {
                    const operadorObjetivo = operadoresAPI.find(o => o.nombre === maq.operadorNombre);
                    promises.push(createHora({
                        operador_id:     operadorObjetivo?.id || null,
                        operadorNombre:  maq.operadorNombre,
                        maquinaNombre:   maq.nombre,
                        fecha:           fechaTrabajo,
                        horas:           cantidadEfectiva,
                        valorHora:       maq.valorHoraOperador || 0,
                        horometroInicio: horometroInicioAlRegistrar,
                        horometroFin:    nuevoHoro,
                        ingresoId:       res?.data?.id ?? null,
                    }));
                }
            }
            return Promise.all(promises);
        }).catch(() => {
            setIngresos(prev => prev.filter(i => i.id !== tempId));
            toast('Error al guardar — intenta de nuevo', 'e');
        });
    };

    const actualizarIngresoExistente = () => {
        if (!errTrabajo.validar([
            { campo: 'trCantidad', ok: !!cantidadEfectiva, msg: tipoTrabajo === 'Horas' ? 'Escribe las horas trabajadas' : `Escribe la cantidad de ${tipoTrabajo}` },
            { campo: 'trValor', ok: !!valorUnitario, msg: 'Escribe el valor unitario' },
        ])) return;
        const id = editandoIngresoId;
        const payload = {
            descripcion: descTrabajo || `${tipoTrabajo} – ${maq.nombre}`,
            cantidad: cantidadEfectiva,
            valorUnitario: parseFloat(valorUnitario),
            fecha: fechaTrabajo,
        };
        setIngresos(prev => prev.map(i => i.id === id
            ? { ...i, ...payload, total: cantidadEfectiva * parseFloat(valorUnitario) }
            : i));
        cancelarEditarIngreso();
        toast('Ingreso actualizado');

        updateIngreso(id, payload).then(({ data }) => {
            setIngresos(prev => prev.map(i => i.id === id ? data : i));
            if (data?.tipoTrabajo === 'Horas') {
                // El horómetro pudo recalcularse en el backend a partir de esta corrección
                getMaquinas().then(r => {
                    const actualizada = (r.data || []).find(m => m.nombre === data.maquinaNombre);
                    if (actualizada) { setMaq(actualizada); onActualizar(actualizada); }
                }).catch(() => {});
            }
        }).catch(() => {
            toast('Error al actualizar — recargando datos', 'e');
            cargarTodo();
        });
    };

    const guardarIngreso = () => editandoIngresoId ? actualizarIngresoExistente() : registrarTrabajo();

    const registrarCombustible = () => {
        if (!errComb.validar([
            { campo: 'cbGalones', ok: !!galones, msg: 'Escribe cuántos galones cargó' },
            { campo: 'cbPrecio', ok: !!precioPorGalon, msg: 'Escribe el precio por galón' },
        ])) return;
        const combPayload = {
            maquinaNombre: maq.nombre, galones: parseFloat(galones),
            precioPorGalon: parseFloat(precioPorGalon), horometro: parseFloat(horoComb), fecha: fechaComb
        };
        const tempId = `tmp_${Date.now()}`;
        setCombustibles(prev => [...prev, { ...combPayload, id: tempId, total: combPayload.galones * combPayload.precioPorGalon }]);
        setGalones(''); setPrecioPorGalon('');
        toast('Carga de combustible registrada');

        createCombustible(combPayload).then(res => {
            if (res?.data) setCombustibles(prev => prev.map(c => c.id === tempId ? res.data : c));
            refreshGastos();
        }).catch(() => {
            setCombustibles(prev => prev.filter(c => c.id !== tempId));
            toast('Error al registrar — intenta de nuevo', 'e');
        });
    };

    const eliminarIngreso = async (id) => {
        if (!await confirm('¿Eliminar este ingreso?')) return;
        const prev = ingresos;
        const item = ingresos.find(i => i.id === id);
        setIngresos(p => p.filter(i => i.id !== id));
        // El backend revierte el horómetro de la máquina; reflejamos el mismo ajuste aquí
        let maqAnterior = null;
        if (item?.tipoTrabajo === 'Horas' && item.cantidad) {
            maqAnterior = maq;
            const maqActualizada = { ...maq, horometroActual: (maq.horometroActual || 0) - item.cantidad };
            setMaq(maqActualizada);
            onActualizar(maqActualizada);
        }
        deleteIngreso(id).catch(() => {
            setIngresos(prev);
            if (maqAnterior) { setMaq(maqAnterior); onActualizar(maqAnterior); }
            toast('Error al eliminar', 'e');
        });
    };
    const eliminarGasto = async (id) => {
        if (!await confirm('¿Eliminar este gasto?')) return;
        const prev = gastos;
        setGastos(p => p.filter(g => g.id !== id));
        setFacturasIds(p => { const s = new Set(p); s.delete(String(id)); return s; });
        deleteGasto(id).catch(() => { setGastos(prev); toast('Error al eliminar', 'e'); });
        eliminarFactura(id).catch(() => {});
    };
    const eliminarComb = async (id) => {
        if (!await confirm('¿Eliminar esta carga?')) return;
        const prev = combustibles;
        setCombustibles(p => p.filter(c => c.id !== id));
        deleteCombustible(id)
            .then(() => refreshGastos())
            .catch(() => { setCombustibles(prev); toast('Error al eliminar', 'e'); });
    };

    const abrirFaena = async () => {
        if (!errFaena.validar([{ campo: 'fnObra', ok: !!formFaena.nombreObra.trim(), msg: 'Escribe el nombre de la obra' }])) return;
        if (maq.estado !== 'Activa') {
            toast(`Máquina en estado "${maq.estado}" — actualiza el estado si ya está operativa`, 'w');
        }
        try {
            await createFaena({ ...formFaena, maquinaNombre: maq.nombre });
        } catch (e) {
            return toast(e.response?.data?.error || 'No se pudo abrir el periodo', 'e');
        }
        toast('Periodo abierto — los registros quedan en cero');
        setMostrarFormFaena(false);
        setFormFaena({ nombreObra: '', cliente: '', fechaInicio: hoy(), nota: '' });
        cargarFaena();
    };

    const handleCerrarFaena = async () => {
        if (!faenaActiva) return;
        const pendientes = await pendientesDeCierre(faenaActiva);
        const aviso = pendientes.length ? `\n\nAntes de cerrar, ten en cuenta:\n${pendientes.map(x => '• ' + x).join('\n')}\n\n¿Cerrar de todas formas?` : '';
        const ok = await confirm(
            `¿Rendir cuentas y cerrar el periodo "${faenaActiva.nombreObra}"?\n\nSe archivará el resumen financiero y los registros de esta máquina volverán a cero.${aviso}`,
            { ok: pendientes.length ? 'Cerrar de todas formas' : 'Cerrar periodo' }
        );
        if (!ok) return;
        await cerrarFaena(faenaActiva.id).catch(console.error);
        setFaenaActiva(null);
        toast('Periodo cerrado — registros en cero. Abre un nuevo periodo cuando la máquina salga.');
        cargarTodo();
    };

    const TABS = [
        <><ClipboardList size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Resumen</>,
        <><Settings size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Trabajo</>,
        <><TrendingUp size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Ingresos</>,
        <><TrendingDown size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Gastos</>,
        <><Fuel size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Combustible</>,
        <><Briefcase size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Periodo</>,
        <><CreditCard size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Pagos Clientes</>,
        <><History size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Historia</>,
    ];

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>{maq.nombre}</h1><p>Detalle financiero y operativo</p></div>
                <div className="tb-r">
                    <button className="bs" onClick={onVolver}><ChevronLeft size={15} style={{verticalAlign:'middle'}} /><span className="tb-label">Volver</span></button>
                    <button className="bs" onClick={abrirCompartir}><Share2 size={14} style={{verticalAlign:'middle'}} /><span className="tb-label" style={{marginLeft:'5px'}}>Compartir</span></button>
                    <button className="bp" onClick={onEditar}><Pencil size={14} style={{verticalAlign:'middle'}} /><span className="tb-label" style={{marginLeft:'5px'}}>Editar</span></button>
                </div>
            </div>
            <div className="content"><div className="pad">

                {/* HEADER */}
                <div className="mq-dh">
                    <div className="mq-dh-l">
                        <div className="mq-dh-ico"><IcoMaquina tipo={maq.tipo} size={28} /></div>
                        <div>
                            <h2>{maq.nombre}</h2>
                            <p>Placa {maq.placa} · Operador {maq.operadorNombre || '—'} · {fmt(maq.valorHoraOperador)}/hr operador · {fmt(maq.valorHoraMaquina || 0)}/hr máquina</p>
                            <div className="mq-dh-badges">
                                <span className={`mq-pill ${maq.estado === 'Activa' ? 'ok' : maq.estado === 'En mantenimiento' ? 'warn' : 'off'}`}><i></i>{maq.estado}</span>
                                <span className="mq-pill off">{fmtHoro(maq.horometroActual)} hrs horómetro</span>
                                {faenaActiva
                                    ? <span className="mq-pill job">Periodo: {faenaActiva.nombreObra}</span>
                                    : <span className="mq-pill nojob">Sin periodo activo</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sin faena: alerta */}
                {!faenaActiva && (
                    <div className="ale orange">
                        <AlertTriangle size={18} color="#e67e22" />
                        <div>
                            <p>Esta máquina no tiene periodo activo</p>
                            <span className="ale-desc">Ve a la pestaña <strong>Periodo</strong> para abrir uno cuando la máquina salga a trabajar. Sin periodo activo los registros quedan en cero.</span>
                        </div>
                    </div>
                )}

                {/* TABS */}
                {/* La pestaña Combustible (índice 4) no se muestra mientras ese módulo esté oculto */}
                <ScrollTabs className="mq-dtabs" activeIndex={tab - (!moduloVisible('combustible') && tab > 4 ? 1 : 0)}>
                    {TABS.map((t, i) => (i === 4 && !moduloVisible('combustible'))
                        ? null
                        : <button key={i} className={`mq-dtab ${tab === i ? 'on' : ''}`} onClick={() => setTab(i)}>{t}</button>)}
                </ScrollTabs>

                {/* TAB 0 — RESUMEN */}
                {tab === 0 && (
                    <>
                        {faenaActiva && <CorteEnCurso faena={faenaActiva} ingresos={ingFaena} gastos={gasFaena} onVer={() => setTab(5)} />}

                        <TarjetasPeriodo ingresos={totalIngresos} gastos={totalGastos} utilidad={totalIngresos - totalGastos}
                            horas={horasFaena} diasTrabajados={diasTrabajadosFaena} periodoNombre={faenaActiva?.nombreObra}
                            valorHora={maq.valorHoraMaquina} onIr={setTab} />

                        <PronosticoMes pronostico={pronostico} horasMes={horasEsteMes} diasDelMes={diasDelMes}
                            valorHora={maq.valorHoraMaquina} meta={maq.metaMensualHoras || 0} onGuardarMeta={guardarMeta} />

                        <CalendarioTrabajo maq={maq} ingresos={ingresos} combustibles={combustibles}
                            esperadoPorDia={pronostico?.esperadoPorDia || null} verGalones={moduloVisible('combustible')}
                            onCambio={refrescarTrasParte} />
                    </>
                )}

                {/* TAB 1 — REGISTRO TRABAJO */}
                {tab === 1 && (
                    <>
                        {!faenaActiva && (
                            <div className="ale orange">
                                <AlertTriangle size={16} color="#e67e22" />
                                <div><p style={{margin:0}}>Sin periodo activo — el registro se guardará pero no quedará en ningún periodo</p></div>
                            </div>
                        )}
                        <div className="fc">
                            <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><Settings size={18} /> {editandoIngresoId ? 'Editar ingreso' : 'Registrar trabajo'}</h3>
                            <p className="fd">{maq.nombre}{editandoIngresoId ? ' — corrige los datos y guarda' : ' — selecciona cómo se midió el trabajo'}</p>
                            <div className="tg">
                                {TODOS_TIPOS.map(t => {
                                    const activo = tiposPermitidos.includes(t.key);
                                    return (
                                        <div key={t.key} className={`tc ${!activo || editandoIngresoId ? 'dis' : tipoTrabajo === t.key ? 'sel' : ''} ${editandoIngresoId && tipoTrabajo === t.key ? 'sel' : ''}`}
                                            onClick={() => activo && !editandoIngresoId && setTipoTrabajo(t.key)}>
                                            <div className="tico">{t.ico}</div>
                                            <div className="tnom">{t.key}</div>
                                            <div className="tuni">{activo ? t.uni : 'No aplica'}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            {editandoIngresoId ? (
                                <div className="fg2">
                                    <div><label className="fl">{tipoTrabajo === 'Horas' ? 'Horas trabajadas' : `Cantidad (${tipoTrabajo})`}</label><input className={errTrabajo.clase('fi', 'trCantidad')} {...errTrabajo.props('trCantidad')} type="number" value={cantidad} onChange={e => { setCantidad(e.target.value); errTrabajo.limpiar('trCantidad'); }} placeholder="Ej: 8" /><ErrorCampo msg={errTrabajo.errores.trCantidad} /></div>
                                </div>
                            ) : tipoTrabajo === 'Horas' ? (
                                <div className="fg2">
                                    <div><label className="fl">Horómetro inicial</label><input className="fi" type="number" value={maq.horometroActual || 0} disabled /></div>
                                    <div><label className="fl">Horómetro final</label><input className={errTrabajo.clase('fi', 'trHorometro')} {...errTrabajo.props('trHorometro')} type="number" value={horometroFin} onChange={e => { setHorometroFin(e.target.value); errTrabajo.limpiar('trHorometro'); }} placeholder="Ej: 110.5" /><ErrorCampo msg={errTrabajo.errores.trHorometro} /></div>
                                </div>
                            ) : (
                                <div className="fg2">
                                    <div><label className="fl">Cantidad ({tipoTrabajo})</label><input className={errTrabajo.clase('fi', 'trCantidad')} {...errTrabajo.props('trCantidad')} type="number" value={cantidad} onChange={e => { setCantidad(e.target.value); errTrabajo.limpiar('trCantidad'); }} placeholder="Ej: 8" /><ErrorCampo msg={errTrabajo.errores.trCantidad} /></div>
                                </div>
                            )}
                            <div className="fg2">
                                <div><label className="fl">Valor unitario ($)</label><MoneyInput className={errTrabajo.clase('fi', 'trValor')} {...errTrabajo.props('trValor')} value={valorUnitario} onChange={e => { setValorUnitario(e.target.value); errTrabajo.limpiar('trValor'); }} placeholder="Ej: 120.000" /><ErrorCampo msg={errTrabajo.errores.trValor} /></div>
                                <div><label className="fl">Fecha</label><input className="fi" type="date" value={fechaTrabajo} onChange={e => setFechaTrabajo(e.target.value)} /></div>
                            </div>
                            <div className="fg2">
                                <div style={{ gridColumn: '1 / -1' }}><label className="fl">Descripción (opcional)</label><input className="fi" value={descTrabajo} onChange={e => setDescTrabajo(e.target.value)} placeholder="Ej: Obra Av. 30" /></div>
                            </div>
                            <div className="rsum">
                                <h4 style={{display:'flex',alignItems:'center',gap:'6px'}}><ClipboardList size={16} /> Resumen antes de guardar</h4>
                                <div className="rr"><span>Tipo</span><span>{tipoTrabajo}</span></div>
                                <div className="rr"><span>{tipoTrabajo === 'Horas' ? 'Horas trabajadas' : 'Cantidad'}</span><span>{cantidadEfectiva || 0} {tipoTrabajo === 'Horas' ? 'hrs' : 'unidades'}</span></div>
                                <div className="rr"><span>Valor unitario</span><span>{fmt(parseFloat(valorUnitario || 0))}</span></div>
                                {tipoTrabajo === 'Horas' && !editandoIngresoId && <div className="rr"><span>Horómetro: antes → después</span><span style={{ color: '#2980b9' }}>{fmtHoro(maq.horometroActual)} → {fmtHoro(horometroFin)} hrs</span></div>}
                                <div className="rr"><span>Total ingreso</span><span className="pos">{fmt(totalTrabajo)}</span></div>
                            </div>
                            {!editandoIngresoId && (
                                <div className="rbox">
                                    <div><div className="rl">Total calculado</div><div className="rv">{fmt(totalTrabajo)}</div><div className="rf">{cantidadEfectiva || 0} × {fmt(parseFloat(valorUnitario || 0))} = {fmt(totalTrabajo)}</div></div>
                                    <div style={{ textAlign: 'right' }}><div style={{ color: '#6b7a8d', fontSize: '11px' }}>Se agrega a</div><div style={{ color: '#f5a623', fontSize: '12px', fontWeight: '700', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'4px' }}><TrendingUp size={13} /> Ingresos + Horómetro</div></div>
                                </div>
                            )}
                            <div className="fa">
                                <button className="bp" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={guardarIngreso}>
                                    <Check size={14} style={{marginRight:'6px',verticalAlign:'middle'}} /> {editandoIngresoId ? 'Guardar cambios' : 'Registrar trabajo'}
                                </button>
                                {editandoIngresoId && <button className="bs" onClick={cancelarEditarIngreso}>Cancelar</button>}
                            </div>
                        </div>
                    </>
                )}

                {/* TAB 2 — INGRESOS */}
                {tab === 2 && (
                    <>
                        {faenaActiva && <FacturacionPorCorte maq={maq} faena={faenaActiva} ingresos={ingFaena} gastos={gasFaena} onCambio={cargarDatos}
                            onEditar={editarIngreso} onEliminar={(i) => eliminarIngreso(i.id)} />}
                        {faenaActiva && ingFaena.length === 0 && <EmptyState icono={<TrendingUp size={20} />} titulo="Este periodo todavía no tiene ingresos" texto="Registra un trabajo o toca un día del calendario para empezar." accion={{ label: 'Registrar trabajo', onClick: () => setTab(1) }} />}
                        {/* Sin periodo activo se conserva la lista completa con su filtro de fechas */}
                        {!faenaActiva && <>
                        <FiltroRango rangoFiltro={rangoFiltro} setRangoFiltro={setRangoFiltro}
                            fechaDesde={fechaDesdeMaq} setFechaDesde={setFechaDesdeMaq}
                            fechaHasta={fechaHastaMaq} setFechaHasta={setFechaHastaMaq} />
                        <div className="tbl tbl-r">
                            <div className="th">
                                <strong style={{display:'flex',alignItems:'center',gap:'5px'}}><TrendingUp size={14} /> Ingresos — {rangoFiltro === 'periodo' ? (faenaActiva ? faenaActiva.nombreObra : 'sin periodo') : `total ${fmt(totalIngF)}`}</strong>
                            </div>
                        </div>
                        <AgrupadoPorCorte modo="ingresos" items={ingOrdenadosF} faenas={faenasMaq} onEditar={editarIngreso} onEliminar={(i) => eliminarIngreso(i.id)} />
                        {ingOrdenadosF.length === 0 && <EmptyState icono={<TrendingUp size={20} />} titulo="No hay ingresos en este rango" texto="Prueba con otro filtro de fechas o registra un trabajo nuevo." accion={{ label: 'Registrar trabajo', onClick: () => setTab(1) }} />}
                        </>}
                    </>
                )}

                {/* TAB 3 — GASTOS */}
                {tab === 3 && (
                    <>
                        {!faenaActiva && <div className="mq-fold">
                            <button type="button" className={`mq-fold-btn ${formGastoAbierto || editandoGastoId ? 'on' : ''}`} aria-expanded={!!(formGastoAbierto || editandoGastoId)}
                                onClick={() => { if (editandoGastoId) { cancelarEditar(); setFormGastoAbierto(false); } else setFormGastoAbierto(v => !v); }}>
                                {formGastoAbierto || editandoGastoId ? <X size={15} /> : <Plus size={15} />} {formGastoAbierto || editandoGastoId ? 'Cerrar formulario' : 'Registrar gasto'}
                            </button>
                        </div>}
                        {(formGastoAbierto || editandoGastoId) && (
                            <GastoModal editando={!!editandoGastoId} form={gastoForm} setForm={setGastoForm} errores={errGasto}
                                cargandoIA={cargandoIA} onLeerIA={leerConIA}
                                pagadores={pagadores} onCrearPagador={crearPagador} onAdministrarPagadores={() => setAdminPag(true)}
                                faenas={faenasMaq} maquina={maq.nombre} faenaActiva={faenaActiva}
                                destino={gastoDestino || destinoPorDefecto(faenasMaq, maq.nombre)} onDestino={setGastoDestino}
                                onAbrirDestino={async (nombre) => { const r = await createFaena({ maquinaNombre: maq.nombre, nombreObra: nombre, tipo: 'gastos' }); cargarFaena(); setGastoDestino(String(r.data.id)); toast('Periodo de gastos externos abierto'); }}
                                factura={gastoFactura} setFactura={setGastoFactura}
                                tieneFacturaGuardada={!!editandoGastoId && facturasIds.has(String(editandoGastoId))}
                                onVerFactura={() => abrirFactura(editandoGastoId)}
                                onQuitarFacturaGuardada={async () => { await eliminarFactura(editandoGastoId).catch(() => {}); setFacturasIds(prev => { const q = new Set(prev); q.delete(String(editandoGastoId)); return q; }); }}
                                onGuardar={guardarGasto}
                                onCerrar={() => { cancelarEditar(); setFormGastoAbierto(false); }} />
                        )}
                        {faenaActiva && (
                            <GastosPorCorte faena={faenaActiva} gastos={gasFaena} ingresos={ingFaena}
                                externos={extAbierto ? { nombre: extAbierto.nombreObra || 'sin nombre', items: gastos.filter(g => String(g.faenaId) === String(extAbierto.id)) } : null}
                                sueltos={gastos.filter(g => !g.faenaId)}
                                onRegistrar={() => setFormGastoAbierto(true)}
                                renderAcciones={accionesGasto} />
                        )}
                        {/* Sin periodo activo se conserva la lista completa con su filtro de fechas */}
                        {!faenaActiva && <>
                        <FiltroRango rangoFiltro={rangoFiltro} setRangoFiltro={setRangoFiltro}
                            fechaDesde={fechaDesdeMaq} setFechaDesde={setFechaDesdeMaq}
                            fechaHasta={fechaHastaMaq} setFechaHasta={setFechaHastaMaq}
                            extra={extAbierto ? [{ key: 'externo', label: 'Gastos externos' }] : []} />
                        <div className="tbl tbl-r">
                            <div className="th">
                                <strong style={{display:'flex',alignItems:'center',gap:'5px'}}><TrendingDown size={14} /> Gastos — {rangoFiltro === 'periodo' ? (faenaActiva ? faenaActiva.nombreObra : 'sin periodo') : rangoFiltro === 'externo' ? `${extAbierto?.nombreObra || 'gastos externos'} · total ${fmt(totalGasF)}` : `total ${fmt(totalGasF)}`}</strong>
                            </div>
                        </div>
                        <AgrupadoPorCorte modo="gastos" items={gasOrdenadosF} faenas={faenasMaq}
                            envoltura="tbl tbl-r" claseFila="tr" claseCab="tr hdr"
                            cabecera={['Fecha', { t: 'Descripción', c: 'w2' }, 'Pagó', 'Categoría', { t: 'Total', c: 'amt' }, 'Acc.']}
                            renderFila={g => (
                                <>
                                    <span>{fmtFecha(g.fecha)}</span><span className="w2">{g.descripcion}{g.pagadoPor ? <small className="mq-pago">Pagó: {g.pagadoPor}</small> : null}</span>
                                    <span className="mq-pagocol">{g.pagadoPor || '—'}</span>
                                    <span><span className={`mq-catpill mq-cat-${claseCategoria(g.categoria)}`}><i></i>{g.categoria}</span></span>
                                    <span className="neg amt">{fmt(g.monto)}</span>
                                    {accionesGasto(g)}
                                                                </>
                            )} />
                        {gasOrdenadosF.length === 0 && <EmptyState icono={<TrendingDown size={20} />} titulo="No hay gastos en este rango" texto="Prueba con otro filtro de fechas o registra un gasto con el formulario de arriba." accion={{ label: 'Registrar gasto', onClick: () => document.querySelector('[data-campo="gsDesc"]')?.focus() }} />}
                        </>}
                    </>
                )}

                {/* TAB 4 — COMBUSTIBLE */}
                {tab === 4 && (
                    <>
                        <div className="fc">
                            <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><Fuel size={18} /> Registrar carga de combustible</h3>
                            <p className="fd">El gasto se crea automáticamente en Finanzas</p>
                            <div className="fg3">
                                <div><label className="fl">Galones</label><input className={errComb.clase('fi', 'cbGalones')} {...errComb.props('cbGalones')} type="number" value={galones} onChange={e => { setGalones(e.target.value); errComb.limpiar('cbGalones'); }} placeholder="Ej: 50" /><ErrorCampo msg={errComb.errores.cbGalones} /></div>
                                <div><label className="fl">Precio/galón ($)</label><MoneyInput className={errComb.clase('fi', 'cbPrecio')} {...errComb.props('cbPrecio')} value={precioPorGalon} onChange={e => { setPrecioPorGalon(e.target.value); errComb.limpiar('cbPrecio'); }} placeholder="Ej: 12.500" /><ErrorCampo msg={errComb.errores.cbPrecio} /></div>
                                <div><label className="fl">Horómetro al cargar</label><input className="fi" type="number" value={horoComb} onChange={e => setHoroComb(e.target.value)} /></div>
                            </div>
                            <div className="fg2">
                                <div><label className="fl">Fecha</label><input className="fi" type="date" value={fechaComb} onChange={e => setFechaComb(e.target.value)} /></div>
                            </div>
                            <div className="rbox">
                                <div><div className="rl">Total del gasto</div><div className="rv">{fmt(totalComb)}</div><div className="rf">{galones || 0} gal × {fmt(parseFloat(precioPorGalon || 0))}</div></div>
                                <div style={{ textAlign: 'right' }}><div style={{ color: '#6b7a8d', fontSize: '11px' }}>Se agrega a</div><div style={{ color: '#e74c3c', fontSize: '12px', fontWeight: '700', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'4px' }}><TrendingDown size={13} /> Gastos de esta máquina</div></div>
                            </div>
                            <div className="fa">
                                <button className="bp" onClick={registrarCombustible}>
                                    <Fuel size={14} style={{marginRight:'6px',verticalAlign:'middle'}} /> Registrar carga
                                </button>
                            </div>
                        </div>
                        <FiltroRango rangoFiltro={rangoFiltro} setRangoFiltro={setRangoFiltro}
                            fechaDesde={fechaDesdeMaq} setFechaDesde={setFechaDesdeMaq}
                            fechaHasta={fechaHastaMaq} setFechaHasta={setFechaHastaMaq} />
                        <div className="tbl tbl-r">
                            <div className="th">
                                <strong>Combustible — {rangoFiltro === 'periodo' ? (faenaActiva ? faenaActiva.nombreObra : 'sin periodo') : `total ${fmt(totalCombF)}`}</strong>
                                <div className="th-s"><Search size={14} /><input type="text" placeholder="Buscar..." value={buscarComb} onChange={e => setBuscarComb(e.target.value)} /></div>
                            </div>
                            <div className="tr hdr">
                                <ThCombF campo="fecha">Fecha</ThCombF>
                                <ThCombF campo="galones">Galones</ThCombF>
                                <ThCombF campo="precioPorGalon" className="amt">$/Galón</ThCombF>
                                <span>Horómetro</span>
                                <ThCombF campo="total" className="amt">Total</ThCombF>
                                <span>Acc.</span>
                            </div>
                            {pagCombF.paginados.map(c => (
                                <div className="tr" key={c.id}>
                                    <span>{fmtFecha(c.fecha)}</span><span>{c.galones} gal</span>
                                    <span className="amt">{fmt(c.precioPorGalon)}</span>
                                    <span>{c.horometro ? fmtHoro(c.horometro) : '—'}</span>
                                    <span className="neg amt">{fmt(c.total)}</span>
                                    <span><button className="icon-btn" onClick={() => eliminarComb(c.id)}><Trash2 size={14} /></button></span>
                                </div>
                            ))}
                            {combOrdenadosF.length === 0 && <EmptyState icono={<Fuel size={20} />} titulo="No hay cargas de combustible en este rango" texto="Prueba con otro filtro de fechas o registra una carga con el formulario de arriba." accion={{ label: 'Registrar carga', onClick: () => document.querySelector('[data-campo="cbGalones"]')?.focus() }} />}
                            <Paginacion pagina={pagCombF.pagina} total={pagCombF.total} ir={pagCombF.ir} totalItems={combOrdenadosF.length} porPagina={20} />
                        </div>
                    </>
                )}

                {/* TAB 5 — FAENA */}
                {tab === 5 && (
                    <div>
                        {faenaActiva ? (
                            <>
                                {/* Faena activa: info + resumen + cerrar */}
                                <div className="mq-job-card" style={{ marginBottom: '14px' }}>
                                    <div className="mq-job-top">
                                        <div>
                                            <div className="mq-job-name">
                                                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27ae60', display: 'inline-block' }}></span>
                                                {faenaActiva.nombreObra}
                                            </div>
                                            <div className="mq-job-meta">
                                                {faenaActiva.cliente && <span>Cliente: {faenaActiva.cliente}</span>}
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={11} /> Inicio: {fmtFecha(faenaActiva.fechaInicio)}
                                                </span>
                                            </div>
                                            {faenaActiva.nota && <p style={{ fontSize: '12px', color: '#6b7a8d', marginTop: '4px' }}>{faenaActiva.nota}</p>}
                                        </div>
                                        <span className="mq-pill ok">En campo</span>
                                    </div>

                                    {/* Resumen en tiempo real */}
                                    <div className="mq-job-grid">
                                        <div className="mq-job-tile good"><div className="mq-job-tile-l">Ingresos</div><div className="mq-job-tile-v mq-num" style={{ color: '#1c8a4b' }}>{fmt(totalIngresos)}</div></div>
                                        <div className="mq-job-tile bad"><div className="mq-job-tile-l">Gastos</div><div className="mq-job-tile-v mq-num" style={{ color: '#c0392b' }}>{fmt(totalGastos)}</div></div>
                                        <div className="mq-job-tile info"><div className="mq-job-tile-l">Horas</div><div className="mq-job-tile-v mq-num" style={{ color: '#1f6491' }}>{fmtHoras(horasFaena)}</div></div>
                                        <div className="mq-job-tile gold"><div className="mq-job-tile-l">Utilidad</div><div className="mq-job-tile-v mq-num" style={{ color: totalIngresos - totalGastos >= 0 ? '#1c8a4b' : '#c0392b' }}>{fmt(totalIngresos - totalGastos)}</div></div>
                                    </div>

                                    {promedioDiasCampo && (
                                        <>
                                            <div className="mq-progress-track"><div className="mq-progress-fill" style={{ width: `${Math.min((diasCampoActual / promedioDiasCampo) * 100, 100)}%` }} /></div>
                                            <div className={`mq-progress-note ${diasCampoActual > promedioDiasCampo ? '' : 'calm'}`}>
                                                {diasCampoActual > promedioDiasCampo ? '⚠ ' : ''}{diasCampoActual} días en campo — {diasCampoActual > promedioDiasCampo ? 'por encima del' : 'dentro del'} promedio histórico de {promedioDiasCampo} días para esta máquina
                                            </div>
                                        </>
                                    )}
                                </div>

                                <CortesFaena faena={faenaActiva} ingresos={ingFaena} gastos={gasFaena} onCambio={cargarDatos} onCompartir={abrirCompartir} />

                                <details className="mq-mas">
                                    <summary>Más acciones</summary>
                                    <div className="mq-mas-cuerpo">
                                        <div className="ale red">
                                            <StopCircle size={18} color="#e74c3c" />
                                            <div>
                                                <p>Rendir cuentas — cerrar periodo</p>
                                                <span className="ale-desc">Al confirmar, se archivará el resumen financiero y los registros de esta máquina volverán a cero. El periodo quedará guardado en el módulo <strong>Periodos</strong>.</span>
                                            </div>
                                        </div>
                                        <button className="bp" style={{ background: '#c0392b', width: '100%', justifyContent: 'center', padding: '13px', marginTop: '10px' }}
                                            onClick={handleCerrarFaena}>
                                            <StopCircle size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                                            Rendir cuentas / Cerrar periodo
                                        </button>
                                    </div>
                                </details>
                            </>
                        ) : (
                            <>
                                <div className="ale blue">
                                    <Briefcase size={18} color="#2980b9" />
                                    <div>
                                        <p>No hay periodo activo para {maq.nombre}</p>
                                        <span className="ale-desc">Cuando la máquina salga a trabajar, abre un periodo. Todos los ingresos, gastos y horas quedarán registrados en ese periodo hasta que se rindan cuentas.</span>
                                    </div>
                                </div>

                                {!mostrarFormFaena ? (
                                    <button className="bp" style={{ width: '100%', justifyContent: 'center', padding: '13px', marginTop: '10px' }}
                                        onClick={() => setMostrarFormFaena(true)}>
                                        <Plus size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                                        Abrir nuevo periodo
                                    </button>
                                ) : (
                                    <div className="fc" style={{ marginTop: '10px' }}>
                                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Briefcase size={18} /> Abrir periodo para {maq.nombre}
                                        </h3>
                                        <div className="fg2">
                                            <div>
                                                <label className="fl">Nombre de la obra *</label>
                                                <input className={errFaena.clase('fi', 'fnObra')} {...errFaena.props('fnObra')} value={formFaena.nombreObra}
                                                    onChange={e => { setFormFaena({ ...formFaena, nombreObra: e.target.value }); errFaena.limpiar('fnObra'); }}
                                                    placeholder="Ej: Carretera Vía Caucasia" />
                                                <ErrorCampo msg={errFaena.errores.fnObra} />
                                            </div>
                                            <div>
                                                <label className="fl">Cliente</label>
                                                <input className="fi" value={formFaena.cliente}
                                                    onChange={e => setFormFaena({ ...formFaena, cliente: e.target.value })}
                                                    placeholder="Ej: Municipio de..." />
                                            </div>
                                        </div>
                                        <div className="fg2">
                                            <div>
                                                <label className="fl">Fecha inicio</label>
                                                <input className="fi" type="date" value={formFaena.fechaInicio}
                                                    onChange={e => setFormFaena({ ...formFaena, fechaInicio: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="fl">Nota (opcional)</label>
                                                <input className="fi" value={formFaena.nota}
                                                    onChange={e => setFormFaena({ ...formFaena, nota: e.target.value })}
                                                    placeholder="Observaciones" />
                                            </div>
                                        </div>
                                        <div className="fa">
                                            <button className="bp" onClick={abrirFaena}>
                                                <Check size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Abrir periodo
                                            </button>
                                            <button className="bs" onClick={() => setMostrarFormFaena(false)}>Cancelar</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {adminPag && <AdministrarPagadores pagadores={pagadores} gastos={gastos} onCambio={async () => { await recargarPagadores(); await refreshGastos(); }} onCerrar={() => setAdminPag(false)} />}
                {/* TAB 7 — HISTORIA */}
                {tab === 7 && (
                    <HistoriaMaquina
                        ingresos={ingresos}
                        gastos={gastos}
                        combustibles={combustibles}
                        mantenimientos={mantenimientos}
                        faenas={faenasMaq}
                        pagos={pagos}
                    />
                )}

                {/* TAB 6 — PAGOS CLIENTES */}
                {tab === 6 && (
                    <>
                        <div className="fc">
                            <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><CreditCard size={18} /> {editandoPagoId ? 'Editar pago' : 'Registrar pago de cliente'}</h3>
                            <p className="fd">El pago queda asociado a {maq.nombre} automáticamente</p>
                            <label className="fl">Cliente *</label>
                            <input className={errPago.clase('fi', 'pagoCliente')} {...errPago.props('pagoCliente')} value={pagoForm.cliente}
                                onChange={e => { setPagoForm({ ...pagoForm, cliente: e.target.value }); errPago.limpiar('pagoCliente'); }} placeholder="Ej: Municipio de..." />
                            <ErrorCampo msg={errPago.errores.pagoCliente} />
                            <div className="fg2-keep">
                                <div><label className="fl">Total ($)</label><MoneyInput className="fi" value={pagoForm.valorTotal} onChange={e => setPagoForm({ ...pagoForm, valorTotal: e.target.value })} /></div>
                                <div><label className="fl">Pagado ($)</label><MoneyInput className="fi" value={pagoForm.valorPagado} onChange={e => setPagoForm({ ...pagoForm, valorPagado: e.target.value })} /></div>
                            </div>
                            <Opcional label="Descripción y fecha (opcional)" abierto={!!editandoPagoId && !!pagoForm.descripcion}>
                                <div className="fg2-keep">
                                    <div><label className="fl">Descripción</label><input className="fi" value={pagoForm.descripcion} onChange={e => setPagoForm({ ...pagoForm, descripcion: e.target.value })} placeholder="Ej: Abono obra" /></div>
                                    <div><label className="fl">Fecha</label><input className="fi" type="date" value={pagoForm.fecha} onChange={e => setPagoForm({ ...pagoForm, fecha: e.target.value })} /></div>
                                </div>
                            </Opcional>
                            <div className="fa">
                                <button className="bp" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={guardarPago}>
                                    <Check size={14} style={{marginRight:'6px',verticalAlign:'middle'}} /> {editandoPagoId ? 'Guardar cambios' : 'Registrar pago'}
                                </button>
                                {editandoPagoId && <button className="bs" onClick={cancelarEditarPago}>Cancelar</button>}
                            </div>
                        </div>
                        <div className="tbl">
                            <div className="th"><strong>Pagos de clientes — {maq.nombre}</strong></div>
                            {pagos.length === 0 ? (
                                <EmptyState
                                    icono={<CreditCard size={20} />}
                                    titulo="Aún no hay pagos de esta máquina"
                                    texto={`Registra lo que te pagan los clientes por el trabajo de ${maq.nombre}.`}
                                    accion={{ label: 'Registrar el primero', onClick: () => document.querySelector('[data-campo="pagoCliente"]')?.focus() }}
                                />
                            ) : (
                                <>
                                    <div className="tr hdr only-desk">
                                        <span>Fecha</span><span className="w2">Cliente</span><span className="w2">Descripción</span>
                                        <span className="amt">Total</span><span className="amt">Pagado</span><span className="amt">Saldo</span><span>Estado</span><span>Acc.</span>
                                    </div>
                                    {pagos.map(p => (
                                        <div className="tr only-desk" key={p.id}>
                                            <span>{fmtFecha(p.fecha)}</span>
                                            <span className="w2">{p.cliente}</span>
                                            <span className="w2">{p.descripcion || '—'}</span>
                                            <span className="amt">{fmt(p.valorTotal)}</span>
                                            <span className="pos amt">{fmt(p.valorPagado)}</span>
                                            <span className="neg amt">{fmt(p.saldoPendiente)}</span>
                                            <span><Estado valor={p.estado} /></span>
                                            <span>
                                                <button className="icon-btn" aria-label="Editar pago" onClick={() => editarPago(p)}><Pencil size={14} /></button>
                                                <button className="icon-btn" aria-label="Borrar pago" onClick={() => eliminarPago(p.id)}><Trash2 size={14} /></button>
                                            </span>
                                        </div>
                                    ))}
                                    {pagos.map(p => (
                                        <div className="mcard only-mob" key={p.id}>
                                            <div className="mcard-top"><span className="mcard-t">{p.cliente}</span><Estado valor={p.estado} /></div>
                                            {p.descripcion && <div className="mcard-d">{p.descripcion}</div>}
                                            <div className="mcard-nums">
                                                <div><span>Total</span><b>{fmt(p.valorTotal)}</b></div>
                                                <div><span>Pagado</span><b className="pos">{fmt(p.valorPagado)}</b></div>
                                                <div><span>Saldo</span><b className={p.saldoPendiente > 0 ? 'neg' : ''}>{fmt(p.saldoPendiente)}</b></div>
                                            </div>
                                            <div className="mcard-foot">
                                                <span>{fmtFecha(p.fecha)}</span>
                                                <span>
                                                    <button className="icon-btn" aria-label="Editar pago" onClick={() => editarPago(p)}><Pencil size={15} /></button>
                                                    <button className="icon-btn" aria-label="Borrar pago" onClick={() => eliminarPago(p.id)}><Trash2 size={15} /></button>
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </>
                )}

            </div></div>
        </div>

        {/* Modal Compartir */}
        {modalCompartir && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '80vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', color: '#1a2d42' }}>
                            <Share2 size={18} /> Compartir vista de solo lectura
                        </h3>
                        <button onClick={() => setModalCompartir(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa5b4' }}><X size={18} /></button>
                    </div>
                    <p style={{ color: '#6b7a8d', fontSize: '13px', marginBottom: '16px' }}>
                        Genera un enlace que muestra los datos de <strong>{maq.nombre}</strong> en modo solo lectura. Ideal para socios o contadores.
                    </p>

                    <label className="fl">¿Qué vas a compartir?</label>
                    <select className="fsel" value={alcanceCompartir} onChange={e => setAlcanceCompartir(e.target.value)}>
                        <option value="">Toda la máquina (todos los periodos)</option>
                        {faenasCompartir.map(f => (
                            <option key={f.id} value={String(f.id)}>
                                Solo el periodo: {f.nombreObra} {f.estado === 'activa' ? '(en campo)' : f.estado === 'abierta' ? '(gastos externos, abierto)' : '(cerrado)'}
                            </option>
                        ))}
                        {faenasCompartir.filter(f => f.estado === 'activa' && f.tipo !== 'gastos').map(f => (
                            <option key={`curso${f.id}`} value={`curso:${f.id}`}>Solo el corte en curso (desde {fmtFecha(desdeEnCurso(f))}) · {f.nombreObra || 'periodo'}</option>
                        ))}
                        {cortesCompartir.map(c => (
                            <option key={`c${c.id}`} value={`c:${c.id}`}>Solo el corte: {etiquetaCorte(c)}</option>
                        ))}
                    </select>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                        <input
                            className="fi"
                            style={{ flex: 1, margin: 0 }}
                            placeholder="Etiqueta (ej: Para el contador)"
                            value={nombreEnlace}
                            onChange={e => setNombreEnlace(e.target.value)}
                        />
                        <button className="bp" onClick={crearNuevoEnlace} style={{ whiteSpace: 'nowrap' }}>
                            <Plus size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Crear
                        </button>
                    </div>

                    {cargandoEnlaces ? (
                        <p style={{ color: '#9aa5b4', fontSize: '13px', textAlign: 'center' }}>Cargando…</p>
                    ) : enlaces.length === 0 ? (
                        <p style={{ color: '#c8d6e5', fontSize: '13px', textAlign: 'center' }}>Sin enlaces activos</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {enlaces.map(e => (
                                <div key={e.token} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: '600', fontSize: '13px', color: '#1a2d42' }}>{e.nombre}</div>
                                            <div style={{ fontSize: '11px', color: e.faenaId ? '#f5a623' : '#9aa5b4', fontWeight: e.faenaId ? '600' : '400' }}>
                                                {e.corteEnCurso
                                                    ? `Corte en curso: ${(() => { const f = faenasCompartir.find(x => x.id === e.faenaId); return f ? `desde ${fmtFecha(desdeEnCurso(f))} · ${f.nombreObra || 'periodo'}` : 'periodo'; })()}`
                                                    : e.corteId
                                                    ? `Corte: ${(() => { const c = cortesCompartir.find(x => x.id === e.corteId); return c ? etiquetaCorte(c) : `#${e.corteId}`; })()}`
                                                    : e.faenaId
                                                        ? `Periodo: ${faenasCompartir.find(f => f.id === e.faenaId)?.nombreObra || `#${e.faenaId}`}`
                                                        : 'Toda la máquina'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#9aa5b4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {window.location.origin}/?token={e.token}
                                            </div>
                                        </div>
                                        <button className="bs" onClick={() => toggleVistas(e.token)} title="Ver quién lo ha visitado" style={{ padding: '6px 10px' }}>
                                            <Eye size={13} />
                                        </button>
                                        <button className="bs" onClick={() => copiarLink(e.token)} title="Copiar enlace" style={{ padding: '6px 10px' }}>
                                            <Copy size={13} />
                                        </button>
                                        <button onClick={() => revocar(e.token)} title="Revocar" style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#e74c3c' }}>
                                            <Trash size={13} />
                                        </button>
                                    </div>
                                    {vistasAbiertas === e.token && (
                                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                                            {cargandoVistas && !vistasPorToken[e.token] ? (
                                                <p style={{ fontSize: '12px', color: '#9aa5b4', margin: 0 }}>Cargando visitas…</p>
                                            ) : (vistasPorToken[e.token] || []).length === 0 ? (
                                                <p style={{ fontSize: '12px', color: '#9aa5b4', margin: 0 }}>Nadie ha abierto este enlace todavía.</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                                                    {vistasPorToken[e.token].map(v => (
                                                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                                            <span style={{ color: '#1a2d42', fontWeight: '600' }}>{v.nombreVisitante}</span>
                                                            <span style={{ color: '#9aa5b4' }}>{new Date(v.fecha).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
        </>
    );
}

export default Maquinaria;
