import { useState, useEffect } from 'react';
import Monto from '../../utils/Monto';
import { usePaginacion, Paginacion } from '../../utils/Paginacion';
import { useSortable } from '../../utils/useSortable';
import {
    getMaquinas,
    getIngresos, createIngreso, updateIngreso, deleteIngreso,
    getGastos, createGasto, updateGasto, deleteGasto,
    getSalarios, createSalario, updateSalario, deleteSalario,
    getPagos, createPago, updatePago, deletePago,
    getFaenas, createFaena,
    contarRegistrosHuerfanos, limpiarRegistrosHuerfanos,
    getPagosOperador, getCortes, getHoras, deletePagoOperador,
} from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import { TrendingUp, TrendingDown, BarChart2, Plus, Check, Pencil, Trash2, HardHat, CreditCard, FileText, Paperclip, X, Search, Fuel, Wrench, Info, AlertTriangle, Tractor } from 'lucide-react';
import MoneyInput from '../../utils/MoneyInput';
import FiltroChips from '../../utils/FiltroChips';
import { salarioCuenta, esPagoOperador } from '../../utils/nomina';
import { estadoCausado, nombreEstadoCausado } from '../../utils/causacion';
import { OperadoresPeriodo, PagosClientesPeriodo } from './PorPeriodo';
import { calcularOperadores, EditarGastoOperadorModal } from './Carteras';
import PagarOperadorModal from '../Operadores/PagarOperadorModal';
import Estado from '../../utils/Estado';
import EmptyState from '../../utils/EmptyState';
import { ErrorCarga } from '../../utils/EstadosCarga';
import { fmtFecha } from '../../utils/fmtFecha';
import { guardarFactura, eliminarFactura, abrirFactura } from '../../utils/facturaAPI';
import { QuienPago, usePagadores, AdministrarPagadores } from '../Gastos/QuienPago';
import ReporteGastosPersona from '../Gastos/ReporteGastosPersona';
import AgrupadoPorCorte from '../Faenas/AgrupadoPorCorte';
import DestinoGasto, { destinoPorDefecto, faenaIdDeDestino, destinoDeGasto } from '../Gastos/DestinoGasto';
import { quienPago, SIN_ASIGNAR } from '../../utils/gastosPersona';
import './Finanzas.css';
import './FinanzasModerno.css';

const fmt = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().split('T')[0];

const FORM_ING  = { descripcion: '', tipoTrabajo: 'Horas', cantidad: 0, valorUnitario: 0, fecha: hoy(), maquinaNombre: '' };
const FORM_GAS  = { descripcion: '', categoria: '', monto: 0, fecha: hoy(), maquinaNombre: '', pagadoPor: '' };
// Sugerencias fijas del selector de categoría — no se le agregan categorías personalizadas
// que el usuario haya escrito antes, para que el picker no crezca sin control
const CATEGORIAS_SUGERIDAS_GASTO = ['Reparación', 'Repuestos', 'Combustible', 'Lubricantes'];
const FORM_SAL  = { operadorNombre: '', maquinaNombre: '', horasTrabajadas: 0, valorHora: 0, anticipos: 0, estado: 'Pendiente', fecha: hoy() };
const FORM_PAG  = { cliente: '', maquinaNombre: '', descripcion: '', valorTotal: 0, valorPagado: 0, fecha: hoy() };

const CATEGORIA_CLASE = {
    'Reparación': 'info', 'Repuestos': 'gold', 'Combustible': 'orange',
    'Mantenimiento': 'golddeep', 'Salario': 'purple', 'Lubricantes': 'purple', 'Pago operador': 'purple',
    'Otros': 'neutral', 'Otro': 'neutral',
};
const claseCategoria = (cat) => CATEGORIA_CLASE[cat] || 'neutral';

// El gasto "Pago operador" se crea con la descripción "Pago operador — Nombre: detalle"
const partesPagoOp = (g) => {
    const t = String(g.descripcion || '').replace(/^Pago operador\s*[—-]\s*/, '');
    const i = t.indexOf(':');
    return i < 0 ? { operador: t || 'Operador', detalle: '' } : { operador: t.slice(0, i).trim(), detalle: t.slice(i + 1).trim() };
};

