import { useState, useEffect, useCallback } from 'react';
import { getHoras, createHora, deleteHora, getMaquinas, createSalario, createIngreso, createGasto } from '../../api';
import { getPeriodos, addPeriodo, updatePeriodo, getPeriodoActivo } from '../../utils/localDB';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';

const fmt   = (v) => '$' + (v || 0).toLocaleString('es-CO');
const hoy   = () => new Date().toISOString().split('T')[0];
const getHrs = (h) => parseFloat(h.horas ?? 0);

function DetalleOperador({ operador, onVolver }) {
    const toast              = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [tab, setTab]             = useState(0);
    const [horas, setHoras]         = useState([]);
    const [maquinas, setMaquinas]   = useState([]);
    const [periodos, setPeriodos]   = useState([]);

    const [horaForm, setHoraForm] = useState({
        maquinaNombre: '', fecha: hoy(),
        horaEntrada: '', horaSalida: '',
        horometroInicio: '', horometroFin: '',
    });

    const [mostrarDescanso, setMostrarDescanso] = useState(false);
    const [anticipoExtra, setAnticipoExtra]     = useState('');
    const [notaDescanso, setNotaDescanso]       = useState('');

    // ── carga datos ──────────────────────────────────────────
    const cargar = useCallback(() => {
        getHoras()
            .then(r => setHoras(r.data.filter(h => h.operadorNombre === operador.nombre)))
            .catch(console.error);
        getMaquinas()
            .then(r => { setMaquinas(r.data); })
            .catch(console.error);
        setPeriodos(getPeriodos(operador.id));
    }, [operador.id, operador.nombre]);

    useEffect(() => {
        cargar();
        if (!getPeriodoActivo(operador.id)) {
            addPeriodo({ operadorId: operador.id, operadorNombre: operador.nombre, fechaInicio: hoy(), anticipos: 0 });
            setPeriodos(getPeriodos(operador.id));
        }
    }, [cargar, operador.id, operador.nombre]);

    // ── derivados ─────────────────────────────────────────────
    const periodoActivo = periodos.find(p => p.estado === 'activo') || null;
    const maqAsignada      = maquinas.find(m => m.operadorNombre === operador.nombre) || null;
    const valorHora        = maqAsignada?.valorHoraOperador || 0;
    const valorHoraMaquina = maqAsignada?.valorHoraMaquina  || 0;

    const horasPeriodo = periodoActivo
        ? horas
            .filter(h => periodoActivo.desdeHoraId != null
                ? h.id > periodoActivo.desdeHoraId
                : h.fecha >= periodoActivo.fechaInicio)
            .reduce((a, h) => a + getHrs(h), 0)
        : horas.reduce((a, h) => a + getHrs(h), 0);

    const salarioBruto = horasPeriodo * valorHora;
    const anticipos    = periodoActivo?.anticipos || 0;
    const salarioNeto  = salarioBruto - anticipos;
    const totalHorasAcumuladas = horas.reduce((a, h) => a + getHrs(h), 0);

    // ── calcula horas entre dos tiempos ───────────────────────
    const calcularHoras = (entrada, salida) => {
        if (!entrada || !salida) return 0;
        const [eh, em] = entrada.split(':').map(Number);
        const [sh, sm] = salida.split(':').map(Number);
        const diff = (sh * 60 + sm) - (eh * 60 + em);
        return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 0;
    };
    const totalHorasForm = calcularHoras(horaForm.horaEntrada, horaForm.horaSalida);

    // ── registrar horas + actualizar horómetro ────────────────
    const registrarHoras = () => {
        if (!horaForm.maquinaNombre || !horaForm.horaEntrada || !horaForm.horaSalida)
            return toast('Completa máquina, hora entrada y hora salida', 'e');
        if (totalHorasForm <= 0)
            return toast('La hora de salida debe ser mayor que la de entrada', 'e');

        const maqSel = maquinas.find(m => m.nombre === horaForm.maquinaNombre);

        // Determinar nuevo horómetro
        const horoFin    = parseFloat(horaForm.horometroFin || 0);
        const horoInicio = parseFloat(horaForm.horometroInicio || 0);
        const nuevoHoro  = horoFin > 0
            ? horoFin                                              // si indicó fin exacto
            : (maqSel?.horometroActual || 0) + totalHorasForm;    // suma al actual

        createHora({
            operadorNombre:  operador.nombre,
            maquinaNombre:   horaForm.maquinaNombre,
            fecha:           horaForm.fecha,
            horas:           totalHorasForm,
            valorHora,
            horometroInicio: horoInicio,
            horometroFin:    horoFin || nuevoHoro,
        }).then(() => {
            if (valorHoraMaquina > 0) {
                return createIngreso({
                    maquinaNombre: horaForm.maquinaNombre,
                    tipoTrabajo:   'Horas',
                    cantidad:      totalHorasForm,
                    valorUnitario: valorHoraMaquina,
                    total:         totalHorasForm * valorHoraMaquina,
                    fecha:         horaForm.fecha,
                    descripcion:   `Horas ${operador.nombre} — ${horaForm.maquinaNombre}`,
                });
            }
        }).then(() => {
            cargar();
            setHoraForm({
                maquinaNombre: maqAsignada?.nombre || '',
                fecha: hoy(), horaEntrada: '', horaSalida: '',
                horometroInicio: '', horometroFin: '',
            });
            toast(`${totalHorasForm} horas registradas · Horómetro → ${nuevoHoro} hrs`);
        }).catch(console.error);
    };

    const [anticipoInput, setAnticipoInput] = useState('');
    const [mostrarAnticipoForm, setMostrarAnticipoForm] = useState(false);

    const registrarAnticipo = () => {
        const val = parseFloat(anticipoInput || 0);
        if (!val || val <= 0) return toast('Ingresa un monto válido', 'e');
        if (periodoActivo) {
            updatePeriodo(periodoActivo.id, { anticipos: (periodoActivo.anticipos || 0) + val });
            setPeriodos(getPeriodos(operador.id));
            toast(`Anticipo de ${fmt(val)} registrado`);
            setAnticipoInput('');
            setMostrarAnticipoForm(false);
        }
    };

    // ── descanso / liquidación ────────────────────────────────
    const registrarDescanso = () => {
        if (!periodoActivo) return toast('No hay período activo', 'e');
        const anticTot = (periodoActivo.anticipos || 0) + parseFloat(anticipoExtra || 0);
        const bruto    = horasPeriodo * valorHora;
        const neto     = bruto - anticTot;

        const ultimaHoraId = horas.reduce((max, h) => Math.max(max, h.id || 0), 0);

        createSalario({
            operadorNombre: operador.nombre,
            maquinaNombre:  maqAsignada?.nombre || '—',
            horasTrabajadas: horasPeriodo,
            valorHora,
            totalBruto:  bruto,
            descuentos:  anticTot,
            totalNeto:   neto,
            fecha:       hoy(),
            estado:      'Pendiente',
            nota:        notaDescanso || `Descanso ${periodoActivo.fechaInicio} → ${hoy()}`,
        }).then(() => createGasto({
            maquinaNombre: maqAsignada?.nombre || '—',
            descripcion:   `Salario ${operador.nombre} — ${horasPeriodo} hrs (${periodoActivo.fechaInicio} → ${hoy()})`,
            categoria:     'Salarios',
            monto:         neto,
            fecha:         hoy(),
        })).then(() => {
            updatePeriodo(periodoActivo.id, {
                estado: 'cerrado', fechaFin: hoy(),
                horasTotal: horasPeriodo, salarioBruto: bruto,
                anticipos: anticTot, salarioNeto: neto,
                nota: notaDescanso,
            });
            addPeriodo({ operadorId: operador.id, operadorNombre: operador.nombre, fechaInicio: hoy(), anticipos: 0, desdeHoraId: ultimaHoraId });
            setPeriodos(getPeriodos(operador.id));
            setMostrarDescanso(false);
            setAnticipoExtra('');
            setNotaDescanso('');
            toast('Descanso registrado — liquidación creada en Salarios');
        }).catch(console.error);
    };

    const TABS = ['📋 Resumen', '⏱️ Registrar Horas', '📅 Historial', '🛑 Períodos'];

    return (
        <>
        {ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>{operador.nombre}</h1><p>Detalle operativo del operador</p></div>
                <button className="bs" onClick={onVolver}>← Volver</button>
            </div>

            <div className="content"><div className="pad">

                {/* HEADER */}
                <div className="dh">
                    <div className="dhi">👷</div>
                    <div>
                        <h2>{operador.nombre}</h2>
                        <p>Cédula: {operador.cedula || '—'} · Tel: {operador.telefono || '—'} · {operador.email || '—'}</p>
                        {operador.observaciones && <p style={{ fontSize: '11px', color: '#6b7a8d', marginTop: '2px' }}>{operador.observaciones}</p>}
                    </div>
                    <div className="dhb">
                        {maqAsignada
                            ? <span className="b comp">🚜 {maqAsignada.nombre}</span>
                            : <span className="b falla">Sin máquina asignada</span>}
                        {valorHora > 0 && <span className="b hrs">{fmt(valorHora)}/hr</span>}
                        <span className="b" style={{ background: '#e8f5e9', color: '#27ae60', border: '1px solid #a8d5b5' }}>
                            ⏱️ {totalHorasAcumuladas.toLocaleString('es-CO')} hrs totales
                        </span>
                    </div>
                </div>

                {!maqAsignada && (
                    <div className="ale">
                        <span style={{ fontSize: '18px' }}>⚠️</span>
                        <div>
                            <p>Este operador no tiene máquina asignada</p>
                            <span className="ale-desc">Ve a Maquinaria → editar máquina → campo "Operador asignado"</span>
                        </div>
                    </div>
                )}

                {/* TABS */}
                <div className="tabs">
                    {TABS.map((t, i) => <button key={i} className={`tab ${tab === i ? 'on' : ''}`} onClick={() => setTab(i)}>{t}</button>)}
                </div>

                {/* ── TAB 0 RESUMEN ─────────────────────────────── */}
                {tab === 0 && (
                    <>
                        <div className="g4">
                            <div className="card blue">
                                <span className="ci">⏱️</span>
                                <div className="cl">Horas período</div>
                                <div className="cv">{horasPeriodo.toLocaleString('es-CO')}</div>
                                <div className="cs">desde {periodoActivo?.fechaInicio || '—'}</div>
                            </div>
                            <div className="card green">
                                <span className="ci">💰</span>
                                <div className="cl">Salario bruto</div>
                                <div className="cv">{fmt(salarioBruto)}</div>
                                <div className="cs">{horasPeriodo} hrs × {fmt(valorHora)}</div>
                            </div>
                            <div className="card red">
                                <span className="ci">💸</span>
                                <div className="cl">Anticipos</div>
                                <div className="cv">{fmt(anticipos)}</div>
                                <div className="cs">descontados del neto</div>
                            </div>
                            <div className="card gold">
                                <span className="ci">🏦</span>
                                <div className="cl">Salario neto</div>
                                <div className="cv" style={{ color: salarioNeto >= 0 ? '#27ae60' : '#e74c3c' }}>{fmt(salarioNeto)}</div>
                                <div className="cs">bruto − anticipos</div>
                            </div>
                        </div>

                        {periodoActivo && (
                            <div className="ale" style={{ background: '#fff8e7', borderColor: '#f5a623' }}>
                                <span style={{ fontSize: '18px' }}>📅</span>
                                <div>
                                    <p>Período activo desde <strong>{periodoActivo.fechaInicio}</strong></p>
                                    <span className="ale-desc">
                                        {horasPeriodo} hrs · {fmt(salarioBruto)} bruto · {fmt(anticipos)} anticipos → neto <strong>{fmt(salarioNeto)}</strong>
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* horómetro actual de la máquina */}
                        {maqAsignada && (
                            <div className="ale" style={{ background: '#e8f0fe', borderColor: '#2980b9' }}>
                                <span style={{ fontSize: '18px' }}>🔧</span>
                                <div>
                                    <p>Horómetro actual de {maqAsignada.nombre}</p>
                                    <span className="ale-desc">
                                        <strong>{(maqAsignada.horometroActual || 0).toLocaleString('es-CO')} hrs</strong> acumuladas en la máquina
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Acciones rápidas */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                            <button className="bp" onClick={() => setTab(1)}>⏱️ Registrar Horas</button>
                            <button className="bs" onClick={() => setMostrarAnticipoForm(!mostrarAnticipoForm)}>💸 Anticipo</button>
                            <button className="bs" style={{ background: '#c0392b', color: '#fff', border: 'none' }}
                                onClick={() => setMostrarDescanso(true)}>🛑 Registrar Descanso</button>
                        </div>
                        {mostrarAnticipoForm && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                                <input className="fi" type="number" style={{ margin: 0, maxWidth: '180px' }}
                                    placeholder="Monto anticipo ($)"
                                    value={anticipoInput}
                                    onChange={e => setAnticipoInput(e.target.value)} />
                                <button className="bp" onClick={registrarAnticipo}>Guardar</button>
                                <button className="bs" onClick={() => { setMostrarAnticipoForm(false); setAnticipoInput(''); }}>Cancelar</button>
                            </div>
                        )}

                        {/* Form descanso inline */}
                        {mostrarDescanso && (
                            <div className="fc" style={{ borderLeft: '4px solid #e74c3c' }}>
                                <h3>🛑 Registrar Descanso — Liquidación del período</h3>
                                <p className="fd">Se cierra el período actual, se crea la liquidación en Salarios y se abre un período nuevo.</p>
                                <div className="rsum">
                                    <h4>📋 Resumen del período</h4>
                                    <div className="rr"><span>Período</span><span>{periodoActivo?.fechaInicio} → {hoy()}</span></div>
                                    <div className="rr"><span>Horas trabajadas</span><span><strong>{horasPeriodo} hrs</strong></span></div>
                                    <div className="rr"><span>Valor/hora</span><span>{fmt(valorHora)}</span></div>
                                    <div className="rr"><span>Salario bruto</span><span className="pos">{fmt(salarioBruto)}</span></div>
                                    <div className="rr"><span>Anticipos acumulados</span><span className="neg">{fmt(anticipos)}</span></div>
                                </div>
                                <div className="fg2">
                                    <div>
                                        <label className="fl">Anticipo adicional al cierre ($)</label>
                                        <input className="fi" type="number" value={anticipoExtra}
                                            onChange={e => setAnticipoExtra(e.target.value)} placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="fl">Nota (opcional)</label>
                                        <input className="fi" value={notaDescanso}
                                            onChange={e => setNotaDescanso(e.target.value)} placeholder="Ej: Descanso semana santa" />
                                    </div>
                                </div>
                                <div className="rbox">
                                    <div>
                                        <div className="rl">Total a pagar</div>
                                        <div className="rv">{fmt(salarioBruto - anticipos - parseFloat(anticipoExtra || 0))}</div>
                                        <div className="rf">{fmt(salarioBruto)} − {fmt(anticipos + parseFloat(anticipoExtra || 0))} anticipos</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ color: '#6b7a8d', fontSize: '11px' }}>Se crea en</div>
                                        <div style={{ color: '#27ae60', fontSize: '12px', fontWeight: '700' }}>💼 Salarios</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="bp" style={{ background: '#c0392b' }} onClick={registrarDescanso}>
                                        🛑 Confirmar Descanso
                                    </button>
                                    <button className="bs" onClick={() => setMostrarDescanso(false)}>Cancelar</button>
                                </div>
                            </div>
                        )}

                        {/* Últimas horas */}
                        <div className="tbl">
                            <div className="th"><strong>Últimas horas registradas</strong></div>
                            <div className="tr hdr"><span>Fecha</span><span className="w2">Máquina</span><span>Horas</span><span>Horómetro fin</span><span>Valor ganado</span></div>
                            {horas.length === 0 && <p className="vacio">Sin horas registradas — usa "Registrar Horas" arriba</p>}
                            {horas.slice(0, 8).map(h => (
                                <div className="tr" key={h.id}>
                                    <span>{h.fecha}</span>
                                    <span className="w2">{h.maquinaNombre}</span>
                                    <span><strong>{getHrs(h)}</strong> hrs</span>
                                    <span>{h.horometroFin || '—'}</span>
                                    <span className="pos">{fmt(getHrs(h) * (h.valorHora || valorHora))}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* ── TAB 1 REGISTRAR HORAS ─────────────────────── */}
                {tab === 1 && (
                    <div className="fc">
                        <h3>⏱️ Registrar Horas Trabajadas</h3>
                        <p className="fd">Las horas se acumulan en el período activo y actualizan el horómetro de la máquina</p>
                        <div className="fg2">
                            <div>
                                <label className="fl">Máquina *</label>
                                <select className="fsel" value={horaForm.maquinaNombre}
                                    onChange={e => {
                                        const m = maquinas.find(x => x.nombre === e.target.value);
                                        setHoraForm({ ...horaForm, maquinaNombre: e.target.value, horometroInicio: m?.horometroActual || '' });
                                    }}>
                                    <option value="">Selecciona...</option>
                                    {maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="fl">Fecha</label>
                                <input className="fi" type="date" value={horaForm.fecha}
                                    onChange={e => setHoraForm({ ...horaForm, fecha: e.target.value })} />
                            </div>
                        </div>
                        <div className="fg2">
                            <div>
                                <label className="fl">Hora entrada *</label>
                                <input className="fi" type="time" value={horaForm.horaEntrada}
                                    onChange={e => setHoraForm({ ...horaForm, horaEntrada: e.target.value })} />
                            </div>
                            <div>
                                <label className="fl">Hora salida *</label>
                                <input className="fi" type="time" value={horaForm.horaSalida}
                                    onChange={e => setHoraForm({ ...horaForm, horaSalida: e.target.value })} />
                            </div>
                        </div>
                        <div className="fg2">
                            <div>
                                <label className="fl">Horómetro inicio (auto)</label>
                                <input className="fi" type="number" value={horaForm.horometroInicio}
                                    onChange={e => setHoraForm({ ...horaForm, horometroInicio: e.target.value })}
                                    placeholder="Se llena automático" />
                            </div>
                            <div>
                                <label className="fl">Horómetro fin (opcional)</label>
                                <input className="fi" type="number" value={horaForm.horometroFin}
                                    onChange={e => setHoraForm({ ...horaForm, horometroFin: e.target.value })}
                                    placeholder="Si lo dejas vacío se suma automático" />
                            </div>
                        </div>

                        {horaForm.horaEntrada && horaForm.horaSalida && totalHorasForm > 0 && (
                            <div className="rsum">
                                <h4>📋 Resumen antes de guardar</h4>
                                <div className="rr"><span>Horas calculadas</span><span><strong>{totalHorasForm} hrs</strong></span></div>
                                <div className="rr"><span>Valor/hora</span><span>{fmt(valorHora)}</span></div>
                                <div className="rr"><span>Valor ganado</span><span className="pos"><strong>{fmt(totalHorasForm * valorHora)}</strong></span></div>
                                {horaForm.maquinaNombre && (() => {
                                    const m = maquinas.find(x => x.nombre === horaForm.maquinaNombre);
                                    const horoFin = parseFloat(horaForm.horometroFin || 0);
                                    const nuevo = horoFin > 0 ? horoFin : (m?.horometroActual || 0) + totalHorasForm;
                                    return <div className="rr">
                                        <span>Horómetro {horaForm.maquinaNombre}</span>
                                        <span style={{ color: '#2980b9' }}>{m?.horometroActual || 0} → <strong>{nuevo} hrs</strong></span>
                                    </div>;
                                })()}
                                <div className="rr"><span>Horas totales período (después)</span><span><strong>{(horasPeriodo + totalHorasForm).toLocaleString('es-CO')} hrs</strong></span></div>
                                <div className="rr"><span>Salario bruto (después)</span><span className="pos"><strong>{fmt((horasPeriodo + totalHorasForm) * valorHora)}</strong></span></div>
                            </div>
                        )}

                        <button className="bp" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                            onClick={registrarHoras}>
                            ✅ Guardar Horas
                        </button>
                    </div>
                )}

                {/* ── TAB 2 HISTORIAL ───────────────────────────── */}
                {tab === 2 && (
                    <div className="tbl">
                        <div className="th">
                            <strong>Historial completo de horas — {operador.nombre}</strong>
                            <span style={{ fontSize: '11px', color: '#6b7a8d' }}>Total: {totalHorasAcumuladas} hrs · {fmt(totalHorasAcumuladas * valorHora)}</span>
                        </div>
                        <div className="tr hdr">
                            <span>Fecha</span><span className="w2">Máquina</span>
                            <span>Horas</span><span>$/Hora</span><span>Valor</span><span>Acc.</span>
                        </div>
                        {horas.length === 0 && <p className="vacio">Sin horas registradas</p>}
                        {horas.map(h => (
                            <div className="tr" key={h.id}>
                                <span>{h.fecha}</span>
                                <span className="w2">{h.maquinaNombre}</span>
                                <span><strong>{getHrs(h)}</strong> hrs</span>
                                <span>{fmt(h.valorHora || valorHora)}</span>
                                <span className="pos">{fmt(getHrs(h) * (h.valorHora || valorHora))}</span>
                                <span>
                                    <button className="icon-btn"
                                        onClick={async () => { if (await confirm('¿Eliminar este registro de horas?')) deleteHora(h.id).then(cargar).catch(console.error); }}>
                                        🗑️
                                    </button>
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── TAB 3 PERÍODOS ────────────────────────────── */}
                {tab === 3 && (
                    <>
                        <div className="ale" style={{ background: '#e8f5e9', borderColor: '#27ae60' }}>
                            <span style={{ fontSize: '18px' }}>ℹ️</span>
                            <div>
                                <p>Un período se cierra al registrar un descanso</p>
                                <span className="ale-desc">Cada período acumula horas, salario y anticipos de forma independiente</span>
                            </div>
                        </div>

                        {periodos.slice().reverse().map((p, i) => (
                            <div key={p.id} style={{
                                background: p.estado === 'activo' ? '#fff8e7' : '#f8f9fa',
                                border: `1px solid ${p.estado === 'activo' ? '#f5a623' : '#dee2e6'}`,
                                borderRadius: '10px', padding: '16px', marginBottom: '12px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <strong style={{ fontSize: '13px' }}>
                                        {p.estado === 'activo' ? '🟢 Período activo' : `📅 Período ${periodos.length - i}`}
                                    </strong>
                                    <span className={`b ${p.estado === 'activo' ? 'ok' : 'comp'}`}>
                                        {p.estado === 'activo' ? 'En curso' : 'Cerrado'}
                                    </span>
                                </div>
                                <div className="rr"><span>Inicio</span><span>{p.fechaInicio}</span></div>
                                {p.fechaFin    && <div className="rr"><span>Fin (descanso)</span><span>{p.fechaFin}</span></div>}
                                {p.estado === 'activo' && (
                                    <div className="rr"><span>Horas acumuladas</span><span><strong>{horasPeriodo} hrs</strong></span></div>
                                )}
                                {p.horasTotal  != null && p.estado !== 'activo' && <div className="rr"><span>Horas trabajadas</span><span>{p.horasTotal} hrs</span></div>}
                                {p.salarioBruto != null && <div className="rr"><span>Salario bruto</span><span className="pos">{fmt(p.estado === 'activo' ? salarioBruto : p.salarioBruto)}</span></div>}
                                {p.anticipos > 0 && <div className="rr"><span>Anticipos</span><span className="neg">{fmt(p.estado === 'activo' ? anticipos : p.anticipos)}</span></div>}
                                {p.salarioNeto != null && <div className="rr"><span>Salario neto</span><span className="pos" style={{ fontWeight: '700' }}>{fmt(p.estado === 'activo' ? salarioNeto : p.salarioNeto)}</span></div>}
                                {p.nota && <div className="rr"><span>Nota</span><span style={{ color: '#6b7a8d' }}>{p.nota}</span></div>}
                                {p.estado === 'activo' && (
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                                        <button className="bs" style={{ fontSize: '11px' }} onClick={() => { setMostrarAnticipoForm(true); setTab(0); }}>+ Anticipo</button>
                                        <button className="bs" style={{ fontSize: '11px', background: '#c0392b', color: '#fff', border: 'none' }}
                                            onClick={() => { setMostrarDescanso(true); setTab(0); }}>
                                            🛑 Descanso
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {periodos.length === 0 && <p className="vacio">Sin períodos registrados</p>}
                    </>
                )}

            </div></div>
        </div>
        </>
    );
}

export default DetalleOperador;
