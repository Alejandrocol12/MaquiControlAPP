import { useEffect, useState } from 'react';
import VistaCompartida from './components/VistaCompartida/VistaCompartida';
import Dashboard from './components/Dashboard/Dashboard';
import Maquinaria from './components/Maquinaria/Maquinaria';
import Finanzas from './components/Finanzas/Finanzas';
import Operadores from './components/Operadores/Operadores';
import PortalOperador from './components/Operadores/PortalOperador';
import Mantenimientos from './components/Mantenimientos/Mantenimientos';
import Combustible from './components/Combustible/Combustible';
import Reportes from './components/Reportes/Reportes';
import Faenas from './components/Faenas/Faenas';
import Perfil from './components/Perfil/Perfil';
import Mapa from './components/Mapa/Mapa';
import { apiLogin, apiRegister, loginPin } from './api';
import { ToastContext, useToastState } from './utils/toast';
import {
    BarChart2,
    Tractor,
    DollarSign,
    HardHat,
    Wrench,
    FileText,
    Fuel,
    LogOut,
    CheckCircle,
    XCircle,
    Info,
    UserPlus,
    ArrowRight,
    KeyRound,
    ChevronLeft,
    ChevronRight,
    Menu,
    Briefcase,
    Moon,
    Sun,
    WifiOff,
    Map,
} from 'lucide-react';
import { GiBulldozer } from 'react-icons/gi';
import './App.css';

const AUTH_USER_KEY = 'mc_auth_user';

const isOperatorRole = (rol) => String(rol || '').trim().toLowerCase().includes('operador');

const getStoredSession = () => {
    try {
        const s = JSON.parse(localStorage.getItem(AUTH_USER_KEY));
        return s?.user || null;
    } catch {
        return null;
    }
};

function OfflinePage({ onReintentar }) {
    return (
        <div className="offline-shell">
            <div className="offline-anim">
                <div className="offline-road" />
                <div className="offline-dozer">
                    <GiBulldozer size={52} color="#f5a623" />
                </div>
            </div>
            <div className="offline-brand">
                <span style={{ color: '#f5a623' }}>Maqui</span><span style={{ color: '#fff' }}>Control</span>
            </div>
            <h2 className="offline-title">Sin conexión</h2>
            <p className="offline-sub">No se pudo conectar con el servidor.<br />Verifica tu internet e intenta de nuevo.</p>
            <button className="auth-submit" style={{ maxWidth: '220px', marginTop: '24px' }} onClick={onReintentar}>
                <WifiOff size={15} /> Reintentar
            </button>
        </div>
    );
}

