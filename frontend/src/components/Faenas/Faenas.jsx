import { useState, useEffect } from 'react';
import {
    getFaenas, createFaena, updateFaena, cerrarFaena, reabrirFaena, deleteFaena,
    getMaquinas,
    getIngresos, getGastos, getSalarios, getMantenimientos, getCombustible,
    createIngreso, createGasto,
} from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import {
    Briefcase, Plus, Check, Trash2, StopCircle, RotateCcw, ChevronDown, ChevronUp,
    BarChart2, Calendar, Tractor, Pencil,
    Clock, Info,
} from 'lucide-react';

import { fmtFecha } from '../../utils/fmtFecha';
import './Faenas.css';

const fmt = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().split('T')[0];
const parseLocal = (str) => { const [y, m, d] = String(str).split('-').map(Number); return new Date(y, m - 1, d); };
const diasEntre = (a, b) => Math.max(1, Math.round((b - a) / 86400000));
const folioDe = (f) => `OB-${(f.fechaInicio || '').slice(0, 4) || new Date().getFullYear()}-${String(f.id).padStart(3, '0')}`;


const FORM_VACIO = { maquinaNombre: '', nombreObra: '', cliente: '', fechaInicio: hoy(), nota: '' };

function Faenas() {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();

    const [faenas, setFaenas]         = useState([]);
    const [maquinas, setMaquinas]     = useState([]);
    const [ingresosAll, setIngresosAll] = useState([]);
    const [gastosAll, setGastosAll]     = useState([]);
    const [salariosAll, setSalariosAll] = useState([]);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [editandoId, setEditandoId]   = useState(null);
    const [form, setForm]             = useState(FORM_VACIO);
    const [expandida, setExpandida]   = useState(null);
    const [detalle, setDetalle]       = useState({});
    const [cargandoDet, setCargandoDet] = useState(false);

    useEffect(() => {
        cargar();
        getMaquinas().then(r => setMaquinas(r.data)).catch(console.error);
        getIngresos().then(r => setIngresosAll(r.data || [])).catch(() => {});
        getGastos().then(r => setGastosAll(r.data || [])).catch(() => {});
        getSalarios().then(r => setSalariosAll(r.data || [])).catch(() => {});
    }, []);

    const cargar = () =>
        getFaenas().then(r => setFaenas(r.data || [])).catch(console.error);

    // Ingresos, gastos y nómina en vivo de un periodo (activo o cerrado), calculados de forma
    // uniforme para toda la lista — la Utilidad ya descuenta la nómina de los operadores,
    // no solo los gastos generales (antes solo se restaban los gastos). Cada salario genera
    // también un Gasto categoría "Salario" (para el P&L de Finanzas), así que se excluye de
    // Gastos aquí para no restar la nómina dos veces.
    const aggFaena = (f) => {
        const ing = ingresosAll.filter(i => String(i.faenaId) === String(f.id)).reduce((a, i) => a + (Number(i.total) || 0), 0);
        const gas = gastosAll.filter(g => String(g.faenaId) === String(f.id) && g.categoria !== 'Salario').reduce((a, g) => a + (Number(g.monto) || 0), 0);
        const sal = salariosAll.filter(s => String(s.faenaId) === String(f.id)).reduce((a, s) => a + (Number(s.totalNeto) || 0), 0);
        const util = ing - gas - sal;
        const margen = ing > 0 ? Math.round((util / ing) * 100) : 0;
        let dias = null;
        if (f.fechaInicio) {
            const fin = f.estado === 'activa' ? new Date() : (f.fechaFin ? parseLocal(f.fechaFin) : null);
            if (fin) dias = diasEntre(parseLocal(f.fechaInicio), fin);
        }
        return { ing, gas, sal, util, margen, dias };
    };

    const abrirNueva = () => {
        setEditandoId(null);
        setForm(FORM_VACIO);
        setMostrarForm(true);
    };

    const abrirEditar = (f) => {
        setEditandoId(f.id);
        setForm({ nombreObra: f.nombreObra || '', cliente: f.cliente || '', nota: f.nota || '' });
        setMostrarForm(true);
    };

    const guardar = async () => {
        if (!editandoId && !form.maquinaNombre) return toast('Selecciona una máquina', 'e');
        if (!form.nombreObra?.trim()) return toast('Escribe el nombre de la obra', 'e');

        try {
            if (editandoId) {
                await updateFaena(editandoId, form);
                toast('Periodo actualizado');
            } else {
                await createFaena(form);
                toast('Periodo abierto');
            }
        } catch (e) {
            return toast(e.response?.data?.error || 'No se pudo guardar el periodo', 'e');
        }
        setMostrarForm(false);
        setEditandoId(null);
        cargar();
    };

    const handleCerrar = async (f) => {
        if (!await confirm(`¿Cerrar el periodo "${f.nombreObra}"?\nSe calculará el resumen financiero y quedará archivado.`)) return;
        await cerrarFaena(f.id).catch(console.error);
        toast('Periodo cerrado — resumen guardado');
        cargar();
    };

    const handleReabrir = async (f) => {
        if (!await confirm(`¿Reabrir el periodo "${f.nombreObra}"?\nVolverá a "En campo" y podrás registrar más ingresos, gastos o mantenimientos. El resumen se recalculará cuando lo cierres de nuevo.`)) return;
        try {
            await reabrirFaena(f.id);
            toast('Periodo reabierto');
            cargar();
        } catch (e) {
            toast(e.response?.data?.error || 'No se pudo reabrir el periodo', 'e');
        }
    };

    const handleEliminar = async (f) => {
        if (!await confirm(`¿Eliminar el periodo "${f.nombreObra}"? Esta acción no se puede deshacer.`)) return;
        await deleteFaena(f.id).catch(console.error);
        toast('Periodo eliminado');
        cargar();
    };

    const cargarDetalle = async (f) => {
        try {
            const [ing, gas, sal, man, com] = await Promise.all([
                getIngresos(), getGastos(), getSalarios(), getMantenimientos(), getCombustible(),
            ]);
            const byFaena = (arr) => (arr.data || []).filter(x => String(x.faenaId) === String(f.id));
            setIngresosAll(ing.data || []);
            setGastosAll(gas.data || []);
            setSalariosAll(sal.data || []);
            setDetalle(prev => ({
                ...prev,
                [f.id]: {
                    ingresos: byFaena(ing),
                    gastos: byFaena(gas),
                    salarios: byFaena(sal),
                    mantenimientos: byFaena(man),
                    combustible: byFaena(com),
                },
            }));
        } catch (e) { console.error(e); }
    };

    const toggleDetalle = async (f) => {
        if (expandida === f.id) { setExpandida(null); return; }
        setExpandida(f.id);
        if (detalle[f.id]) return;
        setCargandoDet(true);
        await cargarDetalle(f);
        setCargandoDet(false);
    };

    // Tras registrar un ingreso/gasto olvidado, refresca la lista y el detalle del periodo.
    // El backend ya recalcula el resumen guardado automáticamente si el periodo está
    // cerrado (ver FaenaService.recalcularTotalesSiCerrada), sin volver a cerrar la faena.
    const refrescarFaena = async (f) => {
        await Promise.all([cargar(), cargarDetalle(f)]);
    };

    const activas  = faenas.filter(f => f.estado === 'activa');
    const cerradas = faenas.filter(f => f.estado === 'cerrada');

    const nomsMaquinas = maquinas.map(m => m.nombre);

    const aggCerradas = cerradas.map(f => aggFaena(f));
    const utilAcumulada = aggCerradas.reduce((a, x) => a + x.util, 0);
    const utilPromedio = cerradas.length > 0 ? Math.round(utilAcumulada / cerradas.length) : 0;
    const diasCerradas = aggCerradas.map(x => x.dias).filter(d => d != null);
    const promedioDias = diasCerradas.length > 0 ? Math.round(diasCerradas.reduce((a, d) => a + d, 0) / diasCerradas.length) : null;

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div>
                    <h1>Periodos</h1>
                    <p>Periodos de trabajo por máquina — ingresos, gastos y rendición de cuentas por obra</p>
                </div>
                <div className="tb-r">
                    <button className="bp" onClick={abrirNueva}>
                        <Plus size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Nuevo Periodo
                    </button>
                </div>
            </div>

            <div className="content"><div className="pad">

                {/* RESUMEN */}
                <div className="pe-hero">
                    <div className="pe-kpi info">
                        <div className="pe-kpi-top"><span className="pe-kpi-label">Periodos activos</span><span className="pe-kpi-ico"><Briefcase size={14} /></span></div>
                        <div className="pe-kpi-val">{activas.length}</div>
                        <div className="pe-kpi-sub">máquinas en campo</div>
                    </div>
                    <div className="pe-kpi good">
                        <div className="pe-kpi-top"><span className="pe-kpi-label">Utilidad acumulada</span><span className="pe-kpi-ico"><Check size={14} /></span></div>
                        <div className="pe-kpi-val pe-num">{fmt(utilAcumulada)}</div>
                        <div className="pe-kpi-sub">{cerradas.length} periodos cerrados</div>
                    </div>
                    <div className="pe-kpi profit">
                        <div className="pe-kpi-top"><span className="pe-kpi-label">Utilidad promedio</span><span className="pe-kpi-ico"><BarChart2 size={14} /></span></div>
                        <div className="pe-kpi-val pe-num">{fmt(utilPromedio)}</div>
                        <div className="pe-kpi-sub">por periodo cerrado</div>
                    </div>
                    <div className="pe-kpi info">
                        <div className="pe-kpi-top"><span className="pe-kpi-label">Duración promedio</span><span className="pe-kpi-ico"><Calendar size={14} /></span></div>
                        <div className="pe-kpi-val">{promedioDias != null ? <>{promedioDias} <span style={{ fontSize: '15px', fontWeight: 600 }}>días</span></> : '—'}</div>
                        <div className="pe-kpi-sub">de apertura a cierre</div>
                    </div>
                </div>

                <div className="pe-note">
                    <Info size={16} />
                    <p>La <strong>Utilidad</strong> de cada periodo ya descuenta la nómina de los operadores (Ingresos − Gastos − Nómina), no solo los gastos generales.</p>
                </div>

                {/* FORM */}
                {mostrarForm && (
                    <div className="fc">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Briefcase size={18} /> {editandoId ? 'Editar periodo' : 'Abrir nuevo periodo'}
                        </h3>
                        {!editandoId && (
                            <div className="fg2">
                                <div>
                                    <label className="fl">Máquina *</label>
                                    <select className="fsel" value={form.maquinaNombre}
                                        onChange={e => setForm({ ...form, maquinaNombre: e.target.value })}>
                                        <option value="">Selecciona una máquina...</option>
                                        {nomsMaquinas.map(n => <option key={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="fl">Fecha inicio</label>
                                    <input className="fi" type="date" value={form.fechaInicio}
                                        onChange={e => setForm({ ...form, fechaInicio: e.target.value })} />
                                </div>
                            </div>
                        )}
                        <div className="fg2">
                            <div>
                                <label className="fl">Nombre de la obra *</label>
                                <input className="fi" value={form.nombreObra}
                                    onChange={e => setForm({ ...form, nombreObra: e.target.value })}
                                    placeholder="Ej: Carretera Vía Caucasia" />
                            </div>
                            <div>
                                <label className="fl">Cliente</label>
                                <input className="fi" value={form.cliente}
                                    onChange={e => setForm({ ...form, cliente: e.target.value })}
                                    placeholder="Ej: Municipio de..." />
                            </div>
                        </div>
                        <div>
                            <label className="fl">Nota (opcional)</label>
                            <input className="fi" value={form.nota}
                                onChange={e => setForm({ ...form, nota: e.target.value })}
                                placeholder="Observaciones adicionales" />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={guardar}>
                                <Check size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                {editandoId ? 'Actualizar' : 'Abrir periodo'}
                            </button>
                            <button className="bs" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* FAENAS ACTIVAS */}
                {activas.length > 0 && (
                    <>
                        <div className="pe-sec-head on">
                            <span className="pe-sec-dot"></span>
                            EN CAMPO ({activas.length})
                        </div>
                        {activas.map(f => (
                            <TarjetaFaena key={f.id} f={f} agg={aggFaena(f)} promedioDias={promedioDias}
                                expandida={expandida} detalle={detalle} cargandoDet={cargandoDet}
                                onToggle={toggleDetalle} onEditar={abrirEditar} onRefrescar={refrescarFaena}
                                onCerrar={handleCerrar} onEliminar={handleEliminar} />
                        ))}
                    </>
                )}

                {/* FAENAS CERRADAS */}
                {cerradas.length > 0 && (
                    <>
                        <div className="pe-sec-head off">
                            <Check size={12} /> ARCHIVADAS ({cerradas.length})
                        </div>
                        {cerradas.map(f => (
                            <TarjetaFaena key={f.id} f={f} agg={aggFaena(f)} promedioDias={promedioDias}
                                expandida={expandida} detalle={detalle} cargandoDet={cargandoDet}
                                onToggle={toggleDetalle} onEditar={abrirEditar} onRefrescar={refrescarFaena}
                                onCerrar={null} onReabrir={handleReabrir} onEliminar={handleEliminar} />
                        ))}
                    </>
                )}

                {faenas.length === 0 && (
                    <p className="vacio">Sin periodos registrados — abre uno cuando la máquina salga a trabajar</p>
                )}

            </div></div>
        </div>
        </>
    );
}

function TarjetaFaena({ f, agg, promedioDias, expandida, detalle, cargandoDet, onToggle, onEditar, onCerrar, onReabrir, onEliminar, onRefrescar }) {
    const toast = useToast();
    const abierta = expandida === f.id;
    const det = detalle[f.id];
    const activa = f.estado === 'activa';

    const [formRapido, setFormRapido] = useState(null); // null | 'ingreso' | 'gasto'
    const [datoRapido, setDatoRapido] = useState({ fecha: hoy(), descripcion: '', monto: '' });
    const [guardandoRapido, setGuardandoRapido] = useState(false);

    const abrirFormRapido = (tipo) => {
        setFormRapido(tipo);
        setDatoRapido({ fecha: hoy(), descripcion: '', monto: '' });
    };

    const guardarRapido = async () => {
        if (!datoRapido.descripcion.trim() || !datoRapido.monto) {
            return toast('Completa descripción y monto', 'e');
        }
        setGuardandoRapido(true);
        try {
            if (formRapido === 'ingreso') {
                await createIngreso({
                    maquinaNombre: f.maquinaNombre, faenaId: f.id,
                    tipoTrabajo: 'Otro', cantidad: 1, valorUnitario: parseFloat(datoRapido.monto),
                    total: parseFloat(datoRapido.monto),
                    descripcion: datoRapido.descripcion, fecha: datoRapido.fecha,
                });
            } else {
                await createGasto({
                    maquinaNombre: f.maquinaNombre, faenaId: f.id,
                    categoria: 'Otro', monto: parseFloat(datoRapido.monto),
                    descripcion: datoRapido.descripcion, fecha: datoRapido.fecha,
                });
            }
            toast(formRapido === 'ingreso' ? 'Ingreso registrado' : 'Gasto registrado');
            setFormRapido(null);
            await onRefrescar(f);
        } catch (e) {
            console.error(e);
            toast('Error al guardar — intenta de nuevo', 'e');
        }
        setGuardandoRapido(false);
    };

    // "Salario" es un gasto que el backend genera automáticamente por cada registro de
    // Salarios (para que aparezca en el P&L de Finanzas) — se excluye de Gastos aquí para
    // no restar la nómina dos veces, ya que se resta aparte como Nómina.
    const gastosSinNomina = det ? det.gastos.filter(x => x.categoria !== 'Salario') : [];
    const totalIngDet = det ? det.ingresos.reduce((a, x) => a + (x.total || 0), 0) : 0;
    const totalGasDet = gastosSinNomina.reduce((a, x) => a + (x.monto || 0), 0);
    const totalSalDet = det ? det.salarios.reduce((a, x) => a + (x.totalNeto || 0), 0) : 0;
    const totalHorasDet = det ? det.ingresos.filter(x => x.tipoTrabajo === 'Horas').reduce((a, x) => a + (Number(x.cantidad) || 0), 0) : 0;
    const utilDet      = totalIngDet - totalGasDet - totalSalDet;
    const catEntries = Object.entries(gastosSinNomina.reduce((acc, g) => { const k = g.categoria || 'Otros'; acc[k] = (acc[k] || 0) + (Number(g.monto) || 0); return acc; }, {}))
        .sort((a, b) => b[1] - a[1]);

    const sobrePromedio = activa && promedioDias != null && agg.dias != null && agg.dias > promedioDias;

    return (
        <div className={`pe-row ${activa ? 'working' : ''}`}>
            {/* Cabecera */}
            <div className="pe-row-head" onClick={() => onToggle(f)}>
                <div className="pe-row-id">
                    <div className="pe-folio">{folioDe(f)}</div>
                    <div className="pe-obra">{f.nombreObra}</div>
                    <div className="pe-meta">
                        <span className={`pe-pill ${activa ? 'field' : 'closed'}`}>{activa ? 'En campo' : 'Cerrada'}</span>
                        <span><Tractor size={11} /> {f.maquinaNombre}</span>
                        {f.cliente && <span>{f.cliente}</span>}
                        <span><Calendar size={11} /> {fmtFecha(f.fechaInicio)}{f.fechaFin ? ` → ${fmtFecha(f.fechaFin)}` : ''}</span>
                    </div>
                </div>

                <div className="pe-strip">
                    <div className="pe-mm"><div className="pe-mm-l">Ingresos</div><div className="pe-mm-v g pe-num">{fmt(agg.ing)}</div></div>
                    <span className="pe-arrow">−</span>
                    <div className="pe-mm"><div className="pe-mm-l">Gastos</div><div className="pe-mm-v b pe-num">{fmt(agg.gas)}</div></div>
                    <span className="pe-arrow">−</span>
                    <div className="pe-mm"><div className="pe-mm-l">Nómina</div><div className="pe-mm-v i pe-num">{fmt(agg.sal)}</div></div>
                    <div className="pe-util">
                        <div className="pe-util-l">Utilidad real</div>
                        <div className="pe-util-v pe-num" style={{ color: agg.util >= 0 ? '#1c8a4b' : '#c0392b' }}>{fmt(agg.util)}</div>
                        <div className="pe-margin-track"><div className="pe-margin-fill" style={{ width: `${Math.min(Math.max(agg.margen, 0), 100)}%`, background: agg.util >= 0 ? '#27ae60' : '#e74c3c' }} /></div>
                        <div className="pe-margin-pct" style={{ color: agg.util >= 0 ? '#1c8a4b' : '#c0392b' }}>{agg.margen}% margen</div>
                    </div>
                </div>

                {/* Acciones */}
                <div className="pe-actions" onClick={e => e.stopPropagation()}>
                    {onEditar && (
                        <button className="pe-iconbtn" title="Editar" onClick={() => onEditar(f)}>
                            <Pencil size={14} />
                        </button>
                    )}
                    {activa && onCerrar && (
                        <button className="pe-iconbtn" title="Cerrar periodo / Rendir cuentas"
                            style={{ color: '#c0392b' }}
                            onClick={() => onCerrar(f)}>
                            <StopCircle size={14} />
                        </button>
                    )}
                    {!activa && onReabrir && (
                        <button className="pe-iconbtn" title="Reabrir periodo"
                            style={{ color: '#2980b9' }}
                            onClick={() => onReabrir(f)}>
                            <RotateCcw size={14} />
                        </button>
                    )}
                    <button className="pe-iconbtn" title="Eliminar" onClick={() => onEliminar(f)}>
                        <Trash2 size={14} />
                    </button>
                    <button className="pe-iconbtn" onClick={() => onToggle(f)}>
                        {abierta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {activa && promedioDias != null && agg.dias != null && (
                <div className="pe-progress-line">
                    <div className="pe-progress-track"><div className="pe-progress-fill" style={{ width: `${Math.min((agg.dias / promedioDias) * 100, 100)}%`, background: sobrePromedio ? '#c9790f' : '#93a2b3' }} /></div>
                    <div className={`pe-progress-note ${sobrePromedio ? 'over' : ''}`}>
                        {sobrePromedio ? '⚠ ' : ''}{agg.dias} días en campo — {sobrePromedio ? 'por encima del' : 'dentro del'} promedio histórico de {promedioDias} días para esta máquina
                    </div>
                </div>
            )}

            {/* Detalle expandido */}
            {abierta && (
                <div className="pe-panel">
                    {!det && cargandoDet && <p style={{ fontSize: '12px', color: '#6b7a8d' }}>Cargando registros...</p>}
                    {det && (
                        <>
                            {/* Resumen financiero calculado en vivo a partir de los registros del periodo — solo
                                tarjetas, el detalle línea por línea de Ingresos/Gastos/etc. vive en Finanzas */}
                            <div className="pe-breakdown">
                                <div className="pe-bcard good">
                                    <div className="pe-bcard-l">↑ Ingresos</div>
                                    <div className="pe-bcard-v" style={{ color: '#1c8a4b' }}>{fmt(totalIngDet)}</div>
                                </div>
                                <div className="pe-bcard info">
                                    <div className="pe-bcard-l"><Clock size={12} style={{ verticalAlign: 'middle' }} /> Horas</div>
                                    <div className="pe-bcard-v" style={{ color: '#1f6491' }}>{totalHorasDet.toLocaleString('es-CO')} hrs</div>
                                </div>
                                <div className="pe-bcard bad">
                                    <div className="pe-bcard-l">↓ Gastos</div>
                                    <div className="pe-bcard-v" style={{ color: '#c0392b' }}>{fmt(totalGasDet)}</div>
                                    {catEntries.length > 0 && (
                                        <div style={{ fontSize: '10.5px', color: '#93a2b3', marginTop: '4px' }}>
                                            {catEntries.slice(0, 3).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}
                                        </div>
                                    )}
                                </div>
                                <div className="pe-bcard info">
                                    <div className="pe-bcard-l">👤 Nómina</div>
                                    <div className="pe-bcard-v" style={{ color: '#1f6491' }}>{fmt(totalSalDet)}</div>
                                </div>
                                <div className="pe-bcard gold">
                                    <div className="pe-bcard-l">◆ Utilidad real</div>
                                    <div className="pe-bcard-v" style={{ color: utilDet >= 0 ? '#1c8a4b' : '#c0392b' }}>{fmt(utilDet)}</div>
                                </div>
                            </div>

                            {/* Registrar ingreso/gasto olvidado — funciona con el periodo activo o cerrado */}
                            <div style={{ marginBottom: '14px' }}>
                                {!formRapido && (
                                    <div className="pe-quickrow">
                                        <button className="bs" style={{ fontSize: '12px' }} onClick={() => abrirFormRapido('ingreso')}>
                                            <Plus size={12} style={{ verticalAlign: 'middle' }} /> Ingreso olvidado
                                        </button>
                                        <button className="bs" style={{ fontSize: '12px' }} onClick={() => abrirFormRapido('gasto')}>
                                            <Plus size={12} style={{ verticalAlign: 'middle' }} /> Gasto olvidado
                                        </button>
                                    </div>
                                )}
                                {formRapido && (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', background: '#f8f9fa', padding: '10px', borderRadius: '8px' }}>
                                        <div>
                                            <label className="fl">Fecha</label>
                                            <input className="fi" type="date" value={datoRapido.fecha}
                                                onChange={e => setDatoRapido({ ...datoRapido, fecha: e.target.value })} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: '160px' }}>
                                            <label className="fl">Descripción</label>
                                            <input className="fi" value={datoRapido.descripcion}
                                                placeholder={formRapido === 'ingreso' ? 'Ej: Trabajo del 12' : 'Ej: Repuesto'}
                                                onChange={e => setDatoRapido({ ...datoRapido, descripcion: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="fl">Monto</label>
                                            <input className="fi" type="number" value={datoRapido.monto}
                                                onChange={e => setDatoRapido({ ...datoRapido, monto: e.target.value })} />
                                        </div>
                                        <button className="bp" style={{ fontSize: '12px' }} disabled={guardandoRapido} onClick={guardarRapido}>
                                            <Check size={12} style={{ verticalAlign: 'middle' }} /> Guardar
                                        </button>
                                        <button className="bs" style={{ fontSize: '12px' }} onClick={() => setFormRapido(null)}>Cancelar</button>
                                    </div>
                                )}
                            </div>

                            {det.ingresos.length === 0 && gastosSinNomina.length === 0 && det.salarios.length === 0
                                && det.mantenimientos.length === 0 && det.combustible.length === 0 && (
                                <p className="vacio">Sin registros asociados a este periodo aún</p>
                            )}

                            {f.nota && (
                                <p style={{ fontSize: '12px', color: '#6b7a8d', marginTop: '8px' }}>
                                    Nota: {f.nota}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}


export default Faenas;
