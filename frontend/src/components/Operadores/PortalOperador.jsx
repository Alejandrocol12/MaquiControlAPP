import { useEffect, useMemo, useState } from 'react';
import { HardHat, LogOut, AlertTriangle, ClipboardList } from 'lucide-react';
import DetalleOperador from './DetalleOperador';
import { getOperadoresAPI } from '../../api';

function PortalOperador({ user, onLogout }) {
    const [operador, setOperador] = useState(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const encontrarOperador = async () => {
            try {
                const { data } = await getOperadoresAPI();
                const match = (item) => {
                    const sameId = user?.operadorId != null && Number(item.id) === Number(user.operadorId);
                    const sameEmail = user?.email && item.email &&
                        item.email.toLowerCase() === user.email.toLowerCase();
                    const sameName = user?.nombre && item.nombre &&
                        item.nombre.toLowerCase() === user.nombre.toLowerCase();
                    return sameId || sameEmail || sameName;
                };
                setOperador(data.find(match) || null);
            } catch {
                setOperador(null);
            } finally {
                setCargando(false);
            }
        };

        encontrarOperador();
    }, [user]);

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
                <DetalleOperador operador={operador} onVolver={() => {}} modoPortal />
            </main>
        </div>
    );
}

export default PortalOperador;
