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
    getPagosOperadorSinGasto,
    pasarPagosOperadorAGastos,
    getCortes,
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
    Scissors,
} from 'lucide-react';
import MoneyInput from '../../utils/MoneyInput';
import ScrollTabs from '../../utils/ScrollTabs';
import Estado from '../../utils/Estado';
import EmptyState from '../../utils/EmptyState';
import Opcional from '../../utils/Opcional';
import { useErrores, ErrorCampo } from '../../utils/useErrores';
import { fmtFecha } from '../../utils/fmtFecha';
import { diaSiguiente, enRango, ordenarCortes, repartirPagos, fmtHoras } from '../../utils/cortes';
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

    // Corte en curso: la fecha desde la que se cuenta se puede ajustar a mano
    const [editandoCorte, setEditandoCorte] = useState(false);
    const [corteInput, setCorteInput] = useState('');
    const [cortes, setCortes] = useState([]);
    // Pagos anotados cuando Pago Operador era solo informativo (todavía sin gasto)
    const [pagosSinGasto, setPagosSinGasto] = useState([]);
    const [pasando, setPasando] = useState(false);

    const [editandoFechaPeriodo, setEditandoFechaPeriodo] = useState(false);
    const [fechaPeriodoInput, setFechaPeriodoInput] = useState('');

    // Pago Operador -- la plata que se le entrega al operador (pagos de corte y adelantos).
    // Cada pago crea su gasto "Pago operador" en el backend; solo admin (no visible en el portal).
    const [pagosOperador, setPagosOperador] = useState([]);
    const errPagoOp = useErrores();
    const errEdit = useErrores();
    const PAGO_OP_VACIO = { descripcion: '', monto: '', fecha: hoy() };
    const [pagoOpForm, setPagoOpForm] = useState(PAGO_OP_VACIO);
    const [editandoPagoOpId, setEditandoPagoOpId] = useState(null);

    const refrescarPagosOperador = () =>
        getPagosOperador().then(r => setPagosOperador((r.data || []).filter(p => p.operadorNombre === operador.nombre))).catch(() => {});

    const refrescarPagosSinGasto = () =>
        getPagosOperadorSinGasto().then(r => setPagosSinGasto(r.data || [])).catch(() => {});

    useEffect(() => {
        if (modoPortal) return;
        refrescarPagosOperador();
        refrescarPagosSinGasto();
        getCortes().then(r => setCortes(r.data || [])).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [operador.id, modoPortal]);

    const guardarPagoOperador = async () => {
        const monto = parseFloat(pagoOpForm.monto);
        if (!errPagoOp.validar([{ campo: 'poMonto', ok: monto > 0, msg: 'Escribe cuánto le pagaste' }])) return;
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
    const pasarPagosViejos = async () => {
        const total = pagosSinGasto.reduce((a, p) => a + (Number(p.monto) || 0), 0);
        if (!await confirm(`¿Pasar a Gastos ${pagosSinGasto.length} pago${pagosSinGasto.length === 1 ? '' : 's'} por ${fmt(total)}? Cada uno queda con su fecha original y empieza a contar en los egresos.`)) return;
        setPasando(true);
        try {
            const { data } = await pasarPagosOperadorAGastos();
            toast(`${data.pasados} pago${data.pasados === 1 ? '' : 's'} pasado${data.pasados === 1 ? '' : 's'} a Gastos`);
            await Promise.all([refrescarPagosOperador(), refrescarPagosSinGasto()]);
        } catch {
            toast('No se pudieron pasar los pagos. Intenta de nuevo.', 'e');
        }
        setPasando(false);
    };
    const editarPagoOperador = (p) => {
        setPagoOpForm({ descripcion: p.descripcion || '', monto: String(p.monto ?? ''), fecha: p.fecha || hoy() });
        setEditandoPagoOpId(p.id);
    };
    const cancelarPagoOperador = () => { setEditandoPagoOpId(null); setPagoOpForm(PAGO_OP_VACIO); errPagoOp.setErrores({}); };
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
        if (!errEdit.validar([{ campo: 'edNombre', ok: !!editForm.nombre.trim(), msg: 'Escribe el nombre del operador' }])) return;
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
    // Lo entregado al operador en este periodo: los anticipos que venían anotados en el periodo
    // (antes de unirlos con Pago Operador) más los pagos registrados desde que arrancó.
    const anticiposViejos = periodoActivo?.anticipos || 0;
    const inicioPeriodo = String(periodoActivo?.fechaInicio || '').slice(0, 10);
    const pagosDelPeriodo = periodoActivo ? pagosOperador.filter(p => String(p.fecha || '') >= inicioPeriodo) : [];
    const anticipos = anticiposViejos + pagosDelPeriodo.reduce((a, p) => a + (Number(p.monto) || 0), 0);
    const salarioNeto = salarioBruto - anticipos;

    // Cortes del operador: los mismos tramos que se cortaron con el cliente en sus máquinas
    const maquinasDelOperador = new Set([maqAsignada?.nombre, ...horas.map(h => h.maquinaNombre)].filter(Boolean));
    const cortesDeSusMaquinas = cortes.filter(c => c.conOperador && maquinasDelOperador.has(c.maquinaNombre));
    const cortesOp = ordenarCortes(cortesDeSusMaquinas.filter(c => true
        && String(c.fechaFin || '').slice(0, 10) >= inicioPeriodo));
    // Cortes hechos antes de la fecha de inicio del periodo del operador: no entran en la cuenta
    const cortesAntesDelPeriodo = cortesDeSusMaquinas.length - cortesOp.length;
    const ultimoCorte = cortesOp[cortesOp.length - 1];
    const finUltimoCorte = ultimoCorte ? String(ultimoCorte.fechaFin).slice(0, 10) : '';
    const corteAuto = ultimoCorte ? diaSiguiente(finUltimoCorte) : inicioPeriodo;
    // Un ajuste manual deja de valer cuando ya se hizo un corte que lo cubre
    const corteManual = periodoActivo?.corteDesde && periodoActivo.corteDesde > finUltimoCorte ? periodoActivo.corteDesde : null;
    const corteDesde = corteManual || corteAuto;
    const horasEntre = (desde, hasta) => horas.filter(h => enRango(h.fecha, desde, hasta)).reduce((a, h) => a + getHrs(h), 0);
    const horasCorteEnCurso = !ultimoCorte && !corteManual ? horasPeriodo : horasEntre(corteDesde, null);
    const tramosCorte = cortesOp.map((c, i) => {
        const hrs = horasEntre(c.fechaInicio, c.fechaFin);
        return { id: c.id, nombre: `Corte ${i + 1}`, fechas: `${fmtFecha(c.fechaInicio)} a ${fmtFecha(c.fechaFin)}`, horas: hrs, ganado: hrs * valorHora };
    });
    // Horas del periodo que no están en ningún corte ni en el corte en curso (por ejemplo, lo
    // trabajado antes de la fecha que se ajustó a mano). Son trabajo ya hecho: los pagos se
    // aplican primero ahí, o parecería que al operador se le pagó de más.
    const horasSinCortar = Math.max(0, Math.round((horasPeriodo - tramosCorte.reduce((a, t) => a + t.horas, 0) - horasCorteEnCurso) * 100) / 100);
    const { filas: filasCorte, aFavor } = repartirPagos([
        ...(horasSinCortar > 0 ? [{ id: 'antes', nombre: 'Sin cortar', fechas: `antes del ${fmtFecha(cortesOp[0]?.fechaInicio || corteDesde)}`, horas: horasSinCortar, ganado: horasSinCortar * valorHora }] : []),
        ...tramosCorte,
        { id: 'curso', nombre: 'En curso', fechas: `${fmtFecha(corteDesde)} a hoy`, horas: horasCorteEnCurso, ganado: horasCorteEnCurso * valorHora },
    ], anticipos);
    const filaCurso = filasCorte[filasCorte.length - 1];
    const totalHorasAcumuladas = horas.reduce((acc, h) => acc + getHrs(h), 0);
    const totalPagadoOperador = pagosOperador.reduce((a, p) => a + (Number(p.monto) || 0), 0);
    const pagosOperadorOrdenados = pagosOperador.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    const { filtrado: horasRango, desde: hrDesde, setDesde: setHrDesde, hasta: hrHasta, setHasta: setHrHasta } = useDateRange(horas, 'fecha');
    const { sorted: horasOrdenadas, Th: ThHora } = useSortable(horasRango, 'fecha', 'desc');
    const pagHoras = usePaginacion(horasOrdenadas, 20);

    const basePeriodo = (p) => ({
        estado: p.estado, anticipos: p.anticipos || 0, fechaFin: p.fechaFin || null, horasTotal: p.horasTotal,
        salarioBruto: p.salarioBruto, salarioNeto: p.salarioNeto, nota: p.nota || null, desdeHoraId: p.desdeHoraId,
    });

    // sin valor = volver a la fecha automática (día siguiente al último corte); se manda "auto"
    const guardarCorteDesde = (valor) => {
        if (!periodoActivo) return toast('No hay periodo activo', 'e');
        updatePeriodoAPI(periodoActivo.id, { ...basePeriodo(periodoActivo), corteDesde: valor || 'auto' })
            .then(() => refrescarPeriodos())
            .then(() => { toast(valor ? 'Fecha del corte en curso actualizada' : 'El corte vuelve a contar desde la fecha automática'); setEditandoCorte(false); })
            .catch(() => toast('No se pudo cambiar la fecha', 'e'));
    };

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

                    <ScrollTabs className="do-dtabs" activeIndex={tab}>
                        {TABS.map((t, i) => <button key={i} className={`do-dtab ${tab === i ? 'on' : ''}`} onClick={() => setTab(i)}>{t}</button>)}
                    </ScrollTabs>

                    {tab === 0 && (
                        <>
                            {!modoPortal && periodoActivo && (
                                <div className="ct-curso">
                                    <div>
                                        <div className="ct-curso-lab"><Scissors size={13} /> Corte en curso</div>
                                        <div className="ct-curso-big">{fmtHoras(filaCurso.horas)} h</div>
                                        {editandoCorte ? (
                                            <div className="ct-curso-edit">
                                                <input className="fi" type="date" aria-label="Fecha desde la que cuenta el corte" value={corteInput} onChange={(e) => setCorteInput(e.target.value)} />
                                                <button className="bp" onClick={() => corteInput ? guardarCorteDesde(corteInput) : toast('Selecciona una fecha', 'e')}>Guardar</button>
                                                {corteManual && <button className="bs" onClick={() => guardarCorteDesde('')}>Usar fecha automática</button>}
                                                <button className="bs" onClick={() => setEditandoCorte(false)}>Cancelar</button>
                                            </div>
                                        ) : (
                                            <div className="ct-curso-ln">
                                                Cuenta desde el{' '}
                                                <button className="ct-curso-fecha" title="Cambiar la fecha desde la que cuenta el corte"
                                                    onClick={() => { setCorteInput(corteDesde || hoy()); setEditandoCorte(true); }}>
                                                    {fmtFecha(corteDesde)} <Pencil size={11} />
                                                </button>
                                                {corteManual ? ' · ajustada a mano' : ultimoCorte ? ' · día siguiente al último corte' : ' · inicio del periodo'}
                                            </div>
                                        )}
                                        <div className="ct-curso-ln">Ganado <b>{fmt(filaCurso.ganado)}</b> · Pagado <b>{fmt(filaCurso.pagado)}</b></div>
                                    </div>
                                    <div className="ct-curso-debe">
                                        <span>{aFavor > 0 ? 'Le pagaste de más' : 'Le debes en este corte'}</span>
                                        <b className={aFavor > 0 ? 'fav' : ''}>{fmt(aFavor > 0 ? aFavor : filaCurso.debe)}</b>
                                    </div>
                                </div>
                            )}

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
                                    <div className="do-kpi-sub">{fmtHoras(horasPeriodo)} hrs x {fmt(valorHora)}</div>
                                </div>
                                <div className="do-kpi bad">
                                    <div className="do-kpi-top">
                                        <span className="do-kpi-label">{modoPortal ? 'Anticipos' : 'Pagos y anticipos'}</span>
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
                                    <div className="do-kpi-sub">{modoPortal ? 'bruto - anticipos' : 'bruto − lo pagado'}</div>
                                </div>
                                {!modoPortal && (
                                    <div className="do-kpi purple">
                                        <div className="do-kpi-top">
                                            <span className="do-kpi-label">Pago Operador</span>
                                            <span className="do-kpi-ico"><CreditCard size={14} /></span>
                                        </div>
                                        <div className="do-kpi-val do-num">{fmt(totalPagadoOperador)}</div>
                                        <div className="do-kpi-sub">{pagosOperador.length} pago{pagosOperador.length === 1 ? '' : 's'} · registrados en Gastos</div>
                                    </div>
                                )}
                            </div>

                            {periodoActivo && (
                                <div className="ale">
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
                                            {fmtHoras(horasPeriodo)} hrs · {fmt(salarioBruto)} bruto · {fmt(anticipos)} {modoPortal ? 'anticipos' : 'pagado'} → neto <strong>{fmt(salarioNeto)}</strong>
                                        </span>
                                    </div>
                                </div>
                            )}

                            {maqAsignada && (
                                <div className="ale blue">
                                    <Gauge size={18} />
                                    <div>
                                        <p>Horometro actual de {maqAsignada.nombre}</p>
                                        <span className="ale-desc">
                                            <strong>{(maqAsignada.horometroActual || 0).toLocaleString('es-CO')} hrs</strong> acumuladas en la maquina
                                        </span>
                                    </div>
                                </div>
                            )}

                            {!modoPortal && (
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                    <button className="bs" onClick={() => setTab(3)}><CreditCard size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Registrar pago o adelanto</button>
                                </div>
                            )}

                            {!modoPortal && cortesAntesDelPeriodo > 0 && periodoActivo && (
                                <div className="ct-aviso"><AlertTriangle size={14} /> Hay {cortesAntesDelPeriodo} corte{cortesAntesDelPeriodo === 1 ? '' : 's'} anterior{cortesAntesDelPeriodo === 1 ? '' : 'es'} al inicio de este periodo ({fmtFecha(periodoActivo.fechaInicio)}) que no se están contando. Si el operador viene trabajando desde antes, cambia la fecha en "Periodo activo desde".</div>
                            )}

                            {!modoPortal && filasCorte.length > 1 && (
                                <div className="ct-box">
                                    <div className="ct-head"><b><Scissors size={14} /> Cortes de este periodo</b><span className="ct-sub">Mismas fechas del corte con el cliente</span></div>
                                    <div className="ct-tabla">
                                        <div className="ct-row op h"><span>Corte</span><span>Fechas</span><span className="r">Horas</span><span className="r">Se ganó</span><span className="r">Pagado</span><span className="r">Le debes</span></div>
                                        {filasCorte.map(f => (
                                            <div className={`ct-row op ${f.id === 'curso' ? 'curso' : ''}`} key={f.id}>
                                                <span data-l="Corte"><b>{f.nombre}</b></span>
                                                <span data-l="Fechas">{f.fechas}</span>
                                                <span data-l="Horas" className="r ct-num">{fmtHoras(f.horas)} h</span>
                                                <span data-l="Se ganó" className="r ct-num">{fmt(f.ganado)}</span>
                                                <span data-l="Pagado" className="r ct-num pos">{fmt(f.pagado)}</span>
                                                <span data-l="Le debes" className={`r ct-num ${f.debe > 0 ? 'neg' : ''}`}>{fmt(f.debe)}</span>
                                            </div>
                                        ))}
                                        <div className="ct-row op tot">
                                            <span><b>Total</b></span><span />
                                            <span data-l="Horas" className="r ct-num">{fmtHoras(filasCorte.reduce((a, f) => a + f.horas, 0))} h</span>
                                            <span data-l="Se ganó" className="r ct-num">{fmt(filasCorte.reduce((a, f) => a + f.ganado, 0))}</span>
                                            <span data-l="Pagado" className="r ct-num pos">{fmt(filasCorte.reduce((a, f) => a + f.pagado, 0))}</span>
                                            <span data-l="Le debes" className="r ct-num neg">{fmt(filasCorte.reduce((a, f) => a + f.debe, 0))}</span>
                                        </div>
                                    </div>
                                    <p className="ct-nota">Cada pago se aplica primero al corte más viejo que tenga deuda; lo que sobra pasa al siguiente.{aFavor > 0 ? ` Le has pagado ${fmt(aFavor)} de más: se descuenta de lo que siga trabajando.` : ''}</p>
                                </div>
                            )}

                            <div className="tbl">
                                <div className="th"><strong>Horas de este periodo</strong></div>
                                <div className="tr hdr"><span>Fecha</span><span className="w2">Maquina</span><span>Horas</span><span>Horometro fin</span><span className="amt">Valor ganado</span></div>
                                {horasDelPeriodo.length === 0 && <p className="vacio">Sin horas en este periodo — se registran desde Telegram/WhatsApp</p>}
                                {horasDelPeriodo.slice(0, 8).map((h) => (
                                    <div className="tr" key={h.id}>
                                        <span>{fmtFecha(h.fecha)}</span>
                                        <span className="w2">{h.maquinaNombre}</span>
                                        <span><strong>{getHrs(h)}</strong> hrs</span>
                                        <span>{h.horometroFin || '-'}</span>
                                        <span className="pos amt">{fmt(getHrs(h) * (h.valorHora || valorHora))}</span>
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
                                <ThHora campo="valorHora" className="amt">$/Hora</ThHora>
                                <span className="amt">Valor</span>
                                <span>Acc.</span>
                            </div>
                            {horasOrdenadas.length === 0 && <p className="vacio">Sin horas registradas</p>}
                            {pagHoras.paginados.map((h) => (
                                <div className="tr" key={h.id}>
                                    <span>{fmtFecha(h.fecha)}</span>
                                    <span className="w2">{h.maquinaNombre}</span>
                                    <span><strong>{getHrs(h)}</strong> hrs</span>
                                    <span className="amt">{fmt(h.valorHora || valorHora)}</span>
                                    <span className="pos amt">{fmt(getHrs(h) * (h.valorHora || valorHora))}</span>
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
                            <div className="ale green">
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
                                        <Estado valor={p.estado === 'activo' ? 'En curso' : 'Cerrado'} />
                                    </div>
                                    <div className="rr"><span>Inicio</span><span>{fmtFecha(p.fechaInicio)}</span></div>
                                    {p.fechaFin && <div className="rr"><span>Fin</span><span>{fmtFecha(p.fechaFin)}</span></div>}
                                    {p.estado === 'activo' && <div className="rr"><span>Horas acumuladas</span><span><strong>{fmtHoras(horasPeriodo)} hrs</strong></span></div>}
                                    {p.horasTotal != null && p.estado !== 'activo' && <div className="rr"><span>Horas trabajadas</span><span>{p.horasTotal} hrs</span></div>}
                                    {p.salarioBruto != null && <div className="rr"><span>Salario bruto</span><span className="pos">{fmt(p.estado === 'activo' ? salarioBruto : p.salarioBruto)}</span></div>}
                                    {(p.estado === 'activo' ? anticipos : p.anticipos) > 0 && <div className="rr"><span>{modoPortal ? 'Anticipos' : 'Pagos y anticipos'}</span><span className="neg">{fmt(p.estado === 'activo' ? anticipos : p.anticipos)}</span></div>}
                                    {p.salarioNeto != null && <div className="rr"><span>Salario neto</span><span className="pos" style={{ fontWeight: '700' }}>{fmt(p.estado === 'activo' ? salarioNeto : p.salarioNeto)}</span></div>}
                                    {p.nota && <div className="rr"><span>Nota</span><span style={{ color: '#6b7a8d' }}>{p.nota}</span></div>}
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {p.estado === 'activo' && !modoPortal && (
                                            <button className="bs" style={{ fontSize: '11px' }} onClick={() => setTab(3)}>+ Pago o adelanto</button>
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
                            <div className="ale purple">
                                <CreditCard size={18} color="#8e44ad" />
                                <div>
                                    <p>Cada pago queda también en Gastos</p>
                                    <span className="ale-desc">Anota aquí los pagos y adelantos que le das a {operadorLocal.nombre}. La app crea el gasto sola, así que no lo anotes otra vez en Finanzas. Si editas o borras un pago, el gasto cambia igual.</span>
                                </div>
                            </div>

                            {pagosSinGasto.length > 0 && (
                                <div className="ct-box ct-migrar">
                                    <div className="ct-head"><b><AlertTriangle size={14} /> Pagos anteriores que todavía no están en Gastos</b></div>
                                    <p className="ct-nota" style={{ marginTop: 0 }}>Se anotaron cuando esta pestaña era solo informativa. Revisa la lista: al pasarlos, cada uno entra a Gastos con su fecha original y empieza a contar en los egresos de ese mes.</p>
                                    <div className="ct-tabla">
                                        <div className="ct-row mig h"><span>Fecha</span><span>Operador</span><span>Descripción</span><span className="r">Monto</span></div>
                                        {pagosSinGasto.map(p => (
                                            <div className="ct-row mig" key={p.id}>
                                                <span data-l="Fecha">{fmtFecha(p.fecha)}</span>
                                                <span data-l="Operador">{p.operadorNombre}</span>
                                                <span data-l="Descripción">{p.descripcion || '—'}</span>
                                                <span data-l="Monto" className="r ct-num">{fmt(p.monto)}</span>
                                            </div>
                                        ))}
                                        <div className="ct-row mig tot"><span><b>Total</b></span><span /><span>{pagosSinGasto.length} pago{pagosSinGasto.length === 1 ? '' : 's'}</span><span className="r ct-num">{fmt(pagosSinGasto.reduce((a, p) => a + (Number(p.monto) || 0), 0))}</span></div>
                                    </div>
                                    <div className="ct-acts"><button className="bp" onClick={pasarPagosViejos} disabled={pasando}><Check size={14} /> {pasando ? 'Pasando…' : 'Pasar a Gastos'}</button></div>
                                </div>
                            )}

                            <div className="fc">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CreditCard size={18} /> {editandoPagoOpId ? 'Editar pago' : 'Registrar pago o adelanto'}
                                </h3>
                                <label className="fl">Monto ($) *</label>
                                <MoneyInput className={errPagoOp.clase('fi', 'poMonto')} {...errPagoOp.props('poMonto')} value={pagoOpForm.monto}
                                    onChange={e => { setPagoOpForm({ ...pagoOpForm, monto: e.target.value }); errPagoOp.limpiar('poMonto'); }} placeholder="Ej: 200.000" />
                                <ErrorCampo msg={errPagoOp.errores.poMonto} />
                                <Opcional label="Fecha y descripción (opcional)" abierto={!!editandoPagoOpId && !!pagoOpForm.descripcion}>
                                    <div className="fg2-keep">
                                        <div><label className="fl">Fecha</label><input className="fi" type="date" value={pagoOpForm.fecha} onChange={e => setPagoOpForm({ ...pagoOpForm, fecha: e.target.value })} /></div>
                                        <div><label className="fl">Descripción</label><input className="fi" value={pagoOpForm.descripcion} onChange={e => setPagoOpForm({ ...pagoOpForm, descripcion: e.target.value })} placeholder="Ej: Quincena" /></div>
                                    </div>
                                </Opcional>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="bp" onClick={guardarPagoOperador}>
                                        <Check size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> {editandoPagoOpId ? 'Guardar cambios' : 'Registrar pago'}
                                    </button>
                                    {editandoPagoOpId && <button className="bs" onClick={cancelarPagoOperador}>Cancelar</button>}
                                </div>
                            </div>

                            <div className="tbl">
                                <div className="th"><strong>Pagos registrados — {operadorLocal.nombre}</strong></div>
                                {pagosOperador.length === 0 ? (
                                    <EmptyState
                                        icono={<CreditCard size={20} />}
                                        titulo="Aún no hay pagos registrados"
                                        texto={`Anota aquí los pagos y adelantos que le das a ${operadorLocal.nombre}. Cada uno queda también en Gastos.`}
                                        accion={{ label: 'Registrar el primero', onClick: () => document.querySelector('[data-campo="poMonto"]')?.focus() }}
                                    />
                                ) : (
                                    <>
                                        <div className="tr hdr only-desk"><span>Fecha</span><span className="w2">Descripción</span><span className="amt">Monto</span><span>Acc.</span></div>
                                        {pagosOperadorOrdenados.map(p => (
                                            <div className="tr only-desk" key={p.id}>
                                                <span>{fmtFecha(p.fecha)}</span>
                                                <span className="w2">{p.descripcion || '—'}{!p.gastoGeneradoId && <small className="ct-pend"> · sin pasar a Gastos</small>}</span>
                                                <span className="pos amt">{fmt(p.monto)}</span>
                                                <span>
                                                    <button className="icon-btn" aria-label="Editar pago" onClick={() => editarPagoOperador(p)}><Pencil size={14} /></button>
                                                    <button className="icon-btn" aria-label="Borrar pago" onClick={() => eliminarPagoOperador(p.id)}><Trash2 size={14} /></button>
                                                </span>
                                            </div>
                                        ))}
                                        {pagosOperadorOrdenados.map(p => (
                                            <div className="mcard only-mob" key={p.id}>
                                                <div className="mcard-top"><span className="mcard-t">{p.descripcion || 'Pago'}</span><b className="pos" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(p.monto)}</b></div>
                                                <div className="mcard-foot">
                                                    <span>{fmtFecha(p.fecha)}</span>
                                                    <span>
                                                        <button className="icon-btn" aria-label="Editar pago" onClick={() => editarPagoOperador(p)}><Pencil size={15} /></button>
                                                        <button className="icon-btn" aria-label="Borrar pago" onClick={() => eliminarPagoOperador(p.id)}><Trash2 size={15} /></button>
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="po-total">
                                            Total pagado: <strong className="pos">{fmt(totalPagadoOperador)}</strong>
                                        </div>
                                    </>
                                )}
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
                                        className={errEdit.clase('fi', 'edNombre')}
                                        {...errEdit.props('edNombre')}
                                        value={editForm.nombre}
                                        onChange={e => { setEditForm({ ...editForm, nombre: e.target.value }); errEdit.limpiar('edNombre'); }}
                                        placeholder="Ej: Carlos Pérez"
                                    />
                                    <ErrorCampo msg={errEdit.errores.edNombre} />
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
