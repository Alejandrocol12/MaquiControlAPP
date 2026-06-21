import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard/Dashboard';
import Maquinaria from './components/Maquinaria/Maquinaria';
import Finanzas from './components/Finanzas/Finanzas';
import Operadores from './components/Operadores/Operadores';
import PortalOperador from './components/Operadores/PortalOperador';
import Mantenimientos from './components/Mantenimientos/Mantenimientos';
import Combustible from './components/Combustible/Combustible';
import Reportes from './components/Reportes/Reportes';
import Faenas from './components/Faenas/Faenas';
import { apiLogin, apiRegister } from './api';
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
    ShieldCheck,
    UserPlus,
    ArrowRight,
    KeyRound,
    ChevronLeft,
    ChevronRight,
    Menu,
    Briefcase,
} from 'lucide-react';
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

function AuthScreen({ onLogin, onRegister }) {
    const [vista, setVista] = useState('login');
    const [loginForm, setLoginForm] = useState({ email: 'dueño@mail.com', password: '123456' });
    const [registerForm, setRegisterForm] = useState({
        nombre: '',
        empresa: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    return (
        <div className="auth-shell">
            <section className="auth-hero">
                <div className="auth-brand">Maqui<span>Control</span></div>
                <div className="auth-kicker">Control operativo para maquinaria pesada</div>
                <h1>Administra maquinas, costos, personal y reportes desde una sola cabina.</h1>
                <p>

                </p>

                <div className="auth-feature-list">
                    <div className="auth-feature">
                        <ShieldCheck size={18} />
                        <span>Acceso privado por cuenta</span>
                    </div>
                    <div className="auth-feature">
                        <BarChart2 size={18} />
                        <span>Vista ejecutiva y financiera centralizada</span>
                    </div>
                    <div className="auth-feature">
                        <Tractor size={18} />
                        <span>Operacion conectada con maquinaria y operadores</span>
                    </div>
                    <div className="auth-feature">
                        <HardHat size={18} />
                        <span>Vista separada para administrador y operador</span>
                    </div>
                </div>

                <div className="auth-demo">

                </div>
            </section>

            <section className="auth-panel">
                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${vista === 'login' ? 'active' : ''}`}
                        onClick={() => setVista('login')}
                    >
                        <KeyRound size={15} /> Iniciar sesion
                    </button>
                    <button
                        className={`auth-tab ${vista === 'register' ? 'active' : ''}`}
                        onClick={() => setVista('register')}
                    >
                        <UserPlus size={15} /> Crear cuenta
                    </button>
                </div>

                {vista === 'login' ? (
                    <form className="auth-card" onSubmit={(e) => { e.preventDefault(); onLogin(loginForm); }}>
                        <div className="auth-copy">
                            <h2>Bienvenido de nuevo</h2>
                            <p>Entra y retoma el control de tu operacion.</p>
                        </div>

                        <label className="fl">Correo</label>
                        <input
                            className="fi auth-input"
                            type="email"
                            value={loginForm.email}
                            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                            placeholder="dueno@mail.com"
                        />

                        <label className="fl">Contrasena</label>
                        <input
                            className="fi auth-input"
                            type="password"
                            value={loginForm.password}
                            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                            placeholder="Minimo 6 caracteres"
                        />

                        <button className="auth-submit" type="submit">
                            Entrar <ArrowRight size={15} />
                        </button>
                    </form>
                ) : (
                    <form className="auth-card" onSubmit={(e) => { e.preventDefault(); onRegister(registerForm); }}>
                        <div className="auth-copy">
                            <h2>Crear cuenta</h2>
                            <p>Lista una base de autenticacion para mostrar el producto.</p>
                        </div>

                        <div className="fg2 auth-grid">
                            <div>
                                <label className="fl">Nombre</label>
                                <input
                                    className="fi auth-input"
                                    value={registerForm.nombre}
                                    onChange={(e) => setRegisterForm({ ...registerForm, nombre: e.target.value })}
                                    placeholder="Alejandro Ruiz"
                                />
                            </div>
                            <div>
                                <label className="fl">Empresa</label>
                                <input
                                    className="fi auth-input"
                                    value={registerForm.empresa}
                                    onChange={(e) => setRegisterForm({ ...registerForm, empresa: e.target.value })}
                                    placeholder="MaquiControl SAS"
                                />
                            </div>
                        </div>

                        <label className="fl">Correo</label>
                        <input
                            className="fi auth-input"
                            type="email"
                            value={registerForm.email}
                            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                            placeholder="correo@empresa.com"
                        />

                        <div className="fg2 auth-grid">
                            <div>
                                <label className="fl">Contrasena</label>
                                <input
                                    className="fi auth-input"
                                    type="password"
                                    value={registerForm.password}
                                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                                    placeholder="Minimo 6 caracteres"
                                />
                            </div>
                            <div>
                                <label className="fl">Confirmar</label>
                                <input
                                    className="fi auth-input"
                                    type="password"
                                    value={registerForm.confirmPassword}
                                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                                    placeholder="Repite la contrasena"
                                />
                            </div>
                        </div>

                        <button className="auth-submit" type="submit">
                            Crear cuenta <ArrowRight size={15} />
                        </button>
                    </form>
                )}
            </section>
        </div>
    );
}

function App() {
    const [modulo, setModulo] = useState('dashboard');
    const { toasts, toast } = useToastState();
    const [finOpen, setFinOpen] = useState(false);
    const [finTab, setFinTab] = useState('ingresos');
    const [maqVista, setMaqVista] = useState('lista');
    const [user, setUser] = useState(null);
    const [sbCol, setSbCol] = useState(false);
    const [sbMob, setSbMob] = useState(false);

    const ir = (mod) => { setModulo(mod); setSbMob(false); };
    const navFin2 = (tab) => { navFin(tab); setSbMob(false); };

    useEffect(() => {
        setUser(getStoredSession());
    }, []);

    const navFin = (tab) => { setModulo('finanzas'); setFinOpen(true); setFinTab(tab); };
    const irNuevaMaquina = () => { setMaqVista('nueva'); setModulo('maquinaria'); };
    const irMaquinaria = () => { setMaqVista('lista'); setModulo('maquinaria'); };

    const login = async ({ email, password }) => {
        try {
            const { data } = await apiLogin({ email, password });
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data));
            setUser(data.user);
            toast(`Bienvenido, ${data.user.nombre}`, 's');
        } catch (err) {
            toast(err.response?.data?.error || 'Correo o contrasena incorrectos', 'e');
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
            default: return <Dashboard onIrMaquinaria={irMaquinaria} onNuevaMaquina={irNuevaMaquina} />;
        }
    };

    return (
        <ToastContext.Provider value={toast}>
            {!user ? (
                <AuthScreen onLogin={login} onRegister={register} />
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

                        <div className="sb-user">
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
                        </nav>

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
