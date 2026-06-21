import { useState, useEffect } from 'react';
import { getMaquinas, getIngresos, getGastos, getSalarios, getFaenas, getPagos } from '../../api';
import { fmtFecha } from '../../utils/fmtFecha';
import { Tractor, TrendingUp, TrendingDown, AlertTriangle, Briefcase, BarChart2, CreditCard, Clock } from 'lucide-react';
import { GiBulldozer } from 'react-icons/gi';
import { TbBackhoe } from 'react-icons/tb';
import { useCountUp } from '../../utils/useCountUp';
import './Dashboard.css';

// #8: color único por tipo de máquina
const TIPO_COLOR = {
    'Excavadora': '#2980b9',
    'Bulldozer':  '#e67e22',
    'Volqueta':   '#8e44ad',
    'Grúa':       '#c0392b',
};
const tipoColor = (tipo) => TIPO_COLOR[tipo] || '#27ae60';

const IcoMaquina = ({ tipo, size = 22 }) => {
    if (tipo === 'Excavadora') return <TbBackhoe size={size} />;
    if (tipo === 'Bulldozer')  return <GiBulldozer size={size} />;
    return <Tractor size={size} />;
};

// Avatar circular de máquina con color por tipo
const AvatarMaquina = ({ tipo, size = 38 }) => (
    <div style={{
        width: size, height: size, borderRadius: '50%',
        background: tipoColor(tipo),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0,
    }}>
        <IcoMaquina tipo={tipo} size={size * 0.52} />
    </div>
);

// #9: número que anima desde 0 al valor objetivo
function AnimatedNumber({ value, prefix = '', suffix = '', style }) {
    const animated = useCountUp(value);
    const display  = prefix + animated.toLocaleString('es-CO') + suffix;
    return <span style={style}>{display}</span>;
}

const fmt    = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const mesHoy = () => new Date().toISOString().slice(0, 7);


