import { useState, useEffect } from 'react';
import {
    getFaenas, createFaena, updateFaena, cerrarFaena, deleteFaena,
    getMaquinas,
    getIngresos, getGastos, getSalarios, getMantenimientos, getCombustible,
} from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import {
    Briefcase, Plus, Check, Trash2, StopCircle, ChevronDown, ChevronUp,
    TrendingUp, TrendingDown, BarChart2, Calendar, Tractor, Pencil, X,
    Clock, Wrench, Fuel,
} from 'lucide-react';

import { fmtFecha } from '../../utils/fmtFecha';

const fmt = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().split('T')[0];

const FORM_VACIO = { maquinaNombre: '', nombreObra: '', cliente: '', fechaInicio: hoy(), nota: '' };

function Faenas() {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();

    const [faenas, setFaenas]         = useState([]);
    const [maquinas, setMaquinas]     = useState([]);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [editandoId, setEditandoId]   = useState(null);
    const [form, setForm]             = useState(FORM_VACIO);
    const [expandida, setExpandida]   = useState(null);
    const [detalle, setDetalle]       = useState({});
    const [cargandoDet, setCargandoDet] = useState(false);

    useEffect(() => {
        cargar();
        getMaquinas().then(r => setMaquinas(r.data)).catch(console.error);
    }, []);

    const cargar = () =>
        getFaenas().then(r => setFaenas(r.data || [])).catch(console.error);

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

        if (editandoId) {
            await updateFaena(editandoId, form).catch(console.error);
            toast('Periodo actualizado');
        } else {
            await createFaena(form).catch(console.error);
            toast('Periodo abierto');
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

    const handleEliminar = async (f) => {
        if (!await confirm(`¿Eliminar el periodo "${f.nombreObra}"? Esta acción no se puede deshacer.`)) return;
        await deleteFaena(f.id).catch(console.error);
        toast('Periodo eliminado');
        cargar();
    };

    const toggleDetalle = async (f) => {
        if (expandida === f.id) { setExpandida(null); return; }
        setExpandida(f.id);
        if (detalle[f.id]) return;
        setCargandoDet(true);
        try {
            const [ing, gas, sal, man, com] = await Promise.all([
                getIngresos(), getGastos(), getSalarios(), getMantenimientos(), getCombustible(),
            ]);
            const byFaena = (arr) => (arr.data || []).filter(x => String(x.faenaId) === String(f.id));
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
        setCargandoDet(false);
    };

    const activas  = faenas.filter(f => f.estado === 'activa');
    const cerradas = faenas.filter(f => f.estado === 'cerrada');

    const nomsMaquinas = maquinas.map(m => m.nombre);

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
                <div className="g3">
                    <div className="card blue">
                        <span className="ci"><Briefcase size={22} /></span>
                        <div className="cl">Periodos activos</div>
                        <div className="cv">{activas.length}</div>
                        <div className="cs">máquinas en campo</div>
                    </div>
                    <div className="card" style={{ background: '#f0f4f8' }}>
                        <span className="ci"><Check size={22} /></span>
                        <div className="cl">Periodos cerrados</div>
                        <div className="cv">{cerradas.length}</div>
                        <div className="cs">archivados</div>
                    </div>
                    <div className="card gold">
                        <span className="ci"><BarChart2 size={22} /></span>
                        <div className="cl">Utilidad acumulada</div>
                        <div className="cv" style={{ color: '#27ae60' }}>
                            {fmt(cerradas.reduce((a, f) => a + (f.utilidadNeta || 0), 0))}
                        </div>
                        <div className="cs">periodos cerrados</div>
                    </div>
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
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#27ae60', marginBottom: '8px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27ae60', display: 'inline-block' }}></span>
                            EN CAMPO ({activas.length})
                        </div>
                        {activas.map(f => (
                            <TarjetaFaena key={f.id} f={f} expandida={expandida} detalle={detalle} cargandoDet={cargandoDet}
                                onToggle={toggleDetalle} onEditar={abrirEditar}
                                onCerrar={handleCerrar} onEliminar={handleEliminar} />
                        ))}
                    </>
                )}

                {/* FAENAS CERRADAS */}
                {cerradas.length > 0 && (
                    <>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7a8d', marginBottom: '8px', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Check size={12} /> ARCHIVADAS ({cerradas.length})
                        </div>
                        {cerradas.map(f => (
                            <TarjetaFaena key={f.id} f={f} expandida={expandida} detalle={detalle} cargandoDet={cargandoDet}
                                onToggle={toggleDetalle} onEditar={null}
                                onCerrar={null} onEliminar={handleEliminar} />
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

function TarjetaFaena({ f, expandida, detalle, cargandoDet, onToggle, onEditar, onCerrar, onEliminar }) {
    const abierta = expandida === f.id;
    const det = detalle[f.id];
    const activa = f.estado === 'activa';

    const totalIngDet  = det ? det.ingresos.reduce((a, x) => a + (x.total || 0), 0) : 0;
    const totalGasDet  = det ? det.gastos.reduce((a, x) => a + (x.monto || 0), 0) : 0;
    const totalManDet  = det ? det.mantenimientos.reduce((a, x) => a + (x.costo || 0), 0) : 0;
    const utilDet      = totalIngDet - totalGasDet - totalManDet;

    return (
        <div style={{
            background: activa ? '#fff8e7' : '#f8f9fa',
            border: `1px solid ${activa ? '#f5a623' : '#dee2e6'}`,
            borderRadius: '10px',
            marginBottom: '12px',
            overflow: 'hidden',
        }}>
            {/* Cabecera */}
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '14px' }}>{f.nombreObra}</strong>
                        <span className={`b ${activa ? 'ok' : 'comp'}`}>{activa ? 'En campo' : 'Cerrada'}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7a8d', marginTop: '3px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Tractor size={11} /> {f.maquinaNombre}
                        </span>
                        {f.cliente && <span>{f.cliente}</span>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} /> {fmtFecha(f.fechaInicio)}{f.fechaFin ? ` → ${fmtFecha(f.fechaFin)}` : ''}
                        </span>
                    </div>
                </div>

                {/* Totales si cerrada */}
                {!activa && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '11px', color: '#6b7a8d' }}>Utilidad neta</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", color: f.utilidadNeta >= 0 ? '#27ae60' : '#e74c3c' }}>
                            {fmt(f.utilidadNeta)}
                        </div>
                    </div>
                )}

                {/* Acciones */}
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {activa && onEditar && (
                        <button className="icon-btn" title="Editar" onClick={() => onEditar(f)}>
                            <Pencil size={14} />
                        </button>
                    )}
                    {activa && onCerrar && (
                        <button className="icon-btn" title="Cerrar periodo / Rendir cuentas"
                            style={{ color: '#c0392b' }}
                            onClick={() => onCerrar(f)}>
                            <StopCircle size={14} />
                        </button>
                    )}
                    <button className="icon-btn" title="Eliminar" onClick={() => onEliminar(f)}>
                        <Trash2 size={14} />
                    </button>
                    <button className="icon-btn" onClick={() => onToggle(f)}>
                        {abierta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* Detalle expandido */}
            {abierta && (
                <div style={{ borderTop: '1px solid #e9ecef', padding: '14px 16px', background: '#fff' }}>
                    {!det && cargandoDet && <p style={{ fontSize: '12px', color: '#6b7a8d' }}>Cargando registros...</p>}
                    {det && (
                        <>
                            {/* Resumen financiero en tiempo real (activa) o guardado (cerrada) */}
                            <div className="g4" style={{ marginBottom: '14px' }}>
                                <div className="card green" style={{ padding: '10px 14px' }}>
                                    <span className="ci" style={{ fontSize: '18px' }}><TrendingUp size={18} /></span>
                                    <div className="cl" style={{ fontSize: '11px' }}>Ingresos</div>
                                    <div className="cv" style={{ fontSize: '18px' }}>{fmt(activa ? totalIngDet : f.totalIngresos)}</div>
                                </div>
                                <div className="card red" style={{ padding: '10px 14px' }}>
                                    <span className="ci" style={{ fontSize: '18px' }}><TrendingDown size={18} /></span>
                                    <div className="cl" style={{ fontSize: '11px' }}>Gastos</div>
                                    <div className="cv" style={{ fontSize: '18px' }}>{fmt(activa ? totalGasDet : f.totalGastos)}</div>
                                </div>
                                <div className="card" style={{ padding: '10px 14px', background: '#fff3e0' }}>
                                    <span className="ci" style={{ fontSize: '18px' }}><Wrench size={18} /></span>
                                    <div className="cl" style={{ fontSize: '11px' }}>Mantenimientos</div>
                                    <div className="cv" style={{ fontSize: '18px' }}>{fmt(activa ? totalManDet : f.totalMantenimientos)}</div>
                                </div>
                                <div className="card gold" style={{ padding: '10px 14px' }}>
                                    <span className="ci" style={{ fontSize: '18px' }}><BarChart2 size={18} /></span>
                                    <div className="cl" style={{ fontSize: '11px' }}>Utilidad</div>
                                    <div className="cv" style={{ fontSize: '18px', color: (activa ? utilDet : f.utilidadNeta) >= 0 ? '#27ae60' : '#e74c3c' }}>
                                        {fmt(activa ? utilDet : f.utilidadNeta)}
                                    </div>
                                </div>
                            </div>

                            {/* Tablas de registros */}
                            {det.ingresos.length > 0 && (
                                <TablaDetalle titulo="Ingresos" icono={<TrendingUp size={13} />} color="#27ae60"
                                    cols={['Fecha', 'Descripción', 'Tipo', 'Total']}
                                    rows={det.ingresos.map(i => [fmtFecha(i.fecha), i.descripcion, i.tipoTrabajo, <span className="pos">{fmt(i.total)}</span>])} />
                            )}
                            {det.gastos.length > 0 && (
                                <TablaDetalle titulo="Gastos" icono={<TrendingDown size={13} />} color="#e74c3c"
                                    cols={['Fecha', 'Descripción', 'Categoría', 'Monto']}
                                    rows={det.gastos.map(g => [fmtFecha(g.fecha), g.descripcion, g.categoria, <span className="neg">{fmt(g.monto)}</span>])} />
                            )}
                            {det.salarios.length > 0 && (
                                <TablaDetalle titulo="Salarios" icono={<Clock size={13} />} color="#2980b9"
                                    cols={['Fecha', 'Operador', 'Horas', 'Neto']}
                                    rows={det.salarios.map(s => [fmtFecha(s.fecha), s.operadorNombre, `${s.horasTrabajadas} hrs`, <span className="pos">{fmt(s.totalNeto)}</span>])} />
                            )}
                            {det.mantenimientos.length > 0 && (
                                <TablaDetalle titulo="Mantenimientos" icono={<Wrench size={13} />} color="#e67e22"
                                    cols={['Fecha', 'Tipo', 'Descripción', 'Costo']}
                                    rows={det.mantenimientos.map(m => [fmtFecha(m.fecha), m.tipo, m.descripcion, <span className="neg">{fmt(m.costo)}</span>])} />
                            )}
                            {det.combustible.length > 0 && (
                                <TablaDetalle titulo="Combustible" icono={<Fuel size={13} />} color="#8e44ad"
                                    cols={['Fecha', 'Galones', 'Precio/Gal', 'Total']}
                                    rows={det.combustible.map(c => [fmtFecha(c.fecha), `${c.galones} gal`, fmt(c.precioPorGalon), <span className="neg">{fmt(c.total)}</span>])} />
                            )}
                            {det.ingresos.length === 0 && det.gastos.length === 0 && det.salarios.length === 0
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

function TablaDetalle({ titulo, icono, color, cols, rows }) {
    return (
        <div className="tbl" style={{ marginBottom: '12px' }}>
            <div className="th">
                <strong style={{ display: 'flex', alignItems: 'center', gap: '5px', color }}>
                    {icono} {titulo}
                </strong>
            </div>
            <div className="tr hdr">
                {cols.map((c, i) => <span key={i}>{c}</span>)}
            </div>
            {rows.map((row, i) => (
                <div className="tr" key={i}>
                    {row.map((cell, j) => <span key={j}>{cell}</span>)}
                </div>
            ))}
        </div>
    );
}

export default Faenas;
