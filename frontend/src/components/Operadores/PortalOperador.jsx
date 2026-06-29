import { useEffect, useMemo, useRef, useState } from 'react';
import {
    HardHat, LogOut, AlertTriangle, ClipboardList, MapPin, Menu, X,
    Radio, Wrench, Bell, User, Lock, Mail, Check, RefreshCw, ChevronRight,
    Clock, Gauge, AlertCircle, CheckCircle, Info,
} from 'lucide-react';
import DetalleOperador from './DetalleOperador';
import {
    getOperadoresAPI, getOperadorByIdAPI, getMisMaquinasAPI, actualizarUbicacion,
    getMantenimientosMiMaquina, createNovedad, getMisNovedades,
    enviarCodigoPassword, changePassword,
} from '../../api';
import { useToast } from '../../utils/toast';
import { fmtFecha } from '../../utils/fmtFecha';

const SECCIONES = [
    { id: 'jornada',   icon: ClipboardList, label: 'Mi jornada' },
    { id: 'maquina',   icon: Wrench,        label: 'Mi máquina' },
    { id: 'novedades', icon: Bell,          label: 'Novedades' },
    { id: 'perfil',    icon: User,          label: 'Mi perfil' },
];

const TIPOS_NOVEDAD = ['Daño', 'Falla mecánica', 'Falla eléctrica', 'Observación', 'Otro'];

const estadoColor = (e) => ({
    'Activa':         { bg: '#e8f5e9', color: '#27ae60', border: '#a8d5b5' },
    'En mantenimiento': { bg: '#fff8e7', color: '#f5a623', border: '#f5e0a0' },
    'Inactiva':       { bg: '#f0f4f8', color: '#6b7a8d', border: '#c8d6e5' },
    'Averiada':       { bg: '#fdf3f3', color: '#e74c3c', border: '#f5c6c6' },
}[e] || { bg: '#f0f4f8', color: '#6b7a8d', border: '#c8d6e5' });

const mantenEstadoColor = (e) => ({
    'Pendiente':  { bg: '#fff8e7', color: '#f5a623' },
    'Completado': { bg: '#e8f5e9', color: '#27ae60' },
    'En proceso': { bg: '#e8f0fe', color: '#2980b9' },
}[e] || { bg: '#f0f4f8', color: '#6b7a8d' });

