import { useState, useEffect, useCallback } from 'react';
import {
    getHorasOperador,
    deleteHora,
    getMaquinas,
    getMisMaquinasAPI,
    getPeriodosAPI,
    createPeriodoAPI,
    updatePeriodoAPI,
    deletePeriodoAPI,
    updateOperadorAPI,
    getTelegramCodeAPI,
    unlinkTelegramAPI,
    getPagosOperador,
    createPagoOperador,
    updatePagoOperador,
    deletePagoOperador,
} from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import { usePaginacion, Paginacion } from '../../utils/Paginacion';
import {
    ClipboardList,
    Clock,
    Calendar,
    HardHat,
    Tractor,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Landmark,
    Check,
    Trash2,
    Info,
    Gauge,
    Pencil,
    StopCircle,
    CheckCircle,
    CreditCard,
} from 'lucide-react';
import MoneyInput from '../../utils/MoneyInput';
import { fmtFecha } from '../../utils/fmtFecha';
import { useSortable } from '../../utils/useSortable';
import { useDateRange, DateRangePicker } from '../../utils/useDateRange';
import { GiBulldozer } from 'react-icons/gi';
import { TbBackhoe } from 'react-icons/tb';
import './DetalleOperador.css';

const IcoMaquina = ({ tipo, size = 12 }) => {
    if (tipo === 'Excavadora') return <TbBackhoe size={size} />;
    if (tipo === 'Bulldozer') return <GiBulldozer size={size} />;
    return <Tractor size={size} />;
};

