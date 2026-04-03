import { useState } from 'react';
import Dashboard from './components/Dashboard/Dashboard';
import Maquinaria from './components/Maquinaria/Maquinaria';
import Finanzas from './components/Finanzas/Finanzas';
import Operadores from './components/Operadores/Operadores';
import Mantenimientos from './components/Mantenimientos/Mantenimientos';
import Combustible from './components/Combustible/Combustible';
import Reportes from './components/Reportes/Reportes';
import { ToastContext, useToastState } from './utils/toast';
import './App.css';

function App() {
    const [modulo, setModulo] = useState('dashboard');
    const { toasts, toast }   = useToastState();
    const [finOpen, setFinOpen] = useState(false);
    const [finTab, setFinTab]   = useState('ingresos');
    const [maqVista, setMaqVista] = useState('lista');

    const navFin = (tab) => { setModulo('finanzas'); setFinOpen(true); setFinTab(tab); };
    const irNuevaMaquina = () => { setMaqVista('nueva'); setModulo('maquinaria'); };
    const irMaquinaria   = () => { setMaqVista('lista'); setModulo('maquinaria'); };

    const renderModulo = () => {
        switch (modulo) {
            case 'dashboard':      return <Dashboard onIrMaquinaria={irMaquinaria} onNuevaMaquina={irNuevaMaquina} />;
            case 'maquinaria':     return <Maquinaria vistaInicial={maqVista} key={`maq-${maqVista}`} />;
            case 'finanzas':       return <Finanzas tabInicial={finTab} />;
            case 'operadores':     return <Operadores />;
            case 'mantenimientos': return <Mantenimientos />;
            case 'combustible':    return <Combustible />;
            case 'reportes':       return <Reportes />;
            default:               return <Dashboard />;
        }
    };

    return (
        <ToastContext.Provider value={toast}>
            <div className="app">
                <div className="sb">
                    <div className="sb-head">
                        <div>
                            <div className="logo">Maqui<span>Control</span></div>
                            <div className="sb-badge">Dueño</div>
                        </div>
                    </div>

                    <div className="sb-user">
                        <div className="av">A</div>
                        <div className="sb-uinfo">
                            <p>Alejandro</p>
                            <span>dueño@mail.com</span>
                        </div>
                    </div>

                    <nav className="nav">
                        <div className="ns">Principal</div>
                        <div className={`ni ${modulo === 'dashboard' ? 'active' : ''}`} onClick={() => setModulo('dashboard')}>
                            <span className="ico">📊</span><span className="sb-label">Dashboard</span>
                        </div>

                        <div className="ns">Gestión</div>
                        <div className={`ni ${modulo === 'maquinaria' ? 'active' : ''}`} onClick={irMaquinaria}>
                            <span className="ico">🚜</span><span className="sb-label">Maquinaria</span>
                        </div>

                        <div className={`ni ${modulo === 'finanzas' ? 'active' : ''} ${finOpen ? 'exp' : ''}`}
                            onClick={() => { setModulo('finanzas'); setFinOpen(!finOpen); }}>
                            <span className="ico">💰</span><span className="sb-label">Finanzas</span>
                            <span className="arr">›</span>
                        </div>
                        <div className={`ng ${finOpen ? 'open' : ''}`}>
                            <div className={`nsub ${modulo === 'finanzas' && finTab === 'ingresos' ? 'active' : ''}`} onClick={() => navFin('ingresos')}>› Ingresos</div>
                            <div className={`nsub ${modulo === 'finanzas' && finTab === 'gastos' ? 'active' : ''}`} onClick={() => navFin('gastos')}>› Gastos</div>
                            <div className={`nsub ${modulo === 'finanzas' && finTab === 'salarios' ? 'active' : ''}`} onClick={() => navFin('salarios')}>› Salarios</div>
                            <div className={`nsub ${modulo === 'finanzas' && finTab === 'pagos' ? 'active' : ''}`} onClick={() => navFin('pagos')}>› Pagos Clientes</div>
                        </div>

                        <div className={`ni ${modulo === 'operadores' ? 'active' : ''}`} onClick={() => setModulo('operadores')}>
                            <span className="ico">👷</span><span className="sb-label">Operadores</span>
                        </div>
                        <div className={`ni ${modulo === 'mantenimientos' ? 'active' : ''}`} onClick={() => setModulo('mantenimientos')}>
                            <span className="ico">🔧</span><span className="sb-label">Mantenimientos</span>
                        </div>
                        <div className={`ni ${modulo === 'reportes' ? 'active' : ''}`} onClick={() => setModulo('reportes')}>
                            <span className="ico">📄</span><span className="sb-label">Reportes</span>
                        </div>
                        <div className={`ni ${modulo === 'combustible' ? 'active' : ''}`} onClick={() => setModulo('combustible')}>
                            <span className="ico">⛽</span><span className="sb-label">Combustible</span>
                        </div>
                    </nav>

                    <button className="btn-exit">
                        <span>⬅</span><span className="sb-label">Cerrar Sesión</span>
                    </button>
                </div>

                <div className="main">
                    {renderModulo()}
                </div>
            </div>

            {/* TOASTS */}
            <div className="toast-wrap">
                {toasts.map(t => (
                    <div key={t.id} className={`toast ${t.tipo}`}>
                        <span>{t.tipo === 's' ? '✅' : t.tipo === 'e' ? '❌' : 'ℹ️'}</span>
                        {t.msg}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export default App;