function PortalOperador({ user, onLogout }) {
    const toast = useToast();
    const [operador, setOperador] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [misMaquinas, setMisMaquinas] = useState([]);
    const [mobSide, setMobSide] = useState(false);
    const [seccion, setSeccion] = useState('jornada');

    // GPS tracking
    const [trackingIds, setTrackingIds] = useState(new Set());
    const watchIdsRef = useRef({});
    const lastUpdateRef = useRef({});

    // Mi Máquina
    const [mantenimientos, setMantenimientos] = useState([]);

    // Novedades
    const [novedades, setNovedades] = useState([]);
    const [novedadForm, setNovedadForm] = useState({ maquinaNombre: '', tipo: '', descripcion: '' });
    const [mostrarFormNovedad, setMostrarFormNovedad] = useState(false);
    const [guardandoNovedad, setGuardandoNovedad] = useState(false);

    // Mi Perfil — cambiar contraseña
    const [passStep, setPassStep] = useState(0); // 0=idle, 1=código enviado
    const [passForm, setPassForm] = useState({ codigo: '', nueva: '', confirmar: '' });
    const [passLoading, setPassLoading] = useState(false);
    const [passCountdown, setPassCountdown] = useState(0);

    useEffect(() => {
        const encontrarOperador = async () => {
            try {
                if (user?.operadorId) {
                    const { data } = await getOperadorByIdAPI(user.operadorId);
                    setOperador(data || null);
                } else {
                    const { data } = await getOperadoresAPI();
                    const match = (item) => {
                        const sameEmail = user?.email && item.email && item.email.toLowerCase() === user.email.toLowerCase();
                        const sameName  = user?.nombre && item.nombre && item.nombre.toLowerCase() === user.nombre.toLowerCase();
                        return sameEmail || sameName;
                    };
                    setOperador(data.find(match) || null);
                }
            } catch { setOperador(null); }
            finally { setCargando(false); }
        };
        encontrarOperador();
    }, [user]);

    useEffect(() => {
        if (!operador) return;
        getMisMaquinasAPI().then(r => {
            setMisMaquinas(r.data);
            if (r.data.length > 0) setNovedadForm(f => ({ ...f, maquinaNombre: r.data[0].nombre }));
        }).catch(() => {});
        getMantenimientosMiMaquina().then(r => setMantenimientos(r.data)).catch(() => {});
        getMisNovedades().then(r => setNovedades(r.data)).catch(() => {});
    }, [operador]);

    useEffect(() => {
        return () => { Object.values(watchIdsRef.current).forEach(id => navigator.geolocation?.clearWatch(id)); };
    }, []);

    const toggleTracking = (maq) => {
        if (trackingIds.has(maq.id)) {
            if (watchIdsRef.current[maq.id] != null) {
                navigator.geolocation.clearWatch(watchIdsRef.current[maq.id]);
                delete watchIdsRef.current[maq.id];
            }
            setTrackingIds(prev => { const s = new Set(prev); s.delete(maq.id); return s; });
            toast(`Seguimiento de ${maq.nombre} detenido`, 'i');
        } else {
            if (!navigator.geolocation) return toast('Tu dispositivo no soporta GPS', 'e');
            const watchId = navigator.geolocation.watchPosition(
                async (pos) => {
                    const now = Date.now();
                    if (now - (lastUpdateRef.current[maq.id] || 0) < 5000) return;
                    lastUpdateRef.current[maq.id] = now;
                    const { latitude: latitud, longitude: longitud } = pos.coords;
                    if (!isFinite(latitud) || !isFinite(longitud)) return;
                    try {
                        await actualizarUbicacion(maq.id, { latitud, longitud, ubicacionNombre: `${latitud.toFixed(5)}, ${longitud.toFixed(5)}` });
                        setMisMaquinas(prev => prev.map(m => m.id === maq.id ? { ...m, latitud, longitud } : m));
                    } catch { }
                },
                () => toast('Error de GPS — verifica permisos', 'e'),
                { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
            );
            watchIdsRef.current[maq.id] = watchId;
            setTrackingIds(prev => new Set([...prev, maq.id]));
            toast(`Seguimiento de ${maq.nombre} iniciado`, 's');
        }
    };

    const reportarNovedad = async () => {
        if (!novedadForm.tipo || !novedadForm.descripcion.trim())
            return toast('Completa el tipo y la descripción', 'e');
        setGuardandoNovedad(true);
        try {
            const { data } = await createNovedad(novedadForm);
            setNovedades(prev => [data, ...prev]);
            setNovedadForm(f => ({ ...f, tipo: '', descripcion: '' }));
            setMostrarFormNovedad(false);
            toast('Novedad reportada — el administrador la revisará', 's');
        } catch { toast('No se pudo guardar la novedad', 'e'); }
        finally { setGuardandoNovedad(false); }
    };

    const enviarCodigoPass = async () => {
        setPassLoading(true);
        try {
            await enviarCodigoPassword();
            setPassStep(1);
            toast('Código enviado a tu correo', 's');
            setPassCountdown(60);
            const t = setInterval(() => setPassCountdown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
        } catch { toast('No se pudo enviar el código', 'e'); }
        finally { setPassLoading(false); }
    };

    const cambiarPass = async () => {
        if (passForm.nueva.length < 6) return toast('Mínimo 6 caracteres', 'e');
        if (passForm.nueva !== passForm.confirmar) return toast('Las contraseñas no coinciden', 'e');
        setPassLoading(true);
        try {
            await changePassword({ codigo: passForm.codigo.trim(), nueva: passForm.nueva });
            setPassStep(0);
            setPassForm({ codigo: '', nueva: '', confirmar: '' });
            toast('Contraseña cambiada correctamente', 's');
        } catch (err) {
            toast(err.response?.data?.error || 'Código incorrecto o expirado', 'e');
        } finally { setPassLoading(false); }
    };

    const inicial = useMemo(() => (user?.nombre?.charAt(0)?.toUpperCase() || 'O'), [user]);

    const navegar = (id) => { setSeccion(id); setMobSide(false); };

    if (cargando) return (
        <div className="operator-shell">
            <aside className="operator-side">
                <div><div className="logo">Maqui<span>Control</span></div><div className="sb-badge">Operador</div></div>
            </aside>
            <main className="operator-main">
                <div className="content"><div className="pad" style={{ color: '#6b7a8d', padding: '40px 0' }}>Cargando...</div></div>
            </main>
        </div>
    );

    if (!operador) return (
        <div className="operator-shell">
            <aside className="operator-side">
                <div><div className="logo">Maqui<span>Control</span></div><div className="sb-badge">Operador</div></div>
                <div className="operator-user">
                    <div className="av">{inicial}</div>
                    <div className="sb-uinfo"><p>{user?.nombre}</p><span>{user?.email}</span></div>
                </div>
                <button className="btn-exit" onClick={onLogout}><span><LogOut size={16} /></span><span className="sb-label">Cerrar sesion</span></button>
            </aside>
            <main className="operator-main">
                <div className="content"><div className="pad">
                    <div className="fc">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} /> Operador sin vincular</h3>
                        <div className="ale red">
                            <AlertTriangle size={18} color="#e74c3c" />
                            <div>
                                <p>No se encontró un operador con este correo o nombre</p>
                                <span className="ale-desc">El administrador debe vincular esta cuenta desde el módulo de Operadores.</span>
                            </div>
                        </div>
                    </div>
                </div></div>
            </main>
        </div>
    );

    const maqPrincipal = misMaquinas[0] || null;
    const pendientes = novedades.filter(n => n.estado === 'pendiente').length;

    return (
        <div className="operator-shell">
            {!mobSide && (
                <button className="op-hamburger" onClick={() => setMobSide(true)} aria-label="Abrir menú"><Menu size={18} /></button>
            )}
            <div className={`op-overlay${mobSide ? ' show' : ''}`} onClick={() => setMobSide(false)} />

            <aside className={`operator-side${mobSide ? ' op-mob-open' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div><div className="logo">Maqui<span>Control</span></div><div className="sb-badge">Operador</div></div>
                    <button className="op-close-btn" onClick={() => setMobSide(false)} aria-label="Cerrar"><X size={15} /></button>
                </div>

                <div className="operator-user">
                    <div className="av">{inicial}</div>
                    <div className="sb-uinfo">
                        <p>{operador.nombre}</p>
                        <span>{operador.email || user?.email}</span>
                    </div>
                </div>

                <div className="operator-menu">
                    {SECCIONES.map(({ id, icon: Icon, label }) => (
                        <button key={id} className={`operator-item${seccion === id ? ' active' : ''}`}
                            onClick={() => navegar(id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', position: 'relative' }}>
                            <Icon size={16} /> {label}
                            {id === 'novedades' && pendientes > 0 && (
                                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: '#e74c3c', color: '#fff', fontSize: '10px', fontWeight: '700', borderRadius: '99px', padding: '1px 6px' }}>
                                    {pendientes}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <button className="btn-exit" onClick={onLogout}>
                    <span><LogOut size={16} /></span>
                    <span className="sb-label">Cerrar sesion</span>
                </button>
            </aside>

            <main className="operator-main">

                {/* ── MI JORNADA ── */}
                {seccion === 'jornada' && (
                    <>
                        {misMaquinas.length > 0 && (
                            <div style={{ padding: '16px 16px 0' }}>
                                <div className="fc" style={{ marginBottom: 0 }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <MapPin size={17} /> Ubicación en vivo
                                    </h3>
                                    {misMaquinas.map(m => {
                                        const activo = trackingIds.has(m.id);
                                        return (
                                            <div key={m.id} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                background: activo ? '#f0fdf4' : '#f8fafc',
                                                border: `1px solid ${activo ? '#86efac' : '#eaf0f8'}`,
                                                borderRadius: '10px', padding: '10px 14px', marginBottom: '8px',
                                            }}>
                                                <div style={{ minWidth: 0, flex: 1, marginRight: '10px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a2d42', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {m.nombre}
                                                        {activo && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#22c55e', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '99px' }}><span className="gps-pulse-dot" /> EN VIVO</span>}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#6b7a8d', marginTop: '2px' }}>{m.ubicacionNombre || 'Sin ubicación registrada'}</div>
                                                </div>
                                                <button onClick={() => toggleTracking(m)} className={activo ? 'bs' : 'bp'}
                                                    style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, ...(activo ? { borderColor: '#86efac', color: '#16a34a' } : {}) }}>
                                                    {activo ? <><X size={12} /> Detener</> : <><Radio size={12} /> En vivo</>}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <DetalleOperador operador={operador} onVolver={() => {}} modoPortal />
                    </>
                )}

                {/* ── MI MÁQUINA ── */}
                {seccion === 'maquina' && (
                    <div className="content"><div className="pad">
                        <div className="topbar" style={{ position: 'static', marginBottom: '16px' }}>
                            <div><h1>Mi máquina</h1><p>Estado y mantenimientos del equipo asignado</p></div>
                        </div>

                        {!maqPrincipal ? (
                            <div className="ale"><AlertTriangle size={18} /><div><p>No tienes máquina asignada</p><span className="ale-desc">Contacta al administrador.</span></div></div>
                        ) : (
                            <>
                                {/* Tarjeta de máquina */}
                                <div className="fc" style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                        <div style={{ width: 56, height: 56, borderRadius: '14px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Wrench size={26} color="#2980b9" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '800', fontSize: '18px', color: '#1a2d42' }}>{maqPrincipal.nombre}</div>
                                            <div style={{ fontSize: '13px', color: '#6b7a8d', marginTop: '2px' }}>{maqPrincipal.tipo} {maqPrincipal.placa ? `· Placa: ${maqPrincipal.placa}` : ''}</div>
                                        </div>
                                        {maqPrincipal.estado && (() => {
                                            const c = estadoColor(maqPrincipal.estado);
                                            return <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: '99px', padding: '4px 12px', fontSize: '12px', fontWeight: '700' }}>{maqPrincipal.estado}</span>;
                                        })()}
                                    </div>

                                    <div className="g4" style={{ marginTop: '16px' }}>
                                        <div className="card blue">
                                            <span className="ci"><Gauge size={22} /></span>
                                            <div className="cl">Horómetro</div>
                                            <div className="cv">{(maqPrincipal.horometroActual || 0).toLocaleString('es-CO')}</div>
                                            <div className="cs">horas acumuladas</div>
                                        </div>
                                        <div className="card">
                                            <span className="ci"><MapPin size={22} /></span>
                                            <div className="cl">Ubicación</div>
                                            <div className="cv" style={{ fontSize: '13px' }}>{maqPrincipal.ubicacionNombre || '—'}</div>
                                            <div className="cs">última registrada</div>
                                        </div>
                                        <div className="card">
                                            <span className="ci"><Wrench size={22} /></span>
                                            <div className="cl">Mantenimientos</div>
                                            <div className="cv">{mantenimientos.length}</div>
                                            <div className="cs">registrados</div>
                                        </div>
                                        <div className="card gold">
                                            <span className="ci"><AlertCircle size={22} /></span>
                                            <div className="cl">Pendientes</div>
                                            <div className="cv">{mantenimientos.filter(m => m.estado === 'Pendiente').length}</div>
                                            <div className="cs">por realizar</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Mantenimientos */}
                                <div className="fc">
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Wrench size={18} /> Historial de mantenimientos</h3>
                                    {mantenimientos.length === 0 ? (
                                        <p className="vacio">Sin mantenimientos registrados para esta máquina</p>
                                    ) : (
                                        <div className="tbl">
                                            <div className="tr hdr"><span>Fecha</span><span>Tipo</span><span>Descripción</span><span>Horómetro</span><span>Estado</span></div>
                                            {mantenimientos.slice(0, 15).map(m => {
                                                const c = mantenEstadoColor(m.estado);
                                                return (
                                                    <div className="tr" key={m.id}>
                                                        <span>{fmtFecha(m.fecha)}</span>
                                                        <span>{m.tipo}</span>
                                                        <span style={{ color: '#6b7a8d' }}>{m.descripcion || '—'}</span>
                                                        <span>{m.horometro ? `${m.horometro} hrs` : '—'}</span>
                                                        <span><span style={{ background: c.bg, color: c.color, borderRadius: '99px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>{m.estado || '—'}</span></span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div></div>
                )}

                {/* ── NOVEDADES ── */}
                {seccion === 'novedades' && (
                    <div className="content"><div className="pad">
                        <div className="topbar" style={{ position: 'static', marginBottom: '16px' }}>
                            <div><h1>Novedades</h1><p>Reporta daños, fallas u observaciones de tu máquina</p></div>
                            <button className="bp" onClick={() => setMostrarFormNovedad(v => !v)}>
                                <Bell size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                {mostrarFormNovedad ? 'Cancelar' : 'Reportar novedad'}
                            </button>
                        </div>

                        {mostrarFormNovedad && (
                            <div className="fc" style={{ marginBottom: '16px' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Bell size={18} /> Nueva novedad</h3>
                                <div className="fg2">
                                    <div>
                                        <label className="fl">Máquina</label>
                                        <select className="fi" value={novedadForm.maquinaNombre}
                                            onChange={e => setNovedadForm(f => ({ ...f, maquinaNombre: e.target.value }))}>
                                            {misMaquinas.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="fl">Tipo *</label>
                                        <select className="fi" value={novedadForm.tipo}
                                            onChange={e => setNovedadForm(f => ({ ...f, tipo: e.target.value }))}>
                                            <option value="">— Selecciona —</option>
                                            {TIPOS_NOVEDAD.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="fl">Descripción *</label>
                                    <textarea className="fi" rows={3}
                                        style={{ resize: 'vertical', minHeight: '80px' }}
                                        value={novedadForm.descripcion}
                                        onChange={e => setNovedadForm(f => ({ ...f, descripcion: e.target.value }))}
                                        placeholder="Describe el problema o novedad con el mayor detalle posible..." />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="bp" onClick={reportarNovedad} disabled={guardandoNovedad}>
                                        <Check size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                        {guardandoNovedad ? 'Guardando...' : 'Enviar novedad'}
                                    </button>
                                    <button className="bs" onClick={() => setMostrarFormNovedad(false)}>Cancelar</button>
                                </div>
                            </div>
                        )}

                        <div className="fc">
                            <h3>Mis novedades reportadas</h3>
                            {novedades.length === 0 ? (
                                <p className="vacio">Aún no has reportado ninguna novedad</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {novedades.map(n => (
                                        <div key={n.id} style={{
                                            background: n.estado === 'revisada' ? '#f0fdf4' : '#fffbeb',
                                            border: `1px solid ${n.estado === 'revisada' ? '#86efac' : '#fcd34d'}`,
                                            borderRadius: '12px', padding: '14px 16px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#1a2d42' }}>{n.tipo}</span>
                                                    <span style={{ fontSize: '11px', color: '#9aa5b4' }}>·</span>
                                                    <span style={{ fontSize: '12px', color: '#6b7a8d' }}>{n.maquinaNombre}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '11px', color: '#9aa5b4' }}>{fmtFecha(n.fecha)}</span>
                                                    {n.estado === 'revisada'
                                                        ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e8f5e9', color: '#27ae60', border: '1px solid #a8d5b5', borderRadius: '99px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}><CheckCircle size={10} /> Revisada</span>
                                                        : <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff8e7', color: '#f5a623', border: '1px solid #f5e0a0', borderRadius: '99px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}><Clock size={10} /> Pendiente</span>}
                                                </div>
                                            </div>
                                            <p style={{ fontSize: '13px', color: '#4a5568', margin: 0, lineHeight: '1.5' }}>{n.descripcion}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div></div>
                )}

                {/* ── MI PERFIL ── */}
                {seccion === 'perfil' && (
                    <div className="content"><div className="pad">
                        <div className="topbar" style={{ position: 'static', marginBottom: '16px' }}>
                            <div><h1>Mi perfil</h1><p>Información de tu cuenta</p></div>
                        </div>

                        {/* Info del operador */}
                        <div className="fc">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={18} /> Mis datos</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a2d42', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5a623', fontSize: '22px', fontWeight: '800', flexShrink: 0 }}>{inicial}</div>
                                <div>
                                    <div style={{ fontWeight: '700', fontSize: '16px', color: '#1a2d42' }}>{operador.nombre}</div>
                                    <div style={{ fontSize: '13px', color: '#6b7a8d' }}>{operador.email || user?.email || '—'}</div>
                                </div>
                            </div>
                            <div className="fg2">
                                <div>
                                    <label className="fl">Cédula</label>
                                    <input className="fi" value={operador.cedula || '—'} readOnly style={{ background: '#f0f4f8', color: '#6b7a8d', cursor: 'not-allowed' }} />
                                </div>
                                <div>
                                    <label className="fl">Teléfono</label>
                                    <input className="fi" value={operador.telefono || '—'} readOnly style={{ background: '#f0f4f8', color: '#6b7a8d', cursor: 'not-allowed' }} />
                                </div>
                            </div>
                            {operador.observaciones && (
                                <div className="ale" style={{ background: '#e8f0fe', borderColor: '#2980b9' }}>
                                    <Info size={16} color="#2980b9" />
                                    <div><p style={{ margin: 0 }}>{operador.observaciones}</p></div>
                                </div>
                            )}
                        </div>

                        {/* Cambiar contraseña */}
                        <div className="fc">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={18} /> Cambiar contraseña</h3>

                            {passStep === 0 ? (
                                <div>
                                    <div className="ale" style={{ background: '#e8f0fe', borderColor: '#2980b9', marginBottom: '14px' }}>
                                        <Mail size={18} color="#2980b9" />
                                        <div>
                                            <p>Se enviará un código a <strong>{operador.email || user?.email}</strong></p>
                                            <span className="ale-desc">Úsalo para establecer una nueva contraseña.</span>
                                        </div>
                                    </div>
                                    <button className="bp" onClick={enviarCodigoPass} disabled={passLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Mail size={14} />
                                        {passLoading ? 'Enviando...' : 'Enviar código a mi correo'}
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="ale" style={{ background: '#e8f5e9', borderColor: '#27ae60', marginBottom: '14px' }}>
                                        <Check size={18} color="#27ae60" />
                                        <div><p>Código enviado. Revisa tu bandeja.</p><span className="ale-desc">Válido por 15 minutos.</span></div>
                                    </div>
                                    <div style={{ marginBottom: '10px' }}>
                                        <label className="fl">Código *</label>
                                        <input className="fi" value={passForm.codigo}
                                            onChange={e => setPassForm(f => ({ ...f, codigo: e.target.value }))}
                                            placeholder="000000" maxLength={6} inputMode="numeric"
                                            style={{ letterSpacing: '4px', fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
                                    </div>
                                    <div className="fg2" style={{ marginBottom: '10px' }}>
                                        <div>
                                            <label className="fl">Nueva contraseña *</label>
                                            <input className="fi" type="password" value={passForm.nueva}
                                                onChange={e => setPassForm(f => ({ ...f, nueva: e.target.value }))}
                                                placeholder="Mínimo 6 caracteres" />
                                        </div>
                                        <div>
                                            <label className="fl">Confirmar *</label>
                                            <input className="fi" type="password" value={passForm.confirmar}
                                                onChange={e => setPassForm(f => ({ ...f, confirmar: e.target.value }))}
                                                placeholder="Repite la contraseña" />
                                        </div>
                                    </div>
                                    {passForm.nueva && passForm.confirmar && passForm.nueva !== passForm.confirmar && (
                                        <p style={{ fontSize: '12px', color: '#e74c3c', margin: '0 0 8px' }}>Las contraseñas no coinciden</p>
                                    )}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <button className="bp" onClick={cambiarPass}
                                            disabled={passLoading || !passForm.codigo.trim() || passForm.nueva.length < 6 || passForm.nueva !== passForm.confirmar}>
                                            <Lock size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                            {passLoading ? 'Cambiando...' : 'Cambiar contraseña'}
                                        </button>
                                        <button className="bs" onClick={enviarCodigoPass} disabled={passLoading || passCountdown > 0}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <RefreshCw size={13} />
                                            {passCountdown > 0 ? `Reenviar en ${passCountdown}s` : 'Reenviar código'}
                                        </button>
                                        <button className="bs" onClick={() => { setPassStep(0); setPassForm({ codigo: '', nueva: '', confirmar: '' }); }}>Cancelar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div></div>
                )}

            </main>
        </div>
    );
}

export default PortalOperador;