function PinKeypad({ onPin, onCancel, email }) {
    const [digits, setDigits] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const presionar = async (d) => {
        if (cargando) return;
        const nuevo = digits + d;
        setDigits(nuevo);
        setError('');
        if (nuevo.length === 4) {
            setCargando(true);
            const ok = await onPin(email, nuevo);
            if (!ok) { setError('PIN incorrecto'); setDigits(''); }
            setCargando(false);
        }
    };

    const borrar = () => { setDigits(digits.slice(0, -1)); setError(''); };

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#9aa5b4', marginBottom: '4px' }}>Bienvenido de nuevo</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1a2d42', marginBottom: '20px' }}>{email}</div>

            {/* Indicadores de dígitos */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '28px' }}>
                {[0,1,2,3].map(i => (
                    <div key={i} style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: digits.length > i ? '#f5a623' : '#e2e8f0',
                        border: '2px solid ' + (digits.length > i ? '#f5a623' : '#c8d6e5'),
                        transition: 'all .15s',
                    }} />
                ))}
            </div>

            {error && <div style={{ color: '#e74c3c', fontSize: '12px', marginBottom: '12px', fontWeight: '600' }}>{error}</div>}

            {/* Teclado numérico */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '220px', margin: '0 auto' }}>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                    <button key={n} onClick={() => presionar(String(n))} disabled={cargando}
                        style={{ padding: '16px 0', fontSize: '20px', fontWeight: '600', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#1a2d42' }}>
                        {n}
                    </button>
                ))}
                <div /> {/* celda vacía */}
                <button onClick={() => presionar('0')} disabled={cargando}
                    style={{ padding: '16px 0', fontSize: '20px', fontWeight: '600', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#1a2d42' }}>
                    0
                </button>
                <button onClick={borrar} disabled={cargando || digits.length === 0}
                    style={{ padding: '16px 0', fontSize: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#6b7a8d' }}>
                    ⌫
                </button>
            </div>

            <button onClick={onCancel}
                style={{ marginTop: '20px', background: 'none', border: 'none', color: '#9aa5b4', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
                Usar contraseña
            </button>
        </div>
    );
}

function AuthScreen({ onLogin, onRegister, onLoginPin, darkMode, toggleDark }) {
    const [vista, setVista] = useState('login');
    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [registerForm, setRegisterForm] = useState({
        nombre: '', empresa: '', email: '', password: '', confirmPassword: '',
    });
    const [activeLabel, setActiveLabel] = useState(null);
    const [animKey, setAnimKey] = useState(0);
    const [modoPIN, setModoPIN] = useState(false);

    const pinEmail = localStorage.getItem('mc_pin_email') || '';
    const hasPIN   = !!pinEmail;

    const focus = (label) => { setActiveLabel(label); setAnimKey(k => k + 1); };

    return (
        <div className="auth-shell">
            <button className="dark-toggle-float" onClick={toggleDark} title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div className="auth-top">
                <div className="auth-brand-big">
                    <span className="am">Maqui</span><span className="ac">Control</span>
                </div>
                <div className="auth-anim">
                    {activeLabel && !modoPIN && (
                        <div className="auth-dozer-row" key={animKey}>
                            <GiBulldozer size={34} color="#f5a623" />
                            <span className="auth-dozer-label">{activeLabel}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="auth-card-wrap">
                {modoPIN ? (
                    <PinKeypad
                        email={pinEmail}
                        onPin={onLoginPin}
                        onCancel={() => setModoPIN(false)}
                    />
                ) : vista === 'login' ? (
                    <>
                        <form onSubmit={e => { e.preventDefault(); onLogin(loginForm); }}>
                            <label className="fl">Correo</label>
                            <input className="fi" type="email"
                                value={loginForm.email}
                                onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                                onFocus={() => focus('Correo')}
                                placeholder="dueno@mail.com" />
                            <label className="fl">Contraseña</label>
                            <input className="fi" type="password"
                                value={loginForm.password}
                                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                                onFocus={() => focus('Contraseña')}
                                placeholder="••••••" />
                            <button className="auth-submit" type="submit">
                                Entrar <ArrowRight size={15} />
                            </button>
                        </form>
                        {hasPIN && (
                            <button onClick={() => setModoPIN(true)}
                                style={{ width: '100%', marginTop: '10px', padding: '12px', background: '#f0f4f8', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', color: '#1a2d42', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <KeyRound size={15} /> Entrar con PIN
                            </button>
                        )}
                        <div className="auth-toggle">
                            <button className="on"><KeyRound size={14} /> Iniciar sesión</button>
                            <button onClick={() => setVista('register')}><UserPlus size={14} /> Crear cuenta</button>
                        </div>
                    </>
                ) : (
                    <>
                        <form onSubmit={e => { e.preventDefault(); onRegister(registerForm); }}>
                            <label className="fl">Nombre</label>
                            <input className="fi"
                                value={registerForm.nombre}
                                onChange={e => setRegisterForm({ ...registerForm, nombre: e.target.value })}
                                onFocus={() => focus('Nombre')}
                                placeholder="Alejandro Ruiz" />
                            <label className="fl">Empresa</label>
                            <input className="fi"
                                value={registerForm.empresa}
                                onChange={e => setRegisterForm({ ...registerForm, empresa: e.target.value })}
                                onFocus={() => focus('Empresa')}
                                placeholder="MaquiControl SAS" />
                            <label className="fl">Correo</label>
                            <input className="fi" type="email"
                                value={registerForm.email}
                                onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                                onFocus={() => focus('Correo')}
                                placeholder="correo@empresa.com" />
                            <label className="fl">Contraseña</label>
                            <input className="fi" type="password"
                                value={registerForm.password}
                                onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                                onFocus={() => focus('Contraseña')}
                                placeholder="Mínimo 6 caracteres" />
                            <label className="fl">Confirmar</label>
                            <input className="fi" type="password"
                                value={registerForm.confirmPassword}
                                onChange={e => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                                onFocus={() => focus('Confirmar')}
                                placeholder="Repite la contraseña" />
                            <button className="auth-submit" type="submit">
                                Crear cuenta <ArrowRight size={15} />
                            </button>
                        </form>
                        <div className="auth-toggle">
                            <button onClick={() => setVista('login')}><KeyRound size={14} /> Iniciar sesión</button>
                            <button className="on"><UserPlus size={14} /> Crear cuenta</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function App() {
    const [sharedToken] = useState(() => new URLSearchParams(window.location.search).get('token'));
    const [modulo, setModulo] = useState('dashboard');
    const { toasts, toast } = useToastState();
    const [finOpen, setFinOpen] = useState(false);
    const [finTab, setFinTab] = useState('ingresos');
    const [maqVista, setMaqVista] = useState('lista');
    const [user, setUser] = useState(null);
    const [sbCol, setSbCol] = useState(false);
    const [sbMob, setSbMob] = useState(false);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mc_dark') === '1');
    const [isOffline, setIsOffline] = useState(!window.navigator.onLine);

    const ir = (mod) => { setModulo(mod); setSbMob(false); };
    const navFin2 = (tab) => { navFin(tab); setSbMob(false); };
    const toggleDark = () => setDarkMode(d => !d);

    useEffect(() => {
        const stored = getStoredSession();
        setUser(stored);
        if (stored?.hasPin && stored?.email) {
            localStorage.setItem('mc_pin_email', stored.email);
        }
    }, []);

    useEffect(() => {
        document.body.classList.toggle('dark', darkMode);
        localStorage.setItem('mc_dark', darkMode ? '1' : '0');
    }, [darkMode]);

    useEffect(() => {
        const goOff = () => setIsOffline(true);
        const goOn  = () => setIsOffline(false);
        window.addEventListener('offline', goOff);
        window.addEventListener('online', goOn);
        return () => { window.removeEventListener('offline', goOff); window.removeEventListener('online', goOn); };
    }, []);

    const navFin = (tab) => { setModulo('finanzas'); setFinOpen(true); setFinTab(tab); };
    const irNuevaMaquina = () => { setMaqVista('nueva'); setModulo('maquinaria'); };
    const irMaquinaria = () => { setMaqVista('lista'); setModulo('maquinaria'); };

    const login = async ({ email, password }) => {
        try {
            const { data } = await apiLogin({ email, password });
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data));
            if (data.user.hasPin) localStorage.setItem('mc_pin_email', data.user.email);
            setUser(data.user);
            toast(`Bienvenido, ${data.user.nombre}`, 's');
        } catch (err) {
            toast(err.response?.data?.error || 'Correo o contrasena incorrectos', 'e');
        }
    };

    const loginWithPin = async (email, pin) => {
        try {
            const { data } = await loginPin({ email, pin });
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data));
            setUser(data.user);
            toast(`Bienvenido, ${data.user.nombre}`, 's');
            return true;
        } catch {
            return false;
        }
    };

    const register = async ({ nombre, empresa, email, password, confirmPassword }) => {
        if (!nombre || !empresa || !email || !password || !confirmPassword) {
            toast('Completa todos los campos del registro', 'e');
            return;
        }
        if (password.length < 6) {
            toast('La contrasena debe tener al menos 6 caracteres', 'e');
            return;
        }
        if (password !== confirmPassword) {
            toast('Las contrasenas no coinciden', 'e');
            return;
        }
        try {
            const { data } = await apiRegister({ nombre, empresa, email, password });
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data));
            setUser(data.user);
            toast('Cuenta creada con exito', 's');
        } catch (err) {
            toast(err.response?.data?.error || 'Error al crear cuenta', 'e');
        }
    };

    const logout = () => {
        localStorage.removeItem(AUTH_USER_KEY);
        setUser(null);
        setModulo('dashboard');
        toast('Sesion cerrada', 'i');
    };

    const renderModulo = () => {
        switch (modulo) {
            case 'dashboard': return <Dashboard onIrMaquinaria={irMaquinaria} onNuevaMaquina={irNuevaMaquina} />;
            case 'maquinaria': return <Maquinaria vistaInicial={maqVista} key={`maq-${maqVista}`} />;
            case 'finanzas': return <Finanzas tabInicial={finTab} />;
            case 'operadores': return <Operadores />;
            case 'mantenimientos': return <Mantenimientos />;
            case 'combustible': return <Combustible />;
            case 'reportes': return <Reportes />;
            case 'faenas': return <Faenas />;
            case 'perfil': return <Perfil user={user} onUpdate={u => setUser(prev => ({ ...prev, ...u }))} />;
            case 'mapa': return <Mapa />;
            default: return <Dashboard onIrMaquinaria={irMaquinaria} onNuevaMaquina={irNuevaMaquina} />;
        }
    };

    if (sharedToken) return <VistaCompartida token={sharedToken} />;

    return (
        <ToastContext.Provider value={toast}>
            {isOffline ? (
                <OfflinePage onReintentar={() => { if (window.navigator.onLine) setIsOffline(false); else toast('Sigue sin conexión', 'e'); }} />
            ) : !user ? (
                <AuthScreen onLogin={login} onRegister={register} onLoginPin={loginWithPin} darkMode={darkMode} toggleDark={toggleDark} />
            ) : isOperatorRole(user.rol) ? (
                <PortalOperador user={user} onLogout={logout} />
            ) : (
                <div className="app">
                    <button className="hamburger" onClick={() => setSbMob(true)}><Menu size={18} /></button>
                    <div className={`sb-overlay${sbMob ? ' show' : ''}`} onClick={() => setSbMob(false)} />
                    <div className={`sb${sbCol ? ' col' : ''}${sbMob ? ' mob-open' : ''}`}>
                        <div className="sb-head">
                            {sbCol ? (
                                <>
                                    <div className="sb-monogram">M<span>C</span></div>
                                    <button className="col-btn" onClick={() => setSbCol(false)} title="Expandir">
                                        <ChevronRight size={13} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <div className="logo">Maqui<span>Control</span></div>
                                        <div className="sb-badge">{user.rol || 'Admin'}</div>
                                    </div>
                                    <button className="col-btn" onClick={() => setSbCol(true)} title="Colapsar">
                                        <ChevronLeft size={13} />
                                    </button>
                                </>
                            )}
                            {/* Botón cerrar solo en móvil */}
                            <button className="sb-close-mob" onClick={() => setSbMob(false)} title="Cerrar">
                                <ChevronLeft size={15} />
                            </button>
                        </div>

                        <div className="sb-user" onClick={() => { ir('perfil'); }} style={{ cursor: 'pointer' }} title="Ver perfil">
                            <div className="av">{user.nombre?.charAt(0)?.toUpperCase() || 'U'}</div>
                            <div className="sb-uinfo">
                                <p>{user.nombre || 'Usuario'}</p>
                                <span>{user.email || 'sin-correo'}</span>
                            </div>
                        </div>

                        <nav className="nav">
                            <div className="ns">Principal</div>
                            <div className={`ni ${modulo === 'dashboard' ? 'active' : ''}`} onClick={() => ir('dashboard')}>
                                <span className="ico"><BarChart2 size={18} /></span><span className="sb-label">Dashboard</span>
                            </div>

                            <div className="ns">Gestión</div>
                            <div className={`ni ${modulo === 'maquinaria' ? 'active' : ''}`} onClick={() => { irMaquinaria(); setSbMob(false); }}>
                                <span className="ico"><Tractor size={18} /></span><span className="sb-label">Maquinaria</span>
                            </div>

                            <div
                                className={`ni ${modulo === 'finanzas' ? 'active' : ''} ${finOpen ? 'exp' : ''}`}
                                onClick={() => { ir('finanzas'); setFinOpen(!finOpen); }}
                            >
                                <span className="ico"><DollarSign size={18} /></span><span className="sb-label">Finanzas</span>
                                <span className="arr">›</span>
                            </div>
                            <div className={`ng ${finOpen ? 'open' : ''}`}>
                                <div className={`nsub ${modulo === 'finanzas' && finTab === 'ingresos' ? 'active' : ''}`} onClick={() => navFin2('ingresos')}>› Ingresos</div>
                                <div className={`nsub ${modulo === 'finanzas' && finTab === 'gastos' ? 'active' : ''}`} onClick={() => navFin2('gastos')}>› Gastos</div>
                                <div className={`nsub ${modulo === 'finanzas' && finTab === 'salarios' ? 'active' : ''}`} onClick={() => navFin2('salarios')}>› Salarios</div>
                                <div className={`nsub ${modulo === 'finanzas' && finTab === 'pagos' ? 'active' : ''}`} onClick={() => navFin2('pagos')}>› Pagos Clientes</div>
                            </div>

                            <div className={`ni ${modulo === 'faenas' ? 'active' : ''}`} onClick={() => ir('faenas')}>
                                <span className="ico"><Briefcase size={18} /></span><span className="sb-label">Periodos</span>
                            </div>

                            <div className={`ni ${modulo === 'operadores' ? 'active' : ''}`} onClick={() => ir('operadores')}>
                                <span className="ico"><HardHat size={18} /></span><span className="sb-label">Operadores</span>
                            </div>
                            <div className={`ni ${modulo === 'mantenimientos' ? 'active' : ''}`} onClick={() => ir('mantenimientos')}>
                                <span className="ico"><Wrench size={18} /></span><span className="sb-label">Mantenimientos</span>
                            </div>
                            <div className={`ni ${modulo === 'reportes' ? 'active' : ''}`} onClick={() => ir('reportes')}>
                                <span className="ico"><FileText size={18} /></span><span className="sb-label">Reportes</span>
                            </div>
                            <div className={`ni ${modulo === 'combustible' ? 'active' : ''}`} onClick={() => ir('combustible')}>
                                <span className="ico"><Fuel size={18} /></span><span className="sb-label">Combustible</span>
                            </div>
                            <div className={`ni ${modulo === 'mapa' ? 'active' : ''}`} onClick={() => ir('mapa')}>
                                <span className="ico"><Map size={18} /></span><span className="sb-label">Mapa</span>
                            </div>
                        </nav>

                        <button className="dark-btn" onClick={toggleDark}>
                            <span className="ico">{darkMode ? <Sun size={17} /> : <Moon size={17} />}</span>
                            <span className="sb-label">{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>
                        </button>
                        <button className="btn-exit" onClick={logout}>
                            <span><LogOut size={16} /></span><span className="sb-label">Cerrar sesión</span>
                        </button>
                    </div>

                    <div className="main">
                        {renderModulo()}
                    </div>
                </div>
            )}

            <div className="toast-wrap">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast ${t.tipo}`}>
                        <span>{t.tipo === 's' ? <CheckCircle size={16} /> : t.tipo === 'e' ? <XCircle size={16} /> : <Info size={16} />}</span>
                        {t.msg}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export default App;