const fmt = (v) => '$' + (v || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().split('T')[0];
const getHrs = (h) => parseFloat(h.horas ?? 0);
const normalizePeriodo = (periodo) => ({
    ...periodo,
    fechaInicio: periodo.fechaInicio || periodo.fecha_inicio || null,
    fechaFin: periodo.fechaFin || periodo.fecha_fin || null,
    horasTotal: periodo.horasTotal ?? periodo.horas_total ?? null,
    salarioBruto: periodo.salarioBruto ?? periodo.salario_bruto ?? null,
    salarioNeto: periodo.salarioNeto ?? periodo.salario_neto ?? null,
    desdeHoraId: periodo.desdeHoraId ?? periodo.desde_hora_id ?? null,
});

function DetalleOperador({ operador, onVolver, modoPortal = false }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [tab, setTab] = useState(0);
    const [horas, setHoras] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
    const [periodos, setPeriodos] = useState([]);
    const [tgCode, setTgCode] = useState(null);
    const [tgDeepLink, setTgDeepLink] = useState(null);
    const [tgVinculado, setTgVinculado] = useState(!!operador.telegramChatId);
    const [tgCargando, setTgCargando] = useState(false);

    const [anticipoInput, setAnticipoInput] = useState('');
    const [mostrarAnticipoForm, setMostrarAnticipoForm] = useState(false);

    const [editandoFechaPeriodo, setEditandoFechaPeriodo] = useState(false);
    const [fechaPeriodoInput, setFechaPeriodoInput] = useState('');

    // Pago Operador -- bitácora informativa de cuánto se le ha pagado al operador; no se
    // relaciona con Salarios ni con ningún otro total, solo admin (no visible en el portal).
    const [pagosOperador, setPagosOperador] = useState([]);
    const PAGO_OP_VACIO = { descripcion: '', monto: '', fecha: hoy() };
    const [pagoOpForm, setPagoOpForm] = useState(PAGO_OP_VACIO);
    const [editandoPagoOpId, setEditandoPagoOpId] = useState(null);

    const refrescarPagosOperador = () =>
        getPagosOperador().then(r => setPagosOperador((r.data || []).filter(p => p.operadorNombre === operador.nombre))).catch(() => {});

    useEffect(() => {
        if (modoPortal) return;
        refrescarPagosOperador();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [operador.id, modoPortal]);

    const guardarPagoOperador = async () => {
        const monto = parseFloat(pagoOpForm.monto);
        if (!monto || monto <= 0) return toast('Ingresa un monto válido', 'e');
        const payload = { operadorNombre: operadorLocal.nombre, descripcion: pagoOpForm.descripcion, monto, fecha: pagoOpForm.fecha };
        try {
            if (editandoPagoOpId) {
                await updatePagoOperador(editandoPagoOpId, payload);
                toast('Pago actualizado');
            } else {
                await createPagoOperador(payload);
                toast('Pago registrado');
            }
        } catch {
            return toast('No se pudo guardar el pago', 'e');
        }
        setEditandoPagoOpId(null);
        setPagoOpForm(PAGO_OP_VACIO);
        refrescarPagosOperador();
    };
    const editarPagoOperador = (p) => {
        setPagoOpForm({ descripcion: p.descripcion || '', monto: String(p.monto ?? ''), fecha: p.fecha || hoy() });
        setEditandoPagoOpId(p.id);
    };
    const cancelarPagoOperador = () => { setEditandoPagoOpId(null); setPagoOpForm(PAGO_OP_VACIO); };
    const eliminarPagoOperador = async (id) => {
        if (!await confirm('¿Eliminar este registro de pago?')) return;
        const prev = pagosOperador;
        setPagosOperador(p => p.filter(x => x.id !== id));
        deletePagoOperador(id).catch(() => { setPagosOperador(prev); toast('Error al eliminar', 'e'); });
    };

    const [editForm, setEditForm] = useState({
        nombre: operador.nombre || '',
        cedula: operador.cedula || '',
        telefono: operador.telefono || '',
        email: operador.email || '',
        observaciones: operador.observaciones || '',
    });
    const [operadorLocal, setOperadorLocal] = useState(operador);

    const guardarEdicion = () => {
        if (!editForm.nombre.trim()) return toast('El nombre es obligatorio', 'e');
        updateOperadorAPI(operadorLocal.id, editForm)
            .then(({ data }) => {
                setOperadorLocal(data);
                toast('Datos del operador actualizados');
            })
            .catch(() => toast('No se pudo actualizar el operador', 'e'));
    };

    const fetchMaquinas = modoPortal ? getMisMaquinasAPI : getMaquinas;

    const cargar = useCallback(async () => {
        const [horasRes, maquinasRes, periodosRes] = await Promise.all([
            getHorasOperador(operador.id),
            fetchMaquinas(),
            getPeriodosAPI(operador.id),
        ]);
        setHoras(horasRes.data);
        setMaquinas(maquinasRes.data);
        setPeriodos((periodosRes.data || []).map(normalizePeriodo));
    }, [operador.id]);

    useEffect(() => {
        const init = async () => {
            try {
                const [horasRes, maquinasRes, periodosRes] = await Promise.all([
                    getHorasOperador(operador.id),
                    fetchMaquinas(),
                    getPeriodosAPI(operador.id),
                ]);
                const horasData = horasRes.data;
                setHoras(horasData);
                setMaquinas(maquinasRes.data);

                const periodosActuales = (periodosRes.data || []).map(normalizePeriodo);
                const activeP = periodosActuales.find(p => p.estado === 'activo');
                const hayCerrados = periodosActuales.some(p => p.estado !== 'activo');

                if (!activeP) {
                    // no hay periodo activo — crear uno anclado al ultimo id
                    const lastHoraId = horasData.length > 0
                        ? Math.max(...horasData.map(h => Number(h.id)))
                        : null;
                    await createPeriodoAPI(operador.id, {
                        fechaInicio: hoy(),
                        estado: 'activo',
                        anticipos: 0,
                        desdeHoraId: lastHoraId,
                    });
                    const nuevos = await getPeriodosAPI(operador.id);
                    setPeriodos((nuevos.data || []).map(normalizePeriodo));
                } else if (!activeP.desdeHoraId && hayCerrados) {
                    // periodo activo sin ancla creado por codigo viejo — corregir automaticamente
                    const maxId = horasData.length > 0
                        ? Math.max(...horasData.map(h => Number(h.id)))
                        : null;
                    await updatePeriodoAPI(activeP.id, {
                        estado: activeP.estado,
                        anticipos: activeP.anticipos || 0,
                        fechaFin: activeP.fechaFin || null,
                        horasTotal: activeP.horasTotal,
                        salarioBruto: activeP.salarioBruto,
                        salarioNeto: activeP.salarioNeto,
                        nota: activeP.nota || null,
                        desdeHoraId: maxId,
                    });
                    const nuevos = await getPeriodosAPI(operador.id);
                    setPeriodos((nuevos.data || []).map(normalizePeriodo));
                } else {
                    setPeriodos(periodosActuales);
                }
            } catch (err) {
                console.error(err);
            }
        };
        init();
    }, [operador.id]);

    const periodoActivo = periodos.find((p) => p.estado === 'activo') || null;
    const maqAsignada = maquinas.find((m) =>
        m.operadorNombre === operador.nombre ||
        (operador.id && String(m.operador_id) === String(operador.id))
    ) || null;
    const valorHora = maqAsignada?.valorHoraOperador || 0;

    const horasDelPeriodo = periodoActivo
        ? horas.filter((h) => periodoActivo.desdeHoraId != null
            ? Number(h.id) > Number(periodoActivo.desdeHoraId)
            : h.fecha >= (periodoActivo.fechaInicio || hoy()))
        : [];

    const horasPeriodo = horasDelPeriodo.reduce((acc, h) => acc + getHrs(h), 0);

    const salarioBruto = horasPeriodo * valorHora;
    const anticipos = periodoActivo?.anticipos || 0;
    const salarioNeto = salarioBruto - anticipos;
    const totalHorasAcumuladas = horas.reduce((acc, h) => acc + getHrs(h), 0);
    const totalPagadoOperador = pagosOperador.reduce((a, p) => a + (Number(p.monto) || 0), 0);

    const { filtrado: horasRango, desde: hrDesde, setDesde: setHrDesde, hasta: hrHasta, setHasta: setHrHasta } = useDateRange(horas, 'fecha');
    const { sorted: horasOrdenadas, Th: ThHora } = useSortable(horasRango, 'fecha', 'desc');
    const pagHoras = usePaginacion(horasOrdenadas, 20);

    const refrescarPeriodos = () =>
        getPeriodosAPI(operador.id).then((res) => setPeriodos((res.data || []).map(normalizePeriodo)));

    const cerrarPeriodo = async (periodo) => {
        if (!await confirm('¿Cerrar este periodo y empezar uno nuevo en cero?')) return;
        await updatePeriodoAPI(periodo.id, {
            estado: 'cerrado',
            fechaFin: hoy(),
            horasTotal: horasPeriodo,
            salarioBruto,
            salarioNeto,
            anticipos,
            nota: periodo.nota || null,
            desdeHoraId: periodo.desdeHoraId,
        });
        const maxId = horas.length > 0 ? Math.max(...horas.map(h => Number(h.id))) : null;
        await createPeriodoAPI(operador.id, {
            fechaInicio: hoy(),
            estado: 'activo',
            anticipos: 0,
            desdeHoraId: maxId,
        });
        await refrescarPeriodos();
        toast('Periodo cerrado — comenzó periodo nuevo en cero');
    };

    const guardarFechaPeriodo = () => {
        if (!fechaPeriodoInput) return toast('Selecciona una fecha', 'e');
        if (!periodoActivo) return toast('No hay periodo activo', 'e');

        updatePeriodoAPI(periodoActivo.id, {
            estado: periodoActivo.estado,
            anticipos: periodoActivo.anticipos || 0,
            fechaFin: periodoActivo.fechaFin || null,
            horasTotal: periodoActivo.horasTotal,
            salarioBruto: periodoActivo.salarioBruto,
            salarioNeto: periodoActivo.salarioNeto,
            nota: periodoActivo.nota || null,
            fechaInicio: fechaPeriodoInput,
            // Una fecha manual reemplaza el ancla por horaId — de lo contrario seguiria
            // contando horas solo desde el momento en que se creo el periodo.
            desdeHoraId: null,
        }).then(() => refrescarPeriodos())
            .then(() => {
                toast('Fecha de inicio del periodo actualizada');
                setEditandoFechaPeriodo(false);
            }).catch(console.error);
    };

    const registrarAnticipo = () => {
        const val = parseFloat(anticipoInput || 0);
        if (!val || val <= 0) return toast('Ingresa un monto valido', 'e');
        if (!periodoActivo) return toast('No hay periodo activo', 'e');

        updatePeriodoAPI(periodoActivo.id, {
            estado: periodoActivo.estado,
            anticipos: (periodoActivo.anticipos || 0) + val,
            fechaFin: periodoActivo.fechaFin || null,
            horasTotal: periodoActivo.horasTotal,
            salarioBruto: periodoActivo.salarioBruto,
            salarioNeto: periodoActivo.salarioNeto,
            nota: periodoActivo.nota || null,
            desdeHoraId: periodoActivo.desdeHoraId,
        }).then(() => refrescarPeriodos())
            .then(() => {
                toast(`Anticipo de ${fmt(val)} registrado`);
                setAnticipoInput('');
                setMostrarAnticipoForm(false);
            }).catch(console.error);
    };

    const generarCodigoTelegram = async () => {
        setTgCargando(true);
        try {
            const { data } = await getTelegramCodeAPI(operador.id);
            setTgCode(data.code);
            setTgDeepLink(data.deepLink);
            setTgVinculado(data.vinculado);
        } catch { toast('No se pudo generar el código', 'e'); }
        finally { setTgCargando(false); }
    };

    const desvincularTelegram = async () => {
        if (!await confirm('¿Desvincular Telegram de este operador?')) return;
        try {
            await unlinkTelegramAPI(operador.id);
            setTgVinculado(false);
            setTgCode(null);
            setTgDeepLink(null);
            toast('Telegram desvinculado');
        } catch { toast('Error al desvincular', 'e'); }
    };

    const TABS = [
        <><ClipboardList size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Resumen</>,
        <><Calendar size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Historial</>,
        <><Calendar size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Periodos</>,
        ...(!modoPortal ? [
            <><CreditCard size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Pago Operador</>,
            <><Pencil size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Editar</>,
        ] : []),
    ];

    return (
        <>
            {ConfirmUI}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="topbar">
                    <div>
                        <h1>{modoPortal ? 'Panel del Operador' : operadorLocal.nombre}</h1>
                        <p>{modoPortal ? `Jornada, horas y periodos de ${operadorLocal.nombre}` : 'Detalle operativo del operador'}</p>
                    </div>
                    {!modoPortal && <button className="bs" onClick={onVolver}>← Volver</button>}
                </div>

                <div className="content"><div className="pad">
                    <div className="do-dh">
                        <div className="do-dh-ico"><HardHat size={26} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h2>{operadorLocal.nombre}</h2>
                            <p className="do-dh-meta">Cedula: {operadorLocal.cedula || '-'} · Tel: {operadorLocal.telefono || '-'} · {operadorLocal.email || '-'}</p>
                            {operador.observaciones && (
                                <p className="do-dh-meta" style={{ marginTop: '2px' }}>{operador.observaciones}</p>
                            )}
                            <div className="do-dh-badges">
                                {maqAsignada
                                    ? <span className="do-pill info"><IcoMaquina tipo={maqAsignada.tipo} size={11} /> {maqAsignada.nombre}</span>
                                    : <span className="do-pill bad"><i /> Sin maquina asignada</span>}
                                {valorHora > 0 && <span className="do-pill gold"><i /> {fmt(valorHora)}/hr</span>}
                                <span className="do-pill ok"><Clock size={11} /> {horasPeriodo.toLocaleString('es-CO')} hrs este periodo</span>
                                {tgVinculado && <span className="do-pill info">✈ Telegram</span>}
                            </div>
                        </div>
                    </div>

                    {!maqAsignada && (
                        <div className="ale">
                            <AlertTriangle size={18} />
                            <div>
                                <p>Este operador no tiene maquina asignada</p>
                                <span className="ale-desc">Ve a Maquinaria y asignale una maquina desde el panel admin.</span>
                            </div>
                        </div>
                    )}

                    <div className="do-dtabs">
                        {TABS.map((t, i) => <button key={i} className={`do-dtab ${tab === i ? 'on' : ''}`} onClick={() => setTab(i)}>{t}</button>)}
                    </div>

                    {tab === 0 && (
                        <>
                            <div className={`do-hero4 ${!modoPortal ? 'with-pago' : ''}`}>
                                <div className="do-kpi info">
                                    <div className="do-kpi-top">
                                        <span className="do-kpi-label">Horas periodo</span>
                                        <span className="do-kpi-ico"><Clock size={14} /></span>
                                    </div>
                                    <div className="do-kpi-val do-num">{horasPeriodo.toLocaleString('es-CO')}</div>
                                    <div className="do-kpi-sub">desde {fmtFecha(periodoActivo?.fechaInicio)}</div>
                                </div>
                                <div className="do-kpi good">
                                    <div className="do-kpi-top">
                                        <span className="do-kpi-label">Salario bruto</span>
                                        <span className="do-kpi-ico"><TrendingUp size={14} /></span>
                                    </div>
                                    <div className="do-kpi-val do-num">{fmt(salarioBruto)}</div>
                                    <div className="do-kpi-sub">{horasPeriodo} hrs x {fmt(valorHora)}</div>
                                </div>
                                <div className="do-kpi bad">
                                    <div className="do-kpi-top">
                                        <span className="do-kpi-label">Anticipos</span>
                                        <span className="do-kpi-ico"><TrendingDown size={14} /></span>
                                    </div>
                                    <div className="do-kpi-val do-num">{fmt(anticipos)}</div>
                                    <div className="do-kpi-sub">descontados del neto</div>
                                </div>
                                <div className="do-kpi profit">
                                    <div className="do-kpi-top">
                                        <span className="do-kpi-label">Salario neto</span>
                                        <span className="do-kpi-ico"><Landmark size={14} /></span>
                                    </div>
                                    <div className="do-kpi-val do-num">{fmt(salarioNeto)}</div>
                                    <div className="do-kpi-sub">bruto - anticipos</div>
                                </div>
                                {!modoPortal && (
                                    <div className="do-kpi purple">
                                        <div className="do-kpi-top">
                                            <span className="do-kpi-label">Pago Operador</span>
                                            <span className="do-kpi-ico"><CreditCard size={14} /></span>
                                        </div>
                                        <div className="do-kpi-val do-num">{fmt(totalPagadoOperador)}</div>
                                        <div className="do-kpi-sub">{pagosOperador.length} registro{pagosOperador.length === 1 ? '' : 's'} · solo informativo</div>
                                    </div>
                                )}
                            </div>

                            {periodoActivo && (
                                <div className="ale" style={{ background: '#fff8e7', borderColor: '#f5a623' }}>
                                    <Calendar size={18} />
                                    <div style={{ flex: 1 }}>
                                        {editandoFechaPeriodo ? (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <input className="fi" type="date" style={{ margin: 0, maxWidth: '160px' }}
                                                    value={fechaPeriodoInput} onChange={(e) => setFechaPeriodoInput(e.target.value)} />
                                                <button className="bp" style={{ fontSize: '12px' }} onClick={guardarFechaPeriodo}>
                                                    <CheckCircle size={12} style={{ verticalAlign: 'middle' }} /> Guardar
                                                </button>
                                                <button className="bs" style={{ fontSize: '12px' }} onClick={() => setEditandoFechaPeriodo(false)}>Cancelar</button>
                                            </div>
                                        ) : (
                                            <p>Periodo activo desde <strong>{fmtFecha(periodoActivo.fechaInicio)}</strong>
                                                <button className="icon-btn" style={{ marginLeft: '6px' }} title="Cambiar fecha de inicio"
                                                    onClick={() => { setFechaPeriodoInput(periodoActivo.fechaInicio || hoy()); setEditandoFechaPeriodo(true); }}>
                                                    <Pencil size={12} />
                                                </button>
                                            </p>
                                        )}
                                        <span className="ale-desc">
                                            {horasPeriodo} hrs · {fmt(salarioBruto)} bruto · {fmt(anticipos)} anticipos → neto <strong>{fmt(salarioNeto)}</strong>
                                        </span>
                                    </div>
                                </div>
                            )}

                            {maqAsignada && (
                                <div className="ale" style={{ background: '#e8f0fe', borderColor: '#2980b9' }}>
                                    <Gauge size={18} />
                                    <div>
                                        <p>Horometro actual de {maqAsignada.nombre}</p>
                                        <span className="ale-desc">
                                            <strong>{(maqAsignada.horometroActual || 0).toLocaleString('es-CO')} hrs</strong> acumuladas en la maquina
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <button className="bs" onClick={() => setMostrarAnticipoForm(!mostrarAnticipoForm)}><TrendingDown size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Anticipo</button>
                            </div>

                            {mostrarAnticipoForm && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    <MoneyInput className="fi" style={{ margin: 0, maxWidth: '180px', flex: '1 1 160px' }} placeholder="Monto anticipo ($)" value={anticipoInput} onChange={(e) => setAnticipoInput(e.target.value)} />
                                    <button className="bp" onClick={registrarAnticipo}>Guardar</button>
                                    <button className="bs" onClick={() => { setMostrarAnticipoForm(false); setAnticipoInput(''); }}>Cancelar</button>
                                </div>
                            )}

                            <div className="tbl">
                                <div className="th"><strong>Horas de este periodo</strong></div>
                                <div className="tr hdr"><span>Fecha</span><span className="w2">Maquina</span><span>Horas</span><span>Horometro fin</span><span>Valor ganado</span></div>
                                {horasDelPeriodo.length === 0 && <p className="vacio">Sin horas en este periodo — se registran desde Telegram/WhatsApp</p>}
                                {horasDelPeriodo.slice(0, 8).map((h) => (
                                    <div className="tr" key={h.id}>
                                        <span>{fmtFecha(h.fecha)}</span>
                                        <span className="w2">{h.maquinaNombre}</span>
                                        <span><strong>{getHrs(h)}</strong> hrs</span>
                                        <span>{h.horometroFin || '-'}</span>
                                        <span className="pos">{fmt(getHrs(h) * (h.valorHora || valorHora))}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {tab === 1 && (
                        <div className="tbl">
                            <div className="th">
                                <strong>Historial completo de horas - {operador.nombre}</strong>
                                <span style={{ fontSize: '11px', color: '#6b7a8d' }}>Total: {totalHorasAcumuladas} hrs · {fmt(totalHorasAcumuladas * valorHora)}</span>
                                <DateRangePicker desde={hrDesde} setDesde={setHrDesde} hasta={hrHasta} setHasta={setHrHasta} />
                            </div>
                            <div className="tr hdr">
                                <ThHora campo="fecha">Fecha</ThHora>
                                <ThHora campo="maquinaNombre" className="w2">Máquina</ThHora>
                                <ThHora campo="horas">Horas</ThHora>
                                <ThHora campo="valorHora">$/Hora</ThHora>
                                <span>Valor</span>
                                <span>Acc.</span>
                            </div>
                            {horasOrdenadas.length === 0 && <p className="vacio">Sin horas registradas</p>}
                            {pagHoras.paginados.map((h) => (
                                <div className="tr" key={h.id}>
                                    <span>{fmtFecha(h.fecha)}</span>
                                    <span className="w2">{h.maquinaNombre}</span>
                                    <span><strong>{getHrs(h)}</strong> hrs</span>
                                    <span>{fmt(h.valorHora || valorHora)}</span>
                                    <span className="pos">{fmt(getHrs(h) * (h.valorHora || valorHora))}</span>
                                    <span>
                                        <button className="icon-btn" onClick={async () => {
                                            if (await confirm('Eliminar este registro de horas?')) {
                                                deleteHora(h.id).then(cargar).catch(console.error);
                                            }
                                        }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </span>
                                </div>
                            ))}
                            <Paginacion pagina={pagHoras.pagina} total={pagHoras.total} ir={pagHoras.ir} totalItems={horasOrdenadas.length} porPagina={20} />
                        </div>
                    )}

                    {tab === 2 && (
                        <>
                            <div className="ale" style={{ background: '#e8f5e9', borderColor: '#27ae60' }}>
                                <Info size={18} />
                                <div>
                                    <p>Cierra el periodo activo para reiniciar las horas y el salario a cero</p>
                                    <span className="ale-desc">El sistema guarda el resumen (horas, bruto, neto) en el historial y abre uno nuevo en cero. También se cierra automáticamente al cerrar la faena.</span>
                                </div>
                            </div>

                            {periodos.slice().reverse().map((p, i) => (
                                <div key={p.id} style={{
                                    background: p.estado === 'activo' ? '#fff8e7' : '#f8f9fa',
                                    border: `1px solid ${p.estado === 'activo' ? '#f5a623' : '#dee2e6'}`,
                                    borderRadius: '10px',
                                    padding: '16px',
                                    marginBottom: '12px',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <strong style={{ fontSize: '13px' }}>
                                            {p.estado === 'activo'
                                                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27ae60', display: 'inline-block' }}></span>Periodo activo</span>
                                                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Calendar size={13} />Periodo {periodos.length - i}</span>}
                                        </strong>
                                        <span className={`b ${p.estado === 'activo' ? 'ok' : 'comp'}`}>
                                            {p.estado === 'activo' ? 'En curso' : 'Cerrado'}
                                        </span>
                                    </div>
                                    <div className="rr"><span>Inicio</span><span>{fmtFecha(p.fechaInicio)}</span></div>
                                    {p.fechaFin && <div className="rr"><span>Fin</span><span>{fmtFecha(p.fechaFin)}</span></div>}
                                    {p.estado === 'activo' && <div className="rr"><span>Horas acumuladas</span><span><strong>{horasPeriodo} hrs</strong></span></div>}
                                    {p.horasTotal != null && p.estado !== 'activo' && <div className="rr"><span>Horas trabajadas</span><span>{p.horasTotal} hrs</span></div>}
                                    {p.salarioBruto != null && <div className="rr"><span>Salario bruto</span><span className="pos">{fmt(p.estado === 'activo' ? salarioBruto : p.salarioBruto)}</span></div>}
                                    {p.anticipos > 0 && <div className="rr"><span>Anticipos</span><span className="neg">{fmt(p.estado === 'activo' ? anticipos : p.anticipos)}</span></div>}
                                    {p.salarioNeto != null && <div className="rr"><span>Salario neto</span><span className="pos" style={{ fontWeight: '700' }}>{fmt(p.estado === 'activo' ? salarioNeto : p.salarioNeto)}</span></div>}
                                    {p.nota && <div className="rr"><span>Nota</span><span style={{ color: '#6b7a8d' }}>{p.nota}</span></div>}
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {p.estado === 'activo' && (
                                            <button className="bs" style={{ fontSize: '11px' }} onClick={() => { setMostrarAnticipoForm(true); setTab(0); }}>+ Anticipo</button>
                                        )}
                                        {p.estado === 'activo' && (
                                            <button className="bp" style={{ fontSize: '11px', background: '#e74c3c', border: 'none' }} onClick={() => cerrarPeriodo(p)}>
                                                <StopCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                Cerrar Periodo
                                            </button>
                                        )}
                                        <button className="icon-btn" style={{ color: '#e74c3c' }} onClick={async () => {
                                            if (await confirm('¿Eliminar este periodo?')) {
                                                deletePeriodoAPI(p.id).then(refrescarPeriodos).catch(console.error);
                                            }
                                        }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {periodos.length === 0 && <p className="vacio">Sin periodos registrados</p>}
                        </>
                    )}

                    {tab === 3 && !modoPortal && (
                        <>
                            <div className="ale" style={{ background: '#f5eefa', borderColor: '#8e44ad' }}>
                                <CreditCard size={18} color="#8e44ad" />
                                <div>
                                    <p>Bitácora de pagos al operador</p>
                                    <span className="ale-desc">Es solo informativo — no se relaciona con Salarios ni afecta ningún otro total. Sirve para que quede constancia de cuánto se le ha pagado a {operadorLocal.nombre}.</span>
                                </div>
                            </div>

                            <div className="fc">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CreditCard size={18} /> {editandoPagoOpId ? 'Editar pago' : 'Registrar pago al operador'}
                                </h3>
                                <div className="fg2">
                                    <div><label className="fl">Monto ($) *</label><MoneyInput className="fi" value={pagoOpForm.monto} onChange={e => setPagoOpForm({ ...pagoOpForm, monto: e.target.value })} placeholder="Ej: 200.000" /></div>
                                    <div><label className="fl">Fecha</label><input className="fi" type="date" value={pagoOpForm.fecha} onChange={e => setPagoOpForm({ ...pagoOpForm, fecha: e.target.value })} /></div>
                                </div>
                                <div><label className="fl">Descripción (opcional)</label><input className="fi" value={pagoOpForm.descripcion} onChange={e => setPagoOpForm({ ...pagoOpForm, descripcion: e.target.value })} placeholder="Ej: Pago en efectivo quincena" /></div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="bp" onClick={guardarPagoOperador}>
                                        <Check size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> {editandoPagoOpId ? 'Guardar cambios' : 'Registrar pago'}
                                    </button>
                                    {editandoPagoOpId && <button className="bs" onClick={cancelarPagoOperador}>Cancelar</button>}
                                </div>
                            </div>

                            <div className="tbl">
                                <div className="th"><strong>Pagos registrados — {operadorLocal.nombre}</strong></div>
                                <div className="tr hdr"><span>Fecha</span><span className="w2">Descripción</span><span>Monto</span><span>Acc.</span></div>
                                {pagosOperador.length === 0 && <p className="vacio">Sin pagos registrados</p>}
                                {pagosOperador.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => (
                                    <div className="tr" key={p.id}>
                                        <span>{fmtFecha(p.fecha)}</span>
                                        <span className="w2">{p.descripcion || '—'}</span>
                                        <span className="pos">{fmt(p.monto)}</span>
                                        <span>
                                            <button className="icon-btn" onClick={() => editarPagoOperador(p)}><Pencil size={14} /></button>
                                            <button className="icon-btn" onClick={() => eliminarPagoOperador(p.id)}><Trash2 size={14} /></button>
                                        </span>
                                    </div>
                                ))}
                                <div style={{ padding: '10px 16px', fontSize: '12px', color: '#6b7a8d', borderTop: '1px solid #eef1f5' }}>
                                    Total pagado (informativo): <strong className="pos">{fmt(totalPagadoOperador)}</strong>
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 4 && !modoPortal && (
                        <>
                        <div className="fc">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Pencil size={18} /> Editar información del operador
                            </h3>
                            <p className="fd">Modifica los datos personales del operador. La máquina y valor/hora se asignan desde el módulo Maquinaria.</p>
                            <div className="fg2">
                                <div>
                                    <label className="fl">Nombre completo *</label>
                                    <input
                                        className="fi"
                                        value={editForm.nombre}
                                        onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                                        placeholder="Ej: Carlos Pérez"
                                    />
                                </div>
                                <div>
                                    <label className="fl">Cédula</label>
                                    <input
                                        className="fi"
                                        value={editForm.cedula}
                                        onChange={e => setEditForm({ ...editForm, cedula: e.target.value })}
                                        placeholder="Ej: 1234567890"
                                    />
                                </div>
                            </div>
                            <div className="fg2">
                                <div>
                                    <label className="fl">Teléfono</label>
                                    <input
                                        className="fi"
                                        value={editForm.telefono}
                                        onChange={e => setEditForm({ ...editForm, telefono: e.target.value })}
                                        placeholder="Ej: 3001234567"
                                    />
                                </div>
                                <div>
                                    <label className="fl">Correo electrónico</label>
                                    <input
                                        className="fi"
                                        type="email"
                                        value={editForm.email}
                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                        placeholder="Ej: carlos@mail.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="fl">Observaciones</label>
                                <input
                                    className="fi"
                                    value={editForm.observaciones}
                                    onChange={e => setEditForm({ ...editForm, observaciones: e.target.value })}
                                    placeholder="Ej: Licencia C2, experiencia en excavadoras"
                                />
                            </div>
                            <button className="bp" onClick={guardarEdicion}>
                                <Check size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Guardar cambios
                            </button>

                            {/* ── Telegram ── */}
                            <div style={{ marginTop: '24px', padding: '16px', background: '#f0f8ff', border: '1px solid #aed6f1', borderRadius: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '16px' }}>✈</span>
                                    <strong style={{ fontSize: '13px', color: '#1a2d42' }}>Vincular Telegram</strong>
                                    {tgVinculado && <span style={{ fontSize: '11px', background: '#27ae60', color: '#fff', borderRadius: '10px', padding: '1px 8px' }}>Vinculado</span>}
                                </div>
                                <p style={{ fontSize: '12px', color: '#6b7a8d', marginBottom: '12px', lineHeight: '1.5' }}>
                                    El operador podrá registrar horas y gastos, y adjuntar facturas directamente desde Telegram — de forma gratuita.
                                </p>
                                {tgDeepLink && (
                                    <div style={{ background: '#1a2d42', borderRadius: '8px', padding: '12px 14px', marginBottom: '10px' }}>
                                        <p style={{ fontSize: '11px', color: '#9aa5b4', margin: '0 0 10px' }}>
                                            Comparte este enlace con el operador. Al tocarlo desde su celular, se vincula automáticamente sin escribir nada.
                                        </p>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                            <a
                                                href={tgDeepLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ flex: 1, background: '#2980b9', color: '#fff', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}
                                            >
                                                ✈ Abrir en Telegram
                                            </a>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(tgDeepLink); toast('Enlace copiado'); }}
                                                style={{ background: '#34495e', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', cursor: 'pointer' }}
                                            >
                                                Copiar
                                            </button>
                                        </div>
                                        {operadorLocal.telefono && (
                                            <a
                                                href={`https://wa.me/57${operadorLocal.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${operadorLocal.nombre}, toca este enlace para vincular tu Telegram con MaquiControl y registrar tus horas desde el celular:\n${tgDeepLink}`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ display: 'block', background: '#27ae60', color: '#fff', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}
                                            >
                                                Enviar por WhatsApp
                                            </a>
                                        )}
                                        <p style={{ fontSize: '10px', color: '#6b7a8d', margin: '8px 0 0' }}>
                                            Expira al usarse · Código: <code style={{ color: '#f5a623' }}>{tgCode}</code>
                                        </p>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button className="bp" onClick={generarCodigoTelegram} disabled={tgCargando} style={{ fontSize: '12px' }}>
                                        {tgCargando ? 'Generando…' : tgCode ? '↻ Nuevo código' : '✈ Generar código'}
                                    </button>
                                    {tgVinculado && (
                                        <button className="bs" onClick={desvincularTelegram} style={{ fontSize: '12px', color: '#e74c3c', borderColor: '#e74c3c' }}>
                                            Desvincular
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        </>
                    )}
                </div></div>
            </div>
        </>
    );
}

export default DetalleOperador;