function Dashboard({ onIrMaquinaria }) {
    const [maquinas,  setMaquinas]  = useState([]);
    const [ingresos,  setIngresos]  = useState([]);
    const [gastos,    setGastos]    = useState([]);
    const [salarios,  setSalarios]  = useState([]);
    const [faenas,    setFaenas]    = useState([]);
    const [pagos,     setPagos]     = useState([]);
    const [cargando,  setCargando]  = useState(true);
    const [filtroFecha, setFiltroFecha] = useState('mes');
    const [fechaDesde, setFechaDesde]   = useState('');
    const [fechaHasta, setFechaHasta]   = useState('');

    useEffect(() => {
        Promise.all([
            getMaquinas(), getIngresos(), getGastos(),
            getSalarios(), getFaenas(), getPagos(),
        ]).then(([maq, ing, gas, sal, fae, pag]) => {
            setMaquinas(maq.data);
            setIngresos(ing.data);
            setGastos(gas.data);
            setSalarios(sal.data || []);
            setFaenas(fae.data || []);
            setPagos(pag.data || []);
        }).catch(console.error)
          .finally(() => setCargando(false));
    }, []);

    const mes  = mesHoy();
    const ahora = new Date();
    const nombreMes = ahora.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    const filtrarPorFecha = (arr, campo) => {
        if (filtroFecha === 'todo') return arr;
        if (filtroFecha === 'rango') {
            return arr.filter(x => {
                const f = x[campo] || '';
                if (fechaDesde && f < fechaDesde) return false;
                if (fechaHasta && f > fechaHasta) return false;
                return true;
            });
        }
        const prefix = filtroFecha === 'mes' ? mes : filtroFecha === 'anio' ? String(ahora.getFullYear()) : null;
        return prefix ? arr.filter(x => x[campo]?.startsWith(prefix)) : arr;
    };

    const ingFiltrados = filtrarPorFecha(ingresos, 'fecha');
    const gasFiltrados = filtrarPorFecha(gastos.filter(g => g.categoria !== 'Salario'), 'fecha');
    const salFiltrados = filtrarPorFecha(salarios, 'fecha');
    const totIngMes    = ingFiltrados.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const totGasMes    = gasFiltrados.reduce((a, g) => a + (Number(g.monto) || 0), 0);
    const totSalMes    = salFiltrados.reduce((a, s) => a + (Number(s.totalNeto) || 0), 0);
    const totEgresosMes = totGasMes + totSalMes;
    const utilidadMes  = totIngMes - totEgresosMes;

    const labelFiltro = filtroFecha === 'mes' ? nombreMes
        : filtroFecha === 'anio' ? `Año ${ahora.getFullYear()}`
        : filtroFecha === 'todo' ? 'Total acumulado'
        : (fechaDesde || fechaHasta) ? `${fechaDesde || '...'} → ${fechaHasta || '...'}` : 'Rango personalizado';

    // Periodos activos
    const periodosActivos = faenas.filter(f => f.estado === 'activa');

    // Pagos pendientes
    const pagosPendientes = pagos.filter(p => p.estado !== 'Pagado' && (p.saldoPendiente || 0) > 0);
    const totalPorCobrar  = pagosPendientes.reduce((a, p) => a + (Number(p.saldoPendiente) || 0), 0);

    const estadoClass = (e) => e === 'Activa' ? 'ea' : e === 'En mantenimiento' ? 'em' : 'ef';

    if (cargando) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar"><div><h1>Dashboard</h1><p>Cargando...</p></div></div>
            <div className="content"><div className="pad">
                <div className="g3" style={{ marginBottom: '20px' }}>
                    {[1,2,3].map(i => (
                        <div className="skel-card" key={i}>
                            <div className="skel skel-line" style={{ width: '40%' }} />
                            <div className="skel skel-val" />
                            <div className="skel skel-sub" />
                        </div>
                    ))}
                </div>
                <div className="g2" style={{ marginBottom: '20px' }}>
                    {[1,2].map(i => (
                        <div className="skel-card" key={i}>
                            <div className="skel skel-line" style={{ width: '50%' }} />
                            <div className="skel skel-val" />
                            <div className="skel skel-sub" />
                        </div>
                    ))}
                </div>
            </div></div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div>
                    <h1>Dashboard</h1>
                    <p>Resumen general — {labelFiltro}</p>
                </div>
            </div>

            <div className="content"><div className="pad">

                {/* ── FILTRO PERÍODO ── */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {[
                        { key: 'mes',   label: 'Este mes' },
                        { key: 'anio',  label: 'Este año' },
                        { key: 'todo',  label: 'Todo' },
                        { key: 'rango', label: 'Personalizado' },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFiltroFecha(f.key)} style={{
                            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                            cursor: 'pointer', border: 'none',
                            background: filtroFecha === f.key ? '#1a2d42' : '#f0f2f5',
                            color: filtroFecha === f.key ? '#fff' : '#6b7a8d',
                            transition: 'all .15s',
                        }}>{f.label}</button>
                    ))}
                    {filtroFecha === 'rango' && (
                        <>
                            <input type="date" style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #dee2e6', borderRadius: '8px' }}
                                value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                            <span style={{ fontSize: '12px', color: '#6b7a8d' }}>→</span>
                            <input type="date" style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #dee2e6', borderRadius: '8px' }}
                                value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                        </>
                    )}
                </div>

                {/* ── RESUMEN PERÍODO ── */}
                <div className="st" style={{ marginTop: 0 }}>
                    Resumen — {labelFiltro}
                </div>
                <div className="g3" style={{ marginBottom: '20px' }}>
                    <div className="card green">
                        <span className="ci"><TrendingUp size={22} /></span>
                        <div className="cl">Ingresos</div>
                        <div className="cv"><AnimatedNumber value={totIngMes} prefix="$" /></div>
                        <div className="cs">{ingFiltrados.length} registros</div>
                    </div>
                    <div className="card red">
                        <span className="ci"><TrendingDown size={22} /></span>
                        <div className="cl">Egresos</div>
                        <div className="cv"><AnimatedNumber value={totEgresosMes} prefix="$" /></div>
                        <div className="cs">gastos + salarios</div>
                    </div>
                    <div className="card gold">
                        <span className="ci"><BarChart2 size={22} /></span>
                        <div className="cl">Utilidad</div>
                        <div className="cv">
                            <AnimatedNumber value={utilidadMes} prefix="$" style={{ color: utilidadMes >= 0 ? '#27ae60' : '#e74c3c' }} />
                        </div>
                        <div className="cs">ingresos − egresos</div>
                    </div>
                </div>


                {/* ── MÉTRICAS OPERATIVAS ── */}
                <div className="g2" style={{ marginBottom: '20px' }}>
                    <div className="card blue">
                        <span className="ci"><Briefcase size={22} /></span>
                        <div className="cl">En campo</div>
                        <div className="cv"><AnimatedNumber value={periodosActivos.length} /></div>
                        <div className="cs">{maquinas.length} máquinas en total · {maquinas.filter(m => m.estado === 'Activa').length} activas</div>
                    </div>
                    <div className="card" style={{ background: totalPorCobrar > 0 ? '#fff8e7' : '#f8f9fa', borderColor: totalPorCobrar > 0 ? '#f5a623' : '#dee2e6' }}>
                        <span className="ci"><CreditCard size={22} /></span>
                        <div className="cl">Por cobrar</div>
                        <div className="cv">
                            <AnimatedNumber value={totalPorCobrar} prefix="$" style={{ color: totalPorCobrar > 0 ? '#e67e22' : '#6b7a8d' }} />
                        </div>
                        <div className="cs">{pagosPendientes.length} pagos pendientes de clientes</div>
                    </div>
                </div>

                {/* ── ALERTA MANTENIMIENTO ── */}
                {maquinas.some(m => m.estado === 'En mantenimiento') && (
                    <div className="ale">
                        <AlertTriangle size={20} />
                        <div>
                            <p>{maquinas.filter(m => m.estado === 'En mantenimiento').map(m => m.nombre).join(', ')} — en mantenimiento</p>
                            <span className="ale-desc">Revisar módulo de Mantenimientos</span>
                        </div>
                    </div>
                )}

                {/* ── MÁQUINAS EN CAMPO ── */}
                {periodosActivos.length > 0 && (
                    <>
                        <div className="st">
                            Máquinas en campo
                            <span style={{ fontSize: '11px', fontWeight: '400', color: '#6b7a8d' }}>({periodosActivos.length} periodos activos)</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                            {periodosActivos.map(f => {
                                const ingF = ingresos.filter(i => String(i.faenaId) === String(f.id)).reduce((a, i) => a + (Number(i.total) || 0), 0);
                                const gasF = gastos.filter(g => String(g.faenaId) === String(f.id)).reduce((a, g) => a + (Number(g.monto) || 0), 0);
                                return (
                                    <div key={f.id} style={{ background: '#fff8e7', border: '1px solid #f5a623', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27ae60', display: 'inline-block', flexShrink: 0 }}></span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: '700', fontSize: '13px' }}>{f.maquinaNombre}</div>
                                            <div style={{ fontSize: '12px', color: '#6b7a8d' }}>{f.nombreObra}{f.cliente ? ` — ${f.cliente}` : ''}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '10px', color: '#6b7a8d' }}>Ingresos</div>
                                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#27ae60' }}>{fmt(ingF)}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '10px', color: '#6b7a8d' }}>Gastos</div>
                                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#e74c3c' }}>{fmt(gasF)}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '10px', color: '#6b7a8d' }}>Desde</div>
                                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a2d42', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <Clock size={11} /> {fmtFecha(f.fechaInicio)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* ── MIS MÁQUINAS ── */}
                <div className="st">
                    Mis Máquinas
                    <a onClick={onIrMaquinaria}>Ver todas →</a>
                </div>
                <div className="gm">
                    {maquinas.length === 0 ? (
                        <p className="vacio">No hay máquinas registradas</p>
                    ) : (
                        maquinas.map(m => {
                            const periodo = periodosActivos.find(f => f.maquinaNombre === m.nombre);
                            return (
                                <div className="mcard" key={m.id}>
                                    <div className="mch">
                                        <AvatarMaquina tipo={m.tipo} size={40} />
                                        <div>
                                            <div className="mcn">{m.nombre}</div>
                                            <div className="mct" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tipoColor(m.tipo), display: 'inline-block' }}></span>
                                                {m.tipo} · {m.placa}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mcb">
                                        <div className="mcs">
                                            <span>Estado</span>
                                            <span className={estadoClass(m.estado)}><span className="ed"></span>{m.estado}</span>
                                        </div>
                                        <div className="mcs">
                                            <span>Periodo</span>
                                            {periodo
                                                ? <span className="b ok" style={{ fontSize: '11px' }}>{periodo.nombreObra}</span>
                                                : <span style={{ color: '#9aa5b4', fontSize: '12px' }}>Sin periodo activo</span>
                                            }
                                        </div>
                                        <div className="mcs">
                                            <span>Horómetro</span>
                                            <span>{(m.horometroActual || 0).toLocaleString('es-CO')} hrs</span>
                                        </div>
                                        <div className="mcs">
                                            <span>Operador</span>
                                            <span>{m.operadorNombre || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

            </div></div>
        </div>
    );
}

export default Dashboard;
