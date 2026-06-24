import { useEffect, useMemo, useState } from 'react';
import { HardHat, LogOut, AlertTriangle, ClipboardList, Navigation, MapPin, Loader } from 'lucide-react';
import DetalleOperador from './DetalleOperador';
import { getOperadoresAPI, getOperadorByIdAPI, getMaquinas, actualizarUbicacion } from '../../api';
import { useToast } from '../../utils/toast';

function PortalOperador({ user, onLogout }) {
    const toast = useToast();
    const [operador, setOperador] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [misMaquinas, setMisMaquinas] = useState([]);
    const [gpsActivo, setGpsActivo] = useState(null);

    useEffect(() => {
        const encontrarOperador = async () => {
            try {
                // Si el usuario tiene operadorId vinculado, buscamos directo por ID
                if (user?.operadorId) {
                    const { data } = await getOperadorByIdAPI(user.operadorId);
                    setOperador(data || null);
                } else {
                    // Fallback: buscar por nombre/email entre los operadores del admin
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
        getMaquinas().then(r => {
            setMisMaquinas(r.data.filter(m =>
                m.operadorNombre?.toLowerCase() === operador.nombre?.toLowerCase()
            ));
        }).catch(() => {});
    }, [operador]);

    const usarGPS = (maq) => {
        if (!navigator.geolocation) return toast('Tu dispositivo no soporta GPS', 'e');
        setGpsActivo(maq.id);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: latitud, longitude: longitud } = pos.coords;
                let ubicacionNombre = `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`;
                try {
                    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitud}&lon=${longitud}&format=json`);
                    const d = await r.json();
                    ubicacionNombre = d.display_name?.split(',').slice(0, 3).join(',') || ubicacionNombre;
                } catch { /* usa coordenadas */ }
                try {
                    await actualizarUbicacion(maq.id, { latitud, longitud, ubicacionNombre });
                    setMisMaquinas(prev => prev.map(m =>
                        m.id === maq.id ? { ...m, latitud, longitud, ubicacionNombre } : m
                    ));
                    toast(`Ubicación de ${maq.nombre} actualizada`, 's');
                } catch { toast('No se pudo guardar la ubicación', 'e'); }
                finally { setGpsActivo(null); }
            },
            () => { toast('No se pudo obtener la ubicación', 'e'); setGpsActivo(null); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const inicial = useMemo(
        () => (user?.nombre?.charAt(0)?.toUpperCase() || 'O'),
        [user]
    );

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
                    <div className="content">
                        <div className="pad">
                            <p style={{ color: '#6b7a8d', padding: '40px 0' }}>Cargando datos del operador...</p>
                        </div>
                    </div>
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
                    <div className="content">
                        <div className="pad">
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
                        </div>
                    </div>
                </main>
            </div>
        );
    }

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
                            {misMaquinas.map(m => (
                                <div key={m.id} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: '#f8fafc', border: '1px solid #eaf0f8',
                                    borderRadius: '10px', padding: '10px 14px', marginBottom: '8px'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a2d42' }}>{m.nombre}</div>
                                        <div style={{ fontSize: '11px', color: '#6b7a8d', marginTop: '2px' }}>
                                            {m.ubicacionNombre || 'Sin ubicación registrada'}
                                        </div>
                                    </div>
                                    <button onClick={() => usarGPS(m)} disabled={gpsActivo === m.id}
                                        className="bp" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                        {gpsActivo === m.id
                                            ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Obteniendo...</>
                                            : <><Navigation size={12} /> Actualizar GPS</>}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <DetalleOperador operador={operador} onVolver={() => {}} modoPortal />
            </main>
        </div>
    );
}

export default PortalOperador;
