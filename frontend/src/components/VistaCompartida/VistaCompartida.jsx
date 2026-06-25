import { useEffect, useState } from 'react';
import { getDatosPublicos } from '../../api';
import { Tractor, Wrench, Lock, TrendingUp, TrendingDown, DollarSign, Briefcase, Receipt, Search } from 'lucide-react';
import { GiBulldozer } from 'react-icons/gi';
import { TbBackhoe } from 'react-icons/tb';

const fmt = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const fmtFecha = (f) => f ? new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const estadoClass = (e) => e === 'Activa' ? 'ea' : e === 'En mantenimiento' ? 'em' : 'ef';

const IcoMaquina = ({ tipo, size = 22 }) => {
    if (tipo === 'Excavadora') return <TbBackhoe size={size} />;
    if (tipo === 'Bulldozer')  return <GiBulldozer size={size} />;
    return <Tractor size={size} />;
};

export default function VistaCompartida({ token }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [buscarGas, setBuscarGas] = useState('');

    useEffect(() => {
        getDatosPublicos(token)
            .then(d => { setDatos(d); setCargando(false); })
            .catch(() => { setError('Enlace inválido o revocado.'); setCargando(false); });
    }, [token]);

    if (cargando) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px', background: '#f5f7fa' }}>
            <GiBulldozer size={48} color="#f5a623" />
            <p style={{ color: '#6b7a8d', fontFamily: 'Inter, sans-serif' }}>Cargando vista compartida…</p>
        </div>
    );

    if (error) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px', background: '#f5f7fa' }}>
            <Lock size={48} color="#e74c3c" />
            <p style={{ color: '#e74c3c', fontWeight: '600', fontFamily: 'Inter, sans-serif' }}>{error}</p>
            <p style={{ color: '#9aa5b4', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Este enlace puede haber expirado o ser incorrecto.</p>
        </div>
    );

    const { nombre, maquina, resumen, faenas, gastos = [], mantenimientos } = datos;
    const utilPos = resumen.utilidadNeta >= 0;

    return (
        <div style={{ minHeight: '100vh', background: '#f5f7fa', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ background: '#1a2d42', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <GiBulldozer size={26} color="#f5a623" />
                    <span style={{ color: '#fff', fontWeight: '700', fontSize: '18px' }}>
                        Maqui<span style={{ color: '#f5a623' }}>Control</span>
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '20px' }}>
                    <Lock size={12} color="#9aa5b4" />
                    <span style={{ color: '#9aa5b4', fontSize: '12px', fontWeight: '500' }}>Solo lectura</span>
                </div>
            </div>

            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>
                {/* Nombre del enlace y máquina */}
                <div style={{ marginBottom: '24px' }}>
                    <p style={{ color: '#9aa5b4', fontSize: '13px', marginBottom: '4px' }}>{nombre}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#f5a623', borderRadius: '10px', padding: '10px', color: '#fff', display: 'flex' }}>
                            <IcoMaquina tipo={maquina.tipo} size={24} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '22px', color: '#1a2d42', fontWeight: '700' }}>{maquina.nombre}</h1>
                            <p style={{ margin: '2px 0 0', color: '#6b7a8d', fontSize: '13px' }}>
                                {maquina.tipo} · {maquina.placa} · {(maquina.horometroActual || 0).toLocaleString('es-CO')} hrs
                                <span style={{ marginLeft: '10px' }} className={estadoClass(maquina.estado)}>
                                    <span className="ed" /> {maquina.estado}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tarjetas resumen */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                    <SummaryCard icon={<TrendingUp size={18} color="#27ae60" />} label="Total Ingresos" value={fmt(resumen.totalIngresos)} color="#27ae60" />
                    <SummaryCard icon={<TrendingDown size={18} color="#e74c3c" />} label="Total Gastos" value={fmt(resumen.totalGastos)} color="#e74c3c" />
                    <SummaryCard
                        icon={<DollarSign size={18} color={utilPos ? '#2980b9' : '#e74c3c'} />}
                        label="Utilidad neta"
                        value={fmt(resumen.utilidadNeta)}
                        color={utilPos ? '#2980b9' : '#e74c3c'}
                    />
                    <SummaryCard icon={<Briefcase size={18} color="#8e44ad" />} label="Periodos" value={resumen.totalFaenas} color="#8e44ad" />
                </div>

                {/* Tabla de periodos */}
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Briefcase size={16} color="#1a2d42" />
                        <span style={{ fontWeight: '700', color: '#1a2d42', fontSize: '14px' }}>Periodos de trabajo</span>
                    </div>
                    {faenas.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#9aa5b4', padding: '32px', fontSize: '13px' }}>Sin periodos registrados</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        {['Obra / Cliente', 'Inicio', 'Fin', 'Estado', 'Ingresos', 'Gastos', 'Utilidad'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7a8d', fontWeight: '600', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {faenas.map((f, i) => (
                                        <tr key={f.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                            <td style={{ padding: '10px 14px', color: '#1a2d42' }}>
                                                <div style={{ fontWeight: '600' }}>{f.nombreObra || '—'}</div>
                                                <div style={{ color: '#9aa5b4', fontSize: '11px' }}>{f.cliente || ''}</div>
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#6b7a8d', whiteSpace: 'nowrap' }}>{fmtFecha(f.fechaInicio)}</td>
                                            <td style={{ padding: '10px 14px', color: '#6b7a8d', whiteSpace: 'nowrap' }}>{fmtFecha(f.fechaFin)}</td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{
                                                    background: f.estado === 'activa' ? '#e8f8f0' : '#f0f4f8',
                                                    color: f.estado === 'activa' ? '#27ae60' : '#6b7a8d',
                                                    padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600'
                                                }}>
                                                    {f.estado === 'activa' ? 'Activo' : 'Cerrado'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#27ae60', fontWeight: '600', whiteSpace: 'nowrap' }}>{fmt(f.totalIngresos)}</td>
                                            <td style={{ padding: '10px 14px', color: '#e74c3c', fontWeight: '600', whiteSpace: 'nowrap' }}>{fmt(f.totalGastos)}</td>
                                            <td style={{ padding: '10px 14px', fontWeight: '700', whiteSpace: 'nowrap', color: f.utilidadNeta >= 0 ? '#2980b9' : '#e74c3c' }}>{fmt(f.utilidadNeta)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Historial de gastos */}
                <GastosSection gastos={gastos} buscar={buscarGas} setBuscar={setBuscarGas} />

                {/* Últimos mantenimientos */}
                {mantenimientos.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Wrench size={16} color="#1a2d42" />
                            <span style={{ fontWeight: '700', color: '#1a2d42', fontSize: '14px' }}>Últimos mantenimientos</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        {['Fecha', 'Tipo', 'Descripción', 'Costo', 'Horómetro'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7a8d', fontWeight: '600', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {mantenimientos.map((mt, i) => (
                                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                            <td style={{ padding: '10px 14px', color: '#6b7a8d', whiteSpace: 'nowrap' }}>{fmtFecha(mt.fecha)}</td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{
                                                    background: mt.tipo === 'Preventivo' ? '#e8f8f0' : '#fff4e5',
                                                    color: mt.tipo === 'Preventivo' ? '#27ae60' : '#e67e22',
                                                    padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600'
                                                }}>{mt.tipo}</span>
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#1a2d42' }}>{mt.descripcion}</td>
                                            <td style={{ padding: '10px 14px', color: '#e74c3c', fontWeight: '600', whiteSpace: 'nowrap' }}>{fmt(mt.costo)}</td>
                                            <td style={{ padding: '10px 14px', color: '#6b7a8d', whiteSpace: 'nowrap' }}>{(mt.horometro || 0).toLocaleString('es-CO')} hrs</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <p style={{ textAlign: 'center', color: '#c8d6e5', fontSize: '11px', marginTop: '32px' }}>
                    Vista de solo lectura generada por MaquiControl · Los datos son confidenciales
                </p>
            </div>
        </div>
    );
}

const CATEGORIA_COLORS = {
    'Repuestos':   { bg: '#e8f0fb', color: '#2563eb' },
    'Lubricantes': { bg: '#f3e8fb', color: '#7c3aed' },
    'Combustible': { bg: '#fff4e5', color: '#e67e22' },
    'Reparación':  { bg: '#fdecea', color: '#e74c3c' },
    'Otros':       { bg: '#f0f4f8', color: '#6b7a8d' },
};

function GastosSection({ gastos, buscar, setBuscar }) {
    const q = buscar.toLowerCase();
    const filtrados = gastos.filter(g =>
        (g.descripcion || '').toLowerCase().includes(q) ||
        (g.categoria || '').toLowerCase().includes(q)
    );
    const totalFiltrado = filtrados.reduce((s, g) => s + (g.monto || 0), 0);

    return (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Receipt size={16} color="#1a2d42" />
                    <span style={{ fontWeight: '700', color: '#1a2d42', fontSize: '14px' }}>Historial de gastos</span>
                    <span style={{ background: '#f0f4f8', color: '#6b7a8d', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px' }}>
                        {gastos.length}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', minWidth: '200px' }}>
                    <Search size={13} color="#9aa5b4" />
                    <input
                        value={buscar}
                        onChange={e => setBuscar(e.target.value)}
                        placeholder="Buscar por descripción o categoría…"
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#1a2d42', width: '100%' }}
                    />
                </div>
            </div>

            {gastos.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9aa5b4', padding: '32px', fontSize: '13px' }}>Sin gastos registrados</p>
            ) : filtrados.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9aa5b4', padding: '32px', fontSize: '13px' }}>Sin resultados para "{buscar}"</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                {['Fecha', 'Descripción', 'Categoría', 'Monto'].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7a8d', fontWeight: '600', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.map((g, i) => {
                                const c = CATEGORIA_COLORS[g.categoria] || CATEGORIA_COLORS['Otros'];
                                return (
                                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                        <td style={{ padding: '10px 14px', color: '#6b7a8d', whiteSpace: 'nowrap' }}>{fmtFecha(g.fecha)}</td>
                                        <td style={{ padding: '10px 14px', color: '#1a2d42' }}>{g.descripcion || '—'}</td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                                                {g.categoria || '—'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 14px', color: '#e74c3c', fontWeight: '600', whiteSpace: 'nowrap' }}>{fmt(g.monto)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                <td colSpan={3} style={{ padding: '10px 14px', fontWeight: '700', color: '#1a2d42', fontSize: '13px' }}>
                                    {buscar ? `Total filtrado (${filtrados.length} de ${gastos.length})` : `Total (${gastos.length} gastos)`}
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: '700', color: '#e74c3c', whiteSpace: 'nowrap' }}>{fmt(totalFiltrado)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

function SummaryCard({ icon, label, value, color }) {
    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {icon}
                <span style={{ fontSize: '12px', color: '#6b7a8d', fontWeight: '500' }}>{label}</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color }}>{value}</div>
        </div>
    );
}
