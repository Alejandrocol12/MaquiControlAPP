import { useEffect, useMemo, useRef, useState } from 'react';
import { HardHat, LogOut, AlertTriangle, ClipboardList, Navigation, MapPin, Loader, Menu, X, Radio } from 'lucide-react';
import DetalleOperador from './DetalleOperador';
import { getOperadoresAPI, getOperadorByIdAPI, getMisMaquinasAPI, actualizarUbicacion } from '../../api';
import { useToast } from '../../utils/toast';

function PortalOperador({ user, onLogout }) {
    const toast = useToast();
    const [operador, setOperador] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [misMaquinas, setMisMaquinas] = useState([]);
    const [mobSide, setMobSide] = useState(false);

    // Seguimiento en vivo
    const [trackingIds, setTrackingIds] = useState(new Set());
    const watchIdsRef = useRef({});      // { [maqId]: watchId de geolocation }
    const lastUpdateRef = useRef({});    // { [maqId]: timestamp del último envío }

    useEffect(() => {
        const encontrarOperador = async () => {
            try {
                if (user?.operadorId) {
                    const { data } = await getOperadorByIdAPI(user.operadorId);
                    setOperador(data || null);
                } else {
                    const { data } = await getOperadoresAPI();
                    const match = (item) => {
                        const sameEmail = user?.email && item.email &&
                            item.email.toLowerCase() === user.email.toLowerCase();
                        const sameName = user?.nombre && item.nombre &&
                            item.nombre.toLowerCase() === user.nombre.toLowerCase();
                        return sameEmail || sameName;
                    };
                    setOperador(data.find(match) || null);
                }
            } catch {
                setOperador(null);
            } finally {
                setCargando(false);
            }
        };
        encontrarOperador();
    }, [user]);

    useEffect(() => {
        if (!operador) return;
        getMisMaquinasAPI().then(r => setMisMaquinas(r.data)).catch(() => {});
    }, [operador]);

    // Limpiar todos los watchPosition al desmontar
    useEffect(() => {
        return () => {
            Object.values(watchIdsRef.current).forEach(id => navigator.geolocation?.clearWatch(id));
        };
    }, []);

    const toggleTracking = (maq) => {
        if (trackingIds.has(maq.id)) {
            // Detener seguimiento
            if (watchIdsRef.current[maq.id] != null) {
                navigator.geolocation.clearWatch(watchIdsRef.current[maq.id]);
                delete watchIdsRef.current[maq.id];
            }
            setTrackingIds(prev => { const s = new Set(prev); s.delete(maq.id); return s; });
            toast(`Seguimiento de ${maq.nombre} detenido`, 'i');
        } else {
            // Iniciar seguimiento
            if (!navigator.geolocation) return toast('Tu dispositivo no soporta GPS', 'e');
            const watchId = navigator.geolocation.watchPosition(
                async (pos) => {
                    const now = Date.now();
                    // Throttle: máximo una actualización cada 5 segundos por máquina
                    if (now - (lastUpdateRef.current[maq.id] || 0) < 5000) return;
                    lastUpdateRef.current[maq.id] = now;

                    const { latitude: latitud, longitude: longitud } = pos.coords;
                    const ubicacionNombre = `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`;
                    try {
                        await actualizarUbicacion(maq.id, { latitud, longitud, ubicacionNombre });
                        setMisMaquinas(prev => prev.map(m =>
                            m.id === maq.id ? { ...m, latitud, longitud, ubicacionNombre } : m
                        ));
                    } catch { /* silencioso durante tracking */ }
                },
                () => { toast('Error de GPS — verifica permisos', 'e'); },
                { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
            );
            watchIdsRef.current[maq.id] = watchId;
            setTrackingIds(prev => new Set([...prev, maq.id]));
            toast(`Seguimiento de ${maq.nombre} iniciado`, 's');
        }
    };

    const inicial = useMemo(() => (user?.nombre?.charAt(0)?.toUpperCase() || 'O'), [user]);

    if (cargando) {
        return (
            <div className="operator-shell">
                <aside className="operator-side">
                    <div>
                        <div className="logo">Maqui<span>Control</span></div>
                        <div className="sb-badge">Operador</div>
                    </div>
                    <div className="operator-user">
                        <div className="av">{inicial}</div>
                        <div className="sb-uinfo">
                            <p>{user?.nombre || 'Operador'}</p>
                            <span>{user?.email || 'sin-correo'}</span>
                        </div>
                    </div>
                </aside>
                <main className="operator-main">
                    <div className="content"><div className="pad">
                        <p style={{ color: '#6b7a8d', padding: '40px 0' }}>Cargando datos del operador...</p>
                    </div></div>
                </main>
            </div>
        );
    }

    if (!operador) {
        return (
            <div className="operator-shell">
                <aside className="operator-side">
                    <div>
                        <div className="logo">Maqui<span>Control</span></div>
                        <div className="sb-badge">Operador</div>
                    </div>
                    <div className="operator-user">
                        <div className="av">{inicial}</div>
                        <div className="sb-uinfo">
                            <p>{user?.nombre || 'Operador'}</p>
                            <span>{user?.email || 'sin-correo'}</span>
                        </div>
                    </div>
                    <div className="operator-menu">
                        <div className="operator-item active">
                            <ClipboardList size={16} /> Mi panel
                        </div>
                    </div>
                    <button className="btn-exit" onClick={onLogout}>
                        <span><LogOut size={16} /></span>
                        <span className="sb-label">Cerrar sesion</span>
                    </button>
                </aside>
                <main className="operator-main">
                    <div className="content"><div className="pad">
                        <div className="fc">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={18} /> Operador pendiente de vincular
                            </h3>
                            <p className="fd">
                                Esta cuenta entro como operador, pero todavia no esta enlazada a un registro en el modulo de operadores.
                            </p>
                            <div className="ale red">
                                <AlertTriangle size={18} color="#e74c3c" />
                                <div>
                                    <p>No encontramos un operador con este nombre o correo</p>
                                    <span className="ale-desc">
                                        El administrador debe vincular esta cuenta desde Operadores usando el mismo correo o el operadorId.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div></div>
                </main>
            </div>
        );
    }

    return (
        <div className="operator-shell">
            {!mobSide && (
                <button className="op-hamburger" onClick={() => setMobSide(true)} aria-label="Abrir menú">
                    <Menu size={18} />
                </button>
            )}
            <div className={`op-overlay${mobSide ? ' show' : ''}`} onClick={() => setMobSide(false)} />

            <aside className={`operator-side${mobSide ? ' op-mob-open' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div className="logo">Maqui<span>Control</span></div>
                        <div className="sb-badge">Operador</div>
                    </div>
                    <button className="op-close-btn" onClick={() => setMobSide(false)} aria-label="Cerrar menú">
                        <X size={15} />
                    </button>
                </div>

                <div className="operator-user">
                    <div className="av">{inicial}</div>
                    <div className="sb-uinfo">
                        <p>{operador.nombre}</p>
                        <span>{operador.email || user?.email || 'sin-correo'}</span>
                    </div>
                </div>

                <div className="operator-menu">
                    <div className="operator-item active">
                        <HardHat size={16} /> Mi jornada
                    </div>
                    <div className="operator-copy">
                        Registra horas, revisa tu periodo actual y consulta tu liquidacion sin entrar al panel del administrador.
                    </div>
                </div>

                <button className="btn-exit" onClick={onLogout}>
                    <span><LogOut size={16} /></span>
                    <span className="sb-label">Cerrar sesion</span>
                </button>
            </aside>

            <main className="operator-main">
                {misMaquinas.length > 0 && (
                    <div style={{ padding: '16px 16px 0' }}>
                        <div className="fc" style={{ marginBottom: 0 }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <MapPin size={17} /> Mis máquinas — ubicación
                            </h3>
                            {misMaquinas.map(m => {
                                const activo = trackingIds.has(m.id);
                                return (
                                    <div key={m.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        background: activo ? '#f0fdf4' : '#f8fafc',
                                        border: `1px solid ${activo ? '#86efac' : '#eaf0f8'}`,
                                        borderRadius: '10px', padding: '10px 14px', marginBottom: '8px',
                                        transition: 'all .2s',
                                    }}>
                                        <div style={{ minWidth: 0, flex: 1, marginRight: '10px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a2d42', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {m.nombre}
                                                {activo && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#22c55e', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '99px' }}>
                                                        <span className="gps-pulse-dot" />
                                                        EN VIVO
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6b7a8d', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {m.ubicacionNombre || 'Sin ubicación registrada'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleTracking(m)}
                                            className={activo ? 'bs' : 'bp'}
                                            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, ...(activo ? { borderColor: '#86efac', color: '#16a34a' } : {}) }}
                                        >
                                            {activo
                                                ? <><X size={12} /> Detener</>
                                                : <><Radio size={12} /> En vivo</>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                <DetalleOperador operador={operador} onVolver={() => {}} modoPortal />
            </main>
        </div>
    );
}

export default PortalOperador;