const GRID = {
    ingresos: '70px 1.8fr 1fr 84px 90px 104px 60px',
    gastos:   '70px 1.5fr 120px 1fr 110px 100px 150px',
    salarios: '1.3fr 64px 84px 96px 96px 96px 84px 60px',
    pagosop:  '70px 1.8fr 1fr 110px 90px',
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
    const { pagadores, recargar: recargarPagadores, crear: crearPagador } = usePagadores();
    const [adminPag, setAdminPag]               = useState(false);
    const [destGas, setDestGas]                = useState(''); // '' = el que corresponda por defecto
    const [huerfanos, setHuerfanos]            = useState(null);
    const [limpiando, setLimpiando]            = useState(false);
    const [verRepPersona, setVerRepPersona]     = useState(false);
    const [pagFiltro, setPagFiltro]             = useState('');

    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(false);
    const [horasF, setHorasF] = useState([]);       // horas trabajadas, para saber lo que va ganando cada operador en su corte actual
    const [pagarOp, setPagarOp] = useState(null);     // { operador, saldo, edicion }: formulario para editar un pago a operador
    const [editGasto, setEditGasto] = useState(null);   // costo causado por un corte (o pago viejo) que se está editando
    const [pagosOp, setPagosOp] = useState([]);   // pagos hechos a operadores (para saber cuánto de cada corte está pagado)
    const [cortesF, setCortesF] = useState([]);    // cortes, para ligar cada pago de cliente a su periodo
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

    // Registros que quedaron de periodos eliminados (se eliminaron antes de que el borrado fuera en cascada)
    const revisarHuerfanos = () => contarRegistrosHuerfanos().then(r => setHuerfanos(r.data)).catch(() => {});
    useEffect(() => { revisarHuerfanos(); }, []);
    const totalHuerfanos = huerfanos ? Object.values(huerfanos).reduce((a, v) => a + (Number(v) || 0), 0) : 0;
    const limpiarHuerfanos = async () => {
        const partes = huerfanos ? [['ingresos', 'ingresos'], ['gastos', 'gastos'], ['combustibles', 'cargas de combustible'], ['mantenimientos', 'mantenimientos'], ['horas', 'registros de horas'], ['cortes', 'cortes']]
            .filter(([k]) => huerfanos[k] > 0).map(([k, t]) => `${huerfanos[k]} ${t}`).join(', ') : '';
        if (!await confirm(`Se van a borrar ${partes}. Son de periodos que ya eliminaste. Esta acción no se puede deshacer. ¿Continuar?`)) return;
        setLimpiando(true);
        try {
            await limpiarRegistrosHuerfanos();
            toast('Listo, se borraron los registros de periodos eliminados');
            await Promise.all([cargarTodo(), revisarHuerfanos()]);
        } catch { toast('No se pudieron borrar. Intenta de nuevo.', 'e'); }
        setLimpiando(false);
    };
    useEffect(() => { setTab(tabInicial); }, [tabInicial]);

    const cargarTodo = () => {
        setCargando(true);
        setErrorCarga(false);
        Promise.all([
            getMaquinas(),
            getIngresos(),
            getGastos(),
            getSalarios(),
            getPagos(),
            getFaenas(),
            getPagosOperador().catch(() => ({ data: [] })),
            getCortes().catch(() => ({ data: [] })),
            getHoras().catch(() => ({ data: [] })),
        ]).then(([maqR, ingR, gasR, salR, pagR, faeR, popR, corR, horR]) => {
            setHorasF(horR.data || []);
            setPagosOp(popR.data || []);
            setCortesF(corR.data || []);
            setMaquinas(maqR.data);
            setIngresos(ingR.data);
            setGastos(gasR.data);
            setFacturasIds(new Set((gasR.data || []).filter(g => g.tieneFactura).map(g => String(g.id))));
            setSalarios(salR.data);
            setPagos((pagR.data || []).map(normalizarPago));
            setFaenas(faeR.data || []);
        }).catch(e => { console.error(e); setErrorCarga(true); }).finally(() => setCargando(false));
    };

    const abrirNuevo = () => {
        setEditandoId(null);
        setFormIng(FORM_ING); setFormGas(FORM_GAS); setFormSal(FORM_SAL); setFormPag(FORM_PAG);
        setDestGas('');
        setGastoFactura(null);
        setMostrarForm(true);
    };

    const abrirEditar = (item) => {
        setEditandoId(item.id);
        if (tab === 'ingresos') setFormIng({ ...item });
        if (tab === 'gastos')   { setFormGas({ ...item }); setDestGas(destinoDeGasto(item)); }
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
        if (tab === 'gastos') {
            const fid = faenaIdDeDestino(destGas || destinoPorDefecto(faenas, formGas.maquinaNombre));
            const payload = fid !== undefined ? { ...formGas, faenaId: fid } : formGas;
            op = esEditar ? updateGasto(editandoId, payload) : createGasto(payload);
        }
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
    const gasFiltrados = gasPeriodo.filter(g => !q || g.descripcion?.toLowerCase().includes(q) || g.maquinaNombre?.toLowerCase().includes(q) || g.categoria?.toLowerCase().includes(q)).filter(g => !maqFiltro || g.maquinaNombre === maqFiltro).filter(g => !pagFiltro || quienPago(g) === pagFiltro);
    const salFiltrados = salPeriodo.filter(s => !q || s.operadorNombre?.toLowerCase().includes(q) || s.maquinaNombre?.toLowerCase().includes(q)).filter(s => !maqFiltro || s.maquinaNombre === maqFiltro);
    const pagFiltrados = pagPeriodo.filter(p => !q || p.cliente?.toLowerCase().includes(q) || p.maquinaNombre?.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q)).filter(p => !maqFiltro || p.maquinaNombre === maqFiltro);

    // Periodos (faenas) con los que se agrupan Ingresos y Gastos: el periodo es el padre y sus cortes
    // son los hijos. Si hay una máquina elegida solo van los suyos.
    const faenasVisibles = faenas.filter(f => !maqFiltro || f.maquinaNombre === maqFiltro);

    // totales respetan el filtro de período activo
    const totalIngresos  = ingFiltrados.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const totalGastos    = gasFiltrados.reduce((a, g) => a + (Number(g.monto) || 0), 0);
    const totalSalarios  = salFiltrados.reduce((a, s) => a + (Number(s.totalNeto) || 0), 0);
    // A egresos solo entran los salarios anotados a mano; el automático del cierre de periodo es
    // informativo. Lo pagado al operador ya viene dentro de Gastos (categoría "Pago operador").
    const salariosEgreso = salFiltrados.filter(salarioCuenta);
    const totalEgresos   = totalGastos + salariosEgreso.reduce((a, s) => a + (Number(s.totalNeto) || 0), 0);
    const utilidad       = totalIngresos - totalEgresos;
    const margen         = totalIngresos > 0 ? Math.round((utilidad / totalIngresos) * 100) : 0;

    // cobranza: ignora el filtro de período (es saldo vivo, no un movimiento del mes), pero sí
    // respeta la máquina seleccionada — si no, "Ver finanzas de X" mostraba cobranza de otras máquinas.
    const pagosCobranza     = maqFiltro ? pagos.filter(p => p.maquinaNombre === maqFiltro) : pagos;
    const totalPorCobrar   = pagosCobranza.reduce((a, p) => a + (Number(p.saldoPendiente) || 0), 0);
    const totalCobrado     = pagosCobranza.reduce((a, p) => a + (Number(p.valorPagado) || 0), 0);
    const totalContratado  = pagosCobranza.reduce((a, p) => a + (Number(p.valorTotal) || 0), 0);
    const pctCobrado       = totalContratado > 0 ? Math.round((totalCobrado / totalContratado) * 100) : 0;

    const { sorted: salSorted, Th: ThSal } = useSortable(salFiltrados, 'fecha');
    const { sorted: pagSorted } = useSortable(pagFiltrados, 'fecha');

    const pagSal  = usePaginacion(salSorted, 20);

    // Pagos al operador: son gastos categoría "Pago operador"; aquí se ven junto a los salarios
    const pagPag  = usePaginacion(pagSorted, 20);

    // Salarios: lo que se causó al hacer cada corte y lo que se le ha pagado al operador
    const gastoPorId = new Map(gastos.map(g => [g.id, g]));
    const periodoDePago = (p) => {
        const g = p.gastoGeneradoId != null ? gastoPorId.get(p.gastoGeneradoId) : null;
        if (g && g.faenaId != null) return g.faenaId;
        const maq = maquinas.find(m => m.operadorNombre === p.operadorNombre);
        const dia = String(p.fecha || '').slice(0, 10);
        const f = maq && faenas.find(x => x.maquinaNombre === maq.nombre && x.tipo !== 'gastos' && dia >= String(x.fechaInicio || '').slice(0, 10)
            && (!x.fechaFin || x.estado === 'activa' || dia <= String(x.fechaFin).slice(0, 10)));
        return f ? f.id : null;
    };
    const filasOpTodas = [
        ...gastos.filter(g => esPagoOperador(g) && g.corteId != null).map(g => {
            const e = estadoCausado(g, pagosOp);
            return { key: 'c' + g.id, tipo: 'corte', id: g.id, fecha: g.fecha, operador: g.operadorNombre || partesPagoOp(g).operador,
                desc: (g.descripcion || '').split(': ').slice(1).join(': ') || g.descripcion, maquina: g.maquinaNombre, monto: g.monto,
                faenaId: g.faenaId, estado: nombreEstadoCausado(e), debe: e ? e.debe : 0, pagado: e ? e.pagado : 0, raw: g };
        }),
        ...pagosOp.map(p => ({ key: 'p' + p.id, tipo: 'pago', id: p.id, fecha: p.fecha, operador: p.operadorNombre, desc: p.descripcion,
            maquina: (maquinas.find(m => m.operadorNombre === p.operadorNombre) || {}).nombre, monto: p.monto, faenaId: periodoDePago(p), raw: p })),
        // pagos viejos que solo quedaron como gasto
        ...gastos.filter(g => esPagoOperador(g) && g.corteId == null && !pagosOp.some(p => p.gastoGeneradoId === g.id)).map(g => {
            const x = partesPagoOp(g);
            return { key: 'g' + g.id, tipo: 'pago', via: 'gasto', id: g.id, fecha: g.fecha, operador: x.operador, desc: x.detalle, maquina: g.maquinaNombre, monto: g.monto, faenaId: g.faenaId, raw: g };
        }),
    ];
    const filasOp = porFecha(filasOpTodas, 'fecha').filter(f => (!q || f.operador?.toLowerCase().includes(q) || f.desc?.toLowerCase().includes(q) || f.maquina?.toLowerCase().includes(q))
        && (!maqFiltro || f.maquina === maqFiltro));

    const resumenOp = calcularOperadores({ maquinas, horas: horasF, cortes: cortesF, pagosOp });

    const editarFilaOp = (f) => {
        if (f.tipo === 'pago' && f.via !== 'gasto') {
            const maq = maquinas.find(m => m.operadorNombre === f.operador) || null;
            setPagarOp({ operador: { nombre: f.operador, maq, valorHora: maq?.valorHoraOperador || 0 }, saldo: 0,
                edicion: { id: f.id, monto: f.monto, descripcion: f.desc || '', fecha: f.fecha } });
        } else setEditGasto(f.raw);
    };
    const eliminarFilaOp = async (f) => {
        const aviso = f.tipo === 'corte' ? 'Se borra el costo que se causó con este corte. ¿Continuar?' : '¿Eliminar este pago?';
        if (!await confirm(aviso)) return;
        try {
            if (f.tipo === 'pago' && f.via !== 'gasto') await deletePagoOperador(f.id); else await deleteGasto(f.id);
        } catch { toast('No se pudo eliminar. Intenta de nuevo.', 'e'); return; }
        cargarTodo();
    };

    const TABS = [
        { key: 'ingresos', label: 'Ingresos', icon: <TrendingUp size={14} />, count: ingPeriodo.length },
        { key: 'gastos',   label: 'Gastos',   icon: <TrendingDown size={14} />, count: gasPeriodo.length },
        { key: 'salarios', label: 'Salarios', icon: <HardHat size={14} />, count: salPeriodo.length + filasOpTodas.length },
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

    if (errorCarga && !cargando) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar"><div><h1>Finanzas</h1><p>No se pudo cargar</p></div></div>
            <div className="content"><div className="pad"><ErrorCarga onReintentar={cargarTodo} /></div></div>
        </div>
    );

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
        : tab === 'salarios' ? filasOp.filter(f => f.tipo === 'pago').reduce((a, f) => a + (Number(f.monto) || 0), 0) + salariosEgreso.reduce((a, s) => a + (Number(s.totalNeto) || 0), 0)
        : pagFiltrados.reduce((a, p) => a + (Number(p.valorPagado) || 0), 0);
    const footLabel = tab === 'pagos' ? 'Cobrado en el periodo' : tab === 'salarios' ? 'Pagado a operadores' : 'Total del periodo';
    const footTono = tab === 'ingresos' ? 'pos' : tab === 'pagos' ? 'pos' : 'neg';
    const listaTab = { ingresos: ingFiltrados, gastos: gasFiltrados, salarios: [...filasOp, ...salFiltrados], pagos: pagFiltrados }[tab];
    const paginadosTab = { salarios: { ...pagSal, paginados: [...filasOp, ...pagSal.paginados] }, pagos: pagPag }[tab];

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
                        <div className="fin-kpi-val fin-num"><Monto v={totalIngresos} /></div>
                        <div className="fin-kpi-sub">{ingFiltrados.length} registros</div>
                    </div>
                    <div className="fin-kpi bad">
                        <div className="fin-kpi-top"><span className="fin-kpi-label">Egresos</span><span className="fin-kpi-ico"><TrendingDown size={14} /></span></div>
                        <div className="fin-kpi-val fin-num"><Monto v={totalEgresos} /></div>
                        <div className="fin-kpi-sub">{gasFiltrados.length} gastos{salariosEgreso.length > 0 ? ` + ${salariosEgreso.length} nóminas` : ''}</div>
                    </div>
                    <div className="fin-kpi profit">
                        <div className="fin-kpi-top"><span className="fin-kpi-label">Utilidad</span><span className="fin-kpi-ico"><BarChart2 size={14} /></span></div>
                        <div className="fin-kpi-val fin-num"><Monto v={utilidad} /></div>
                        <div className="fin-kpi-sub">margen del {margen}%</div>
                    </div>
                    <div className="fin-kpi cobranza">
                        <div className="fin-kpi-top"><span className="fin-kpi-label">Cobranza</span><span className="fin-kpi-ico" style={{ background: 'rgba(41,128,185,.1)', color: '#2980b9' }}><CreditCard size={14} /></span></div>
                        <div className="fin-cob-nums"><span className="a fin-num"><Monto v={totalCobrado} /></span><span className="b fin-num">de <Monto v={totalContratado} /></span></div>
                        <div className="fin-cob-track"><div className="fin-cob-fill" style={{ width: `${Math.min(pctCobrado, 100)}%` }} /></div>
                        <div className="fin-cob-foot"><span>{pctCobrado}% cobrado</span>{totalPorCobrar > 0 && <span className="warn">{fmt(totalPorCobrar)} por cobrar</span>}</div>
                    </div>
                </div>

                {totalHuerfanos > 0 && (
                    <div className="ct-aviso" style={{ alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'space-between', gap: '10px', padding: '12px 14px' }}>
                        <span style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flex: '1 1 260px' }}>
                            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                            <span><b>Hay {totalHuerfanos} registro{totalHuerfanos === 1 ? '' : 's'} de periodos que ya eliminaste.</b> Siguen apareciendo aquí como "Sin periodo asignado" y cuentan en los totales. Puedes borrarlos todos de una vez.</span>
                        </span>
                        <button type="button" className="fin-btn pri" onClick={limpiarHuerfanos} disabled={limpiando} style={{ flex: '0 0 auto', width: 'auto' }}><Trash2 size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{limpiando ? 'Borrando…' : 'Borrar registros sueltos'}</button>
                    </div>
                )}

                {/* SELECCIONAR MÁQUINA */}
                <div className="fin-machinebar">
                    <Tractor size={15} />
                    <label>Ver finanzas de</label>
                    <select className="fin-select" style={{ width: 'auto', minWidth: '220px', maxWidth: '100%' }}
                        value={maqFiltro}
                        onChange={e => setMaqFiltro(e.target.value)}>
                        <option value="">Todas las máquinas</option>
                        {nomsMaquinas.map(n => <option key={n}>{n}</option>)}
                    </select>
                    {tab === 'gastos' && (
                        <>
                            <label style={{ marginLeft: '12px' }}>Pagó</label>
                            <select className="fin-select" style={{ width: 'auto', minWidth: '160px', maxWidth: '100%' }} aria-label="Filtrar por quién pagó"
                                value={pagFiltro} onChange={e => setPagFiltro(e.target.value)}>
                                <option value="">Todas las personas</option>
                                {[...new Set([...pagadores.map(p => p.nombre), ...gastos.map(g => quienPago(g))])].map(n => <option key={n}>{n}</option>)}
                            </select>
                            <button type="button" className="fin-btn" style={{ marginLeft: 'auto', flex: '0 0 auto', width: 'auto' }} onClick={() => setVerRepPersona(v => !v)}>{verRepPersona ? 'Ocultar reporte por persona' : 'Reporte por persona'}</button>
                        </>
                    )}
                    {maqFiltro && (tab === 'ingresos' || tab === 'gastos') && (
                        <span className="fin-machinebar-note">Agrupado por periodo — clic en uno para ver el detalle</span>
                    )}
                </div>

                {tab === 'gastos' && verRepPersona && <ReporteGastosPersona gastos={gastos} maquinas={maquinas} />}
                {adminPag && <AdministrarPagadores pagadores={pagadores} gastos={gastos} onCambio={async () => { await recargarPagadores(); await cargarTodo(); }} onCerrar={() => setAdminPag(false)} />}

                {/* FILTRO PERÍODO */}
                <FiltroChips
                    className="fin-filters"
                    valor={periodoFiltro}
                    onChange={setPeriodoFiltro}
                    opciones={[
                        { key: 'todo',   label: 'Todo' },
                        { key: 'mes',    label: 'Este mes' },
                        { key: 'ultimo', label: 'Mes anterior' },
                        { key: 'anio',   label: 'Este año' },
                        { key: 'rango',  label: 'Personalizado' },
                    ]}
                >
                    {periodoFiltro === 'rango' && (
                        <>
                            <input type="date" aria-label="Desde" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                            <span style={{ fontSize: '12px', color: '#93a2b3' }}>→</span>
                            <input type="date" aria-label="Hasta" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                        </>
                    )}
                </FiltroChips>

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
                        <p>Aquí ves lo que se le ha pagado a los operadores. Los pagos se anotan en <strong>Operadores → Pago Operador</strong> y cuentan una sola vez, en Gastos. Si anotas un salario a mano, se muestra abajo en las liquidaciones.</p>
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
                            {tab === 'ingresos' && (ingFiltrados.length === 0
                                ? <EmptyState icono={<TrendingUp size={20} />} titulo="No hay ingresos para mostrar" texto="Cambia el filtro de fechas o la búsqueda, o registra uno nuevo." accion={{ label: 'Nuevo ingreso', onClick: abrirNuevo }} />
                                : (
                                    <div style={{ padding: '12px 18px' }}>
                                        <AgrupadoPorCorte modo="ingresos" items={ingFiltrados} faenas={faenasVisibles} anidado mostrarMaquina={!maqFiltro} resumen={false}
                                            onEditar={abrirEditar} onEliminar={i => eliminar('ingresos', i.id)} />
                                    </div>
                                ))}

                            {/* ── GASTOS ── */}
                            {tab === 'gastos' && (gasFiltrados.length === 0
                                ? <EmptyState icono={<TrendingDown size={20} />} titulo="No hay gastos para mostrar" texto="Cambia el filtro de fechas o la búsqueda, o registra uno nuevo." accion={{ label: 'Nuevo gasto', onClick: abrirNuevo }} />
                                : (
                                    <div style={{ padding: '12px 18px' }}>
                                        <AgrupadoPorCorte modo="gastos" items={gasFiltrados} faenas={faenasVisibles} anidado mostrarMaquina={!maqFiltro} resumen={false}
                                            cols={GRID.gastos} claseFila="fin-lrow" claseCab="fin-lrow-head"
                                            cabecera={['Fecha', 'Descripción', 'Categoría', 'Máquina', 'Pagó', { t: 'Monto', s: { textAlign: 'right' } }, { t: 'Acc.', s: { textAlign: 'right' } }]}
                                            renderFila={g => {
                                                const esCombAuto = g.descripcion?.includes('Combustible —');
                                                const esSalAuto  = g.categoria === 'Salario' && g.descripcion?.startsWith('Salario —');
                                                const esMantAuto = g.categoria === 'Mantenimiento' && g.descripcion?.startsWith('Mantenimiento —');
                                                const esPagoOp   = esPagoOperador(g);
                                                const autoIcon   = esCombAuto ? <Fuel size={10} /> : (esSalAuto || esPagoOp) ? <HardHat size={10} /> : esMantAuto ? <Wrench size={10} /> : null;
                                                const autoTexto  = esCombAuto ? 'Automático desde Combustible' : esSalAuto ? 'Automático desde Salarios' : esMantAuto ? 'Automático desde Mantenimientos' : esPagoOp ? 'Se edita desde Operadores, pestaña Pago Operador' : null;
                                                const tieneFact  = facturasIds.has(String(g.id));
                                                return (
                                                    <>
                                                        <span className="date">{fmtFecha(g.fecha)}</span>
                                                        <div className="fin-desc">
                                                            <div className="t">{g.descripcion}</div>
                                                            {autoTexto && <div className="auto">{autoIcon} {autoTexto}</div>}
                                                        </div>
                                                        <span className={`fin-catpill fin-cat-${claseCategoria(g.categoria)}`}><i />{g.categoria}</span>
                                                        <span className="fin-cell">{g.maquinaNombre}</span>
                                                        <span className="fin-cell fin-pago"><small>Pagó: </small>{g.pagadoPor || <em>{SIN_ASIGNAR}</em>}</span>
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
                                                            {!esPagoOp && <button className="fin-iconbtn" onClick={() => abrirEditar(g)}><Pencil size={14} /></button>}
                                                            {!esPagoOp && <button className="fin-iconbtn" onClick={() => eliminar('gastos', g.id)}><Trash2 size={14} /></button>}
                                                        </div>
                                                    </>
                                                );
                                            }} />
                                    </div>
                                ))}

                            {/* ── SALARIOS ── */}
                            {tab === 'salarios' && (
                                <>
                                    {filasOp.length === 0 && salFiltrados.length === 0 && (
                                        <EmptyState icono={<HardHat size={20} />} titulo="No hay pagos a operadores para mostrar" texto="Cambia el filtro de fechas o la búsqueda. Los pagos se registran en Operadores, pestaña Pago Operador." />
                                    )}
                                    {filasOp.length > 0 && (
                                        <>
                                            {salFiltrados.length > 0 && <div className="fin-subhead">Cortes y pagos a operadores</div>}
                                            <OperadoresPeriodo resumen={resumenOp} filas={filasOp} faenas={faenas} onEditar={editarFilaOp} onEliminar={eliminarFilaOp} />
                                        </>
                                    )}
                                    {salFiltrados.length > 0 && (
                                    <>
                                    {filasOp.length > 0 && <div className="fin-subhead">Liquidaciones de salario</div>}
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
                                    {pagSal.paginados.map(s => (
                                        <div className={`fin-lrow ${editandoId === s.id ? 'sel' : ''}`} key={s.id} style={{ gridTemplateColumns: GRID.salarios }}>
                                            <span className="fin-cell strong">{s.operadorNombre}{!salarioCuenta(s) && <small className="fin-info-tag" title="Lo creó la app al cerrar el periodo. Muestra cuánto se ganó el operador y no suma a los egresos: lo que cuenta es lo que le pagas en Operadores.">Informativo</small>}</span>
                                            <span className="fin-cell">{s.horasTrabajadas} hrs</span>
                                            <span className="fin-money mut">{fmt(s.valorHora)}</span>
                                            <span className="fin-money pos">{fmt(s.totalBruto)}</span>
                                            <span className="fin-money neg">-{fmt(s.anticipos)}</span>
                                            <span className="fin-money pos">{fmt(s.totalNeto)}</span>
                                            <span><Estado valor={s.estado} /></span>
                                            <div className="fin-actions">
                                                <button className="fin-iconbtn" onClick={() => abrirEditar(s)}><Pencil size={14} /></button>
                                                <button className="fin-iconbtn" onClick={() => eliminar('salarios', s.id)}><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    <Paginacion pagina={pagSal.pagina} total={pagSal.total} ir={pagSal.ir} totalItems={salFiltrados.length} porPagina={20} />
                                    </>
                                    )}
                                </>
                            )}

                            {/* ── PAGOS ── */}
                            {tab === 'pagos' && (
                                <PagosClientesPeriodo pagos={pagFiltrados} faenas={faenas} cortes={cortesF} onNuevo={abrirNuevo}
                                    onEditar={abrirEditar} onEliminar={p => eliminar('pagos', p.id)} />
                            )}

                            <div className="fin-ledger-foot">
                                <span>{listaTab.length} registros{paginadosTab ? ` · mostrando ${paginadosTab.paginados.length}` : ''}</span>
                                <span>{footLabel} <span className={`fin-ledger-total fin-num ${footTono === 'pos' ? 'fin-money pos' : 'fin-money neg'}`}>{fmt(footTotal)}</span></span>
                            </div>
                            {paginadosTab && tab !== 'salarios' && tab !== 'pagos' && (
                                <Paginacion pagina={paginadosTab.pagina} total={paginadosTab.total} ir={paginadosTab.ir} totalItems={listaTab.length} porPagina={20} />
                            )}
                        </div>
                    </div>

                    {/* ── COMPOSE PANEL ── */}
                    {mostrarForm && (
                        <div className="fin-fondo" onMouseDown={e => { if (e.target === e.currentTarget) cerrarCompose(); }}>
                        <div className="fin-panel fin-compose" role="dialog" aria-modal="true">
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
                                        <div className="fin-fld"><label htmlFor="fin-quien">¿Quién pagó?</label><QuienPago id="fin-quien" conEtiqueta={false} selectClass="fin-select" inputClass="fin-input" value={formGas.pagadoPor || ''} onChange={v => setFormGas({ ...formGas, pagadoPor: v })} pagadores={pagadores} onCrear={crearPagador} onAdministrar={() => setAdminPag(true)} /></div>
                                        {formGas.maquinaNombre && (
                                            <div className="fin-fld"><DestinoGasto id="fin-destino" faenas={faenas} maquina={formGas.maquinaNombre} selectClass="fin-select" inputClass="fin-input" labelClass=""
                                                value={destGas || destinoPorDefecto(faenas, formGas.maquinaNombre)} onChange={setDestGas}
                                                onAbrir={async (nombre) => { const r = await createFaena({ maquinaNombre: formGas.maquinaNombre, nombreObra: nombre, tipo: 'gastos' }); const fr = await getFaenas(); setFaenas(fr.data || []); setDestGas(String(r.data.id)); toast('Periodo de gastos externos abierto'); }} /></div>
                                        )}
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
                                <button className="fin-btn pri" onClick={guardar}><Check size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{editandoId ? 'Guardar cambios' : `Registrar ${tab === 'ingresos' ? 'ingreso' : tab === 'gastos' ? 'gasto' : tab === 'salarios' ? 'salario' : 'pago'}`}</button>
                            </div>
                        </div>
                        </div>
                    )}
                </div>

            </div></div>
        </div>
        {pagarOp && (
            <PagarOperadorModal operador={pagarOp.operador} saldo={pagarOp.saldo || 0} edicion={pagarOp.edicion || null}
                onCerrar={() => setPagarOp(null)} onPagado={() => { setPagarOp(null); cargarTodo(); }} />
        )}
        {editGasto && (
            <EditarGastoOperadorModal gasto={editGasto} onCerrar={() => setEditGasto(null)} onGuardado={() => { setEditGasto(null); cargarTodo(); }} />
        )}
        </>
    );
}

export default Finanzas;
