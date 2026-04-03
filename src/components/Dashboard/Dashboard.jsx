import { useState, useEffect } from 'react';
import { getMaquinas, getIngresos, getGastos } from '../../api';
import './Dashboard.css';

function Dashboard({ onIrMaquinaria, onNuevaMaquina }) {
    const [maquinas, setMaquinas] = useState([]);
    const [ingresos, setIngresos] = useState([]);
    const [gastos, setGastos] = useState([]);

    useEffect(() => {
        getMaquinas().then(res => setMaquinas(res.data)).catch(err => console.error(err));
        getIngresos().then(res => setIngresos(res.data)).catch(err => console.error(err));
        getGastos().then(res => setGastos(res.data)).catch(err => console.error(err));
    }, []);

    const totalIngresos = ingresos.reduce((acc, i) => acc + (i.total || 0), 0);
    const totalGastos = gastos.reduce((acc, g) => acc + (g.monto || 0), 0);

    const fmt = (v) => '$' + v.toLocaleString('es-CO');

    const estadoClass = (estado) => {
        if (estado === 'Activa') return 'ea';
        if (estado === 'En mantenimiento') return 'em';
        return 'ef';
    };

    const fechaActual = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div>
                    <h1>Dashboard</h1>
                    <p>Resumen general — {fechaActual}</p>
                </div>
            </div>

            <div className="content">
                <div className="pad">

                    {/* CARDS RESUMEN */}
                    <div className="g3">
                        <div className="card gold">
                            <span className="ci">🚜</span>
                            <div className="cl">Total Máquinas</div>
                            <div className="cv">{maquinas.length}</div>
                            <div className="cs">{maquinas.filter(m => m.estado === 'Activa').length} activas</div>
                        </div>
                        <div className="card green">
                            <span className="ci">💰</span>
                            <div className="cl">Ingresos Totales</div>
                            <div className="cv">{fmt(totalIngresos)}</div>
                            <div className="cs">suma de todas las máquinas</div>
                        </div>
                        <div className="card red">
                            <span className="ci">💸</span>
                            <div className="cl">Gastos Totales</div>
                            <div className="cv">{fmt(totalGastos)}</div>
                            <div className="cs">combustible + mantenimientos</div>
                        </div>
                    </div>

                    {/* ALERTA MANTENIMIENTO */}
                    {maquinas.some(m => m.estado === 'En mantenimiento') && (
                        <div className="ale">
                            <span style={{ fontSize: '20px' }}>⚠️</span>
                            <div>
                                <p>{maquinas.filter(m => m.estado === 'En mantenimiento').map(m => m.nombre).join(', ')} — requiere atención</p>
                                <span className="ale-desc">Revisar módulo de Mantenimientos</span>
                            </div>
                        </div>
                    )}

                    {/* ACCIONES RÁPIDAS */}
                    <div className="st">Acciones Rápidas</div>
                    <div className="g3" style={{ marginBottom: '18px' }}>
                        <div className="nueva" style={{ minHeight: '70px', flexDirection: 'row', gap: '10px' }} onClick={onNuevaMaquina}>
                            <span style={{ fontSize: '20px' }}>➕</span>
                            <span style={{ fontSize: '13px', fontWeight: '600' }}>Nueva Máquina</span>
                        </div>
                        <div className="nueva" style={{ minHeight: '70px', flexDirection: 'row', gap: '10px' }} onClick={onIrMaquinaria}>
                            <span style={{ fontSize: '20px' }}>🚜</span>
                            <span style={{ fontSize: '13px', fontWeight: '600' }}>Ver Maquinaria</span>
                        </div>
                    </div>

                    {/* MIS MÁQUINAS */}
                    <div className="st">
                        Mis Máquinas
                        <a onClick={onIrMaquinaria}>Ver todas →</a>
                    </div>

                    <div className="gm">
                        {maquinas.length === 0 ? (
                            <p className="vacio">No hay máquinas registradas</p>
                        ) : (
                            maquinas.map(m => (
                                <div className="mcard" key={m.id}>
                                    <div className="mch">
                                        <div className="mci">🚜</div>
                                        <div>
                                            <div className="mcn">{m.nombre}</div>
                                            <div className="mct">{m.tipo} · {m.placa}</div>
                                        </div>
                                    </div>
                                    <div className="mcb">
                                        <div className="mcs">
                                            <span>Estado</span>
                                            <span className={estadoClass(m.estado)}>
                                                <span className="ed"></span>{m.estado}
                                            </span>
                                        </div>
                                        <div className="mcs">
                                            <span>Horómetro</span>
                                            <span>{(m.horometroActual || 0).toLocaleString('es-CO')} hrs</span>
                                        </div>
                                        <div className="mcs">
                                            <span>Operador</span>
                                            <span>{m.operadorNombre || '—'}</span>
                                        </div>
                                        <div className="mcs">
                                            <span>Valor/hora</span>
                                            <span>{fmt(m.valorHoraOperador || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

export default Dashboard;
