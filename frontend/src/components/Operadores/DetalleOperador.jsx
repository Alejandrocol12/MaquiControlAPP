import { useState, useEffect, useCallback } from 'react';
import {
    getHorasOperador,
    createHora,
    deleteHora,
    getMaquinas,
    createSalario,
    createIngreso,
    createGasto,
    getPeriodosAPI,
    createPeriodoAPI,
    updatePeriodoAPI,
    updateOperadorAPI,
} from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import {
    ClipboardList,
    Clock,
    Calendar,
    StopCircle,
    HardHat,
    Tractor,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Landmark,
    Check,
    Trash2,
    Info,
    Briefcase,
    Gauge,
    Pencil,
} from 'lucide-react';
import MoneyInput from '../../utils/MoneyInput';
import { GiBulldozer } from 'react-icons/gi';
import { TbBackhoe } from 'react-icons/tb';

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

    const [horaForm, setHoraForm] = useState({
        maquinaNombre: '',
        fecha: hoy(),
        horaEntrada: '',
        horaSalida: '',
        horometroInicio: '',
        horometroFin: '',
    });

    const [mostrarDescanso, setMostrarDescanso] = useState(false);
    const [anticipoExtra, setAnticipoExtra] = useState('');
    const [notaDescanso, setNotaDescanso] = useState('');
    const [anticipoInput, setAnticipoInput] = useState('');
    const [mostrarAnticipoForm, setMostrarAnticipoForm] = useState(false);

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

    const cargar = useCallback(() => {
        return Promise.all([
            getHorasOperador(operador.id),
            getMaquinas(),
            getPeriodosAPI(operador.id),
        ]).then(([horasRes, maquinasRes, periodosRes]) => {
            setHoras(horasRes.data);
            setMaquinas(maquinasRes.data);
            setPeriodos((periodosRes.data || []).map(normalizePeriodo));
        });
    }, [operador.id]);

    useEffect(() => {
        const init = async () => {
            try {
                await cargar();
                const periodosRes = await getPeriodosAPI(operador.id);
                const periodosActuales = (periodosRes.data || []).map(normalizePeriodo);

                if (!periodosActuales.some((p) => p.estado === 'activo')) {
                    await createPeriodoAPI(operador.id, {
                        fechaInicio: hoy(),
                        estado: 'activo',
                        anticipos: 0,
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
    }, [cargar, operador.id]);

    const periodoActivo = periodos.find((p) => p.estado === 'activo') || null;
    const maqAsignada = maquinas.find((m) =>
        m.operadorNombre === operador.nombre ||
        (operador.id && String(m.operador_id) === String(operador.id))
    ) || null;
    const valorHora = maqAsignada?.valorHoraOperador || 0;

    useEffect(() => {
        if (maqAsignada) {
            setHoraForm(prev => ({
                ...prev,
                maquinaNombre: maqAsignada.nombre,
                horometroInicio: maqAsignada.horometroActual || ''
            }));
        }
    }, [maqAsignada?.nombre]);
    const valorHoraMaquina = maqAsignada?.valorHoraMaquina || 0;

    const horasPeriodo = periodoActivo
        ? horas
            .filter((h) => periodoActivo.desdeHoraId != null
                ? Number(h.id) > Number(periodoActivo.desdeHoraId)
                : h.fecha >= (periodoActivo.fechaInicio || hoy()))
            .reduce((acc, h) => acc + getHrs(h), 0)
        : horas.reduce((acc, h) => acc + getHrs(h), 0);

    const salarioBruto = horasPeriodo * valorHora;
    const anticipos = periodoActivo?.anticipos || 0;
    const salarioNeto = salarioBruto - anticipos;
    const totalHorasAcumuladas = horas.reduce((acc, h) => acc + getHrs(h), 0);

    const calcularHoras = (entrada, salida) => {
        if (!entrada || !salida) return 0;
        const [eh, em] = entrada.split(':').map(Number);
        const [sh, sm] = salida.split(':').map(Number);
        const diff = (sh * 60 + sm) - (eh * 60 + em);
        return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 0;
    };

    const totalHorasForm = calcularHoras(horaForm.horaEntrada, horaForm.horaSalida);

    const refrescarPeriodos = () =>
        getPeriodosAPI(operador.id).then((res) => setPeriodos((res.data || []).map(normalizePeriodo)));

    const registrarHoras = () => {
        if (!horaForm.maquinaNombre || !horaForm.horaEntrada || !horaForm.horaSalida) {
            return toast('Completa maquina, hora entrada y hora salida', 'e');
        }
        if (totalHorasForm <= 0) {
            return toast('La hora de salida debe ser mayor que la de entrada', 'e');
        }

        const maqSel = maquinas.find((m) => m.nombre === horaForm.maquinaNombre);
        const horoFin = parseFloat(horaForm.horometroFin || 0);
        const horoInicio = parseFloat(horaForm.horometroInicio || 0);
        const nuevoHoro = horoFin > 0 ? horoFin : (maqSel?.horometroActual || 0) + totalHorasForm;

        createHora({
            operador_id: operador.id,
            operadorNombre: operador.nombre,
            maquinaNombre: horaForm.maquinaNombre,
            fecha: horaForm.fecha,
            horas: totalHorasForm,
            valorHora,
            horometroInicio: horoInicio,
            horometroFin: horoFin || nuevoHoro,
        }).then(() => {
            if (valorHoraMaquina > 0) {
                return createIngreso({
                    maquinaNombre: horaForm.maquinaNombre,
                    tipoTrabajo: 'Horas',
                    cantidad: totalHorasForm,
                    valorUnitario: valorHoraMaquina,
                    total: totalHorasForm * valorHoraMaquina,
                    fecha: horaForm.fecha,
                    descripcion: `Horas ${operador.nombre} - ${horaForm.maquinaNombre}`,
                });
            }
            return Promise.resolve();
        }).then(() => cargar())
            .then(() => {
                setHoraForm({
                    maquinaNombre: maqAsignada?.nombre || '',
                    fecha: hoy(),
                    horaEntrada: '',
                    horaSalida: '',
                    horometroInicio: '',
                    horometroFin: '',
                });
                toast(`${totalHorasForm} horas registradas · Horometro -> ${nuevoHoro} hrs`);
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

    const registrarDescanso = () => {
        if (!periodoActivo) return toast('No hay periodo activo', 'e');

        const anticTot = (periodoActivo.anticipos || 0) + parseFloat(anticipoExtra || 0);
        const bruto = horasPeriodo * valorHora;
        const neto = bruto - anticTot;
        const ultimaHoraId = horas.reduce((max, h) => Math.max(max, Number(h.id) || 0), 0);

        createSalario({
            operadorNombre: operador.nombre,
            maquinaNombre: maqAsignada?.nombre || '-',
            horasTrabajadas: horasPeriodo,
            valorHora,
            totalBruto: bruto,
            descuentos: anticTot,
            totalNeto: neto,
            fecha: hoy(),
            estado: 'Pendiente',
            nota: notaDescanso || `Descanso ${periodoActivo.fechaInicio} -> ${hoy()}`,
        }).then(() => createGasto({
            maquinaNombre: maqAsignada?.nombre || '-',
            descripcion: `Salario ${operador.nombre} - ${horasPeriodo} hrs (${periodoActivo.fechaInicio} -> ${hoy()})`,
            categoria: 'Salarios',
            monto: neto,
            fecha: hoy(),
        })).then(() => updatePeriodoAPI(periodoActivo.id, {
            estado: 'cerrado',
            anticipos: anticTot,
            fechaFin: hoy(),
            horasTotal: horasPeriodo,
            salarioBruto: bruto,
            salarioNeto: neto,
            nota: notaDescanso || null,
            desdeHoraId: periodoActivo.desdeHoraId,
        })).then(() => createPeriodoAPI(operador.id, {
            fechaInicio: hoy(),
            estado: 'activo',
            anticipos: 0,
            desdeHoraId: ultimaHoraId,
        })).then(() => refrescarPeriodos())
            .then(() => {
                setMostrarDescanso(false);
                setAnticipoExtra('');
                setNotaDescanso('');
                toast('Descanso registrado - liquidacion creada en Salarios');
            }).catch(console.error);
    };

    const TABS = [
        <><ClipboardList size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Resumen</>,
        <><Clock size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Registrar Horas</>,
        <><Calendar size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Historial</>,
        <><StopCircle size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Periodos</>,
        ...(!modoPortal ? [<><Pencil size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Editar</>] : []),
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
                    <div className="dh">
                        <div className="dhi"><HardHat size={28} /></div>
                        <div>
                            <h2>{operadorLocal.nombre}</h2>
                            <p>Cedula: {operadorLocal.cedula || '-'} · Tel: {operadorLocal.telefono || '-'} · {operadorLocal.email || '-'}</p>
                            {operador.observaciones && (
                                <p style={{ fontSize: '11px', color: '#6b7a8d', marginTop: '2px' }}>{operador.observaciones}</p>
                            )}
                        </div>
                        <div className="dhb">
                            {maqAsignada
                                ? <span className="b comp" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IcoMaquina tipo={maqAsignada.tipo} size={12} /> {maqAsignada.nombre}</span>
                                : <span className="b falla">Sin maquina asignada</span>}
                            {valorHora > 0 && <span className="b hrs">{fmt(valorHora)}/hr</span>}
                            <span className="b" style={{ background: '#e8f5e9', color: '#27ae60', border: '1px solid #a8d5b5' }}>
                                <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {totalHorasAcumuladas.toLocaleString('es-CO')} hrs totales
                            </span>
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

                    <div className="tabs">
                        {TABS.map((t, i) => <button key={i} className={`tab ${tab === i ? 'on' : ''}`} onClick={() => setTab(i)}>{t}</button>)}
                    </div>

                    {tab === 0 && (
                        <>
                            <div className="g4">
                                <div className="card blue">
                                    <span className="ci"><Clock size={22} /></span>
                                    <div className="cl">Horas periodo</div>
                                    <div className="cv">{horasPeriodo.toLocaleString('es-CO')}</div>
                                    <div className="cs">desde {periodoActivo?.fechaInicio || '-'}</div>
                                </div>
                                <div className="card green">
                                    <span className="ci"><TrendingUp size={22} /></span>
                                    <div className="cl">Salario bruto</div>
                                    <div className="cv">{fmt(salarioBruto)}</div>
                                    <div className="cs">{horasPeriodo} hrs x {fmt(valorHora)}</div>
                                </div>
                                <div className="card red">
                                    <span className="ci"><TrendingDown size={22} /></span>
                                    <div className="cl">Anticipos</div>
                                    <div className="cv">{fmt(anticipos)}</div>
                                    <div className="cs">descontados del neto</div>
                                </div>
                                <div className="card gold">
                                    <span className="ci"><Landmark size={22} /></span>
                                    <div className="cl">Salario neto</div>
                                    <div className="cv" style={{ color: salarioNeto >= 0 ? '#27ae60' : '#e74c3c' }}>{fmt(salarioNeto)}</div>
                                    <div className="cs">bruto - anticipos</div>
                                </div>
                            </div>

                            {periodoActivo && (
                                <div className="ale" style={{ background: '#fff8e7', borderColor: '#f5a623' }}>
                                    <Calendar size={18} />
                                    <div>
                                        <p>Periodo activo desde <strong>{periodoActivo.fechaInicio}</strong></p>
                                        <span className="ale-desc">
                                            {horasPeriodo} hrs · {fmt(salarioBruto)} bruto · {fmt(anticipos)} anticipos -> neto <strong>{fmt(salarioNeto)}</strong>
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
                                <button className="bp" onClick={() => setTab(1)}><Clock size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Registrar Horas</button>
                                <button className="bs" onClick={() => setMostrarAnticipoForm(!mostrarAnticipoForm)}><TrendingDown size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Anticipo</button>
                                <button className="bs" style={{ background: '#c0392b', color: '#fff', border: 'none' }} onClick={() => setMostrarDescanso(true)}>
                                    <StopCircle size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Registrar Descanso
                                </button>
                            </div>

                            {mostrarAnticipoForm && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                                    <MoneyInput className="fi" style={{ margin: 0, maxWidth: '180px' }} placeholder="Monto anticipo ($)" value={anticipoInput} onChange={(e) => setAnticipoInput(e.target.value)} />
                                    <button className="bp" onClick={registrarAnticipo}>Guardar</button>
                                    <button className="bs" onClick={() => { setMostrarAnticipoForm(false); setAnticipoInput(''); }}>Cancelar</button>
                                </div>
                            )}

                            {mostrarDescanso && (
                                <div className="fc" style={{ borderLeft: '4px solid #e74c3c' }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><StopCircle size={18} /> Registrar Descanso - Liquidacion del periodo</h3>
                                    <p className="fd">Se cierra el periodo actual, se crea la liquidacion en Salarios y se abre un periodo nuevo.</p>
                                    <div className="rsum">
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ClipboardList size={16} /> Resumen del periodo</h4>
                                        <div className="rr"><span>Periodo</span><span>{periodoActivo?.fechaInicio} -> {hoy()}</span></div>
                                        <div className="rr"><span>Horas trabajadas</span><span><strong>{horasPeriodo} hrs</strong></span></div>
                                        <div className="rr"><span>Valor/hora</span><span>{fmt(valorHora)}</span></div>
                                        <div className="rr"><span>Salario bruto</span><span className="pos">{fmt(salarioBruto)}</span></div>
                                        <div className="rr"><span>Anticipos acumulados</span><span className="neg">{fmt(anticipos)}</span></div>
                                    </div>
                                    <div className="fg2">
                                        <div>
                                            <label className="fl">Anticipo adicional al cierre ($)</label>
                                            <MoneyInput className="fi" value={anticipoExtra} onChange={(e) => setAnticipoExtra(e.target.value)} placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="fl">Nota (opcional)</label>
                                            <input className="fi" value={notaDescanso} onChange={(e) => setNotaDescanso(e.target.value)} placeholder="Ej: Descanso semana santa" />
                                        </div>
                                    </div>
                                    <div className="rbox">
                                        <div>
                                            <div className="rl">Total a pagar</div>
                                            <div className="rv">{fmt(salarioBruto - anticipos - parseFloat(anticipoExtra || 0))}</div>
                                            <div className="rf">{fmt(salarioBruto)} - {fmt(anticipos + parseFloat(anticipoExtra || 0))} anticipos</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: '#6b7a8d', fontSize: '11px' }}>Se crea en</div>
                                            <div style={{ color: '#27ae60', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={13} /> Salarios</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button className="bp" style={{ background: '#c0392b' }} onClick={registrarDescanso}>
                                            <StopCircle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Confirmar Descanso
                                        </button>
                                        <button className="bs" onClick={() => setMostrarDescanso(false)}>Cancelar</button>
                                    </div>
                                </div>
                            )}

                            <div className="tbl">
                                <div className="th"><strong>Ultimas horas registradas</strong></div>
                                <div className="tr hdr"><span>Fecha</span><span className="w2">Maquina</span><span>Horas</span><span>Horometro fin</span><span>Valor ganado</span></div>
                                {horas.length === 0 && <p className="vacio">Sin horas registradas - usa "Registrar Horas" arriba</p>}
                                {horas.slice(0, 8).map((h) => (
                                    <div className="tr" key={h.id}>
                                        <span>{h.fecha}</span>
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
                        <div className="fc">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={18} /> Registrar Horas Trabajadas</h3>
                            <p className="fd">Las horas se acumulan en el periodo activo y actualizan el horometro de la maquina.</p>
                            <div className="fg2">
                                <div>
                                    <label className="fl">Máquina asignada</label>
                                    <input
                                        className="fi"
                                        value={horaForm.maquinaNombre || 'Sin máquina asignada'}
                                        readOnly
                                        style={{ background: '#f0f4f8', cursor: 'not-allowed', color: '#4a5568' }}
                                    />
                                </div>
                                <div>
                                    <label className="fl">Fecha</label>
                                    <input className="fi" type="date" value={horaForm.fecha} onChange={(e) => setHoraForm({ ...horaForm, fecha: e.target.value })} />
                                </div>
                            </div>
                            <div className="fg2">
                                <div>
                                    <label className="fl">Hora entrada *</label>
                                    <input className="fi" type="time" value={horaForm.horaEntrada} onChange={(e) => setHoraForm({ ...horaForm, horaEntrada: e.target.value })} />
                                </div>
                                <div>
                                    <label className="fl">Hora salida *</label>
                                    <input className="fi" type="time" value={horaForm.horaSalida} onChange={(e) => setHoraForm({ ...horaForm, horaSalida: e.target.value })} />
                                </div>
                            </div>
                            <div className="fg2">
                                <div>
                                    <label className="fl">Horometro inicio (auto)</label>
                                    <input className="fi" type="number" value={horaForm.horometroInicio} onChange={(e) => setHoraForm({ ...horaForm, horometroInicio: e.target.value })} placeholder="Se llena automatico" />
                                </div>
                                <div>
                                    <label className="fl">Horometro fin (opcional)</label>
                                    <input className="fi" type="number" value={horaForm.horometroFin} onChange={(e) => setHoraForm({ ...horaForm, horometroFin: e.target.value })} placeholder="Si lo dejas vacio se suma automatico" />
                                </div>
                            </div>

                            {horaForm.horaEntrada && horaForm.horaSalida && totalHorasForm > 0 && (
                                <div className="rsum">
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ClipboardList size={16} /> Resumen antes de guardar</h4>
                                    <div className="rr"><span>Horas calculadas</span><span><strong>{totalHorasForm} hrs</strong></span></div>
                                    <div className="rr"><span>Valor/hora</span><span>{fmt(valorHora)}</span></div>
                                    <div className="rr"><span>Valor ganado</span><span className="pos"><strong>{fmt(totalHorasForm * valorHora)}</strong></span></div>
                                    {horaForm.maquinaNombre && (() => {
                                        const maquina = maquinas.find((x) => x.nombre === horaForm.maquinaNombre);
                                        const horoFin = parseFloat(horaForm.horometroFin || 0);
                                        const nuevo = horoFin > 0 ? horoFin : (maquina?.horometroActual || 0) + totalHorasForm;
                                        return (
                                            <div className="rr">
                                                <span>Horometro {horaForm.maquinaNombre}</span>
                                                <span style={{ color: '#2980b9' }}>{maquina?.horometroActual || 0} -> <strong>{nuevo} hrs</strong></span>
                                            </div>
                                        );
                                    })()}
                                    <div className="rr"><span>Horas totales periodo (despues)</span><span><strong>{(horasPeriodo + totalHorasForm).toLocaleString('es-CO')} hrs</strong></span></div>
                                    <div className="rr"><span>Salario bruto (despues)</span><span className="pos"><strong>{fmt((horasPeriodo + totalHorasForm) * valorHora)}</strong></span></div>
                                </div>
                            )}

                            <button className="bp" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={registrarHoras}>
                                <Check size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Guardar Horas
                            </button>
                        </div>
                    )}

                    {tab === 2 && (
                        <div className="tbl">
                            <div className="th">
                                <strong>Historial completo de horas - {operador.nombre}</strong>
                                <span style={{ fontSize: '11px', color: '#6b7a8d' }}>Total: {totalHorasAcumuladas} hrs · {fmt(totalHorasAcumuladas * valorHora)}</span>
                            </div>
                            <div className="tr hdr">
                                <span>Fecha</span><span className="w2">Maquina</span><span>Horas</span><span>$/Hora</span><span>Valor</span><span>Acc.</span>
                            </div>
                            {horas.length === 0 && <p className="vacio">Sin horas registradas</p>}
                            {horas.map((h) => (
                                <div className="tr" key={h.id}>
                                    <span>{h.fecha}</span>
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
                        </div>
                    )}

                    {tab === 3 && (
                        <>
                            <div className="ale" style={{ background: '#e8f5e9', borderColor: '#27ae60' }}>
                                <Info size={18} />
                                <div>
                                    <p>Un periodo se cierra al registrar un descanso</p>
                                    <span className="ale-desc">Cada periodo acumula horas, salario y anticipos de forma independiente.</span>
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
                                    <div className="rr"><span>Inicio</span><span>{p.fechaInicio}</span></div>
                                    {p.fechaFin && <div className="rr"><span>Fin (descanso)</span><span>{p.fechaFin}</span></div>}
                                    {p.estado === 'activo' && <div className="rr"><span>Horas acumuladas</span><span><strong>{horasPeriodo} hrs</strong></span></div>}
                                    {p.horasTotal != null && p.estado !== 'activo' && <div className="rr"><span>Horas trabajadas</span><span>{p.horasTotal} hrs</span></div>}
                                    {p.salarioBruto != null && <div className="rr"><span>Salario bruto</span><span className="pos">{fmt(p.estado === 'activo' ? salarioBruto : p.salarioBruto)}</span></div>}
                                    {p.anticipos > 0 && <div className="rr"><span>Anticipos</span><span className="neg">{fmt(p.estado === 'activo' ? anticipos : p.anticipos)}</span></div>}
                                    {p.salarioNeto != null && <div className="rr"><span>Salario neto</span><span className="pos" style={{ fontWeight: '700' }}>{fmt(p.estado === 'activo' ? salarioNeto : p.salarioNeto)}</span></div>}
                                    {p.nota && <div className="rr"><span>Nota</span><span style={{ color: '#6b7a8d' }}>{p.nota}</span></div>}
                                    {p.estado === 'activo' && (
                                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                                            <button className="bs" style={{ fontSize: '11px' }} onClick={() => { setMostrarAnticipoForm(true); setTab(0); }}>+ Anticipo</button>
                                            <button className="bs" style={{ fontSize: '11px', background: '#c0392b', color: '#fff', border: 'none' }} onClick={() => { setMostrarDescanso(true); setTab(0); }}>
                                                <StopCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Descanso
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {periodos.length === 0 && <p className="vacio">Sin periodos registrados</p>}
                        </>
                    )}

                    {tab === 4 && !modoPortal && (
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
                        </div>
                    )}
                </div></div>
            </div>
        </>
    );
}

export default DetalleOperador;
