import { useEffect, useState } from 'react';
import { getDatosPublicos, registrarVista } from '../../api';
import { Tractor, Wrench, Lock, TrendingUp, Briefcase, Receipt, Search, Clock, User } from 'lucide-react';
import { GiBulldozer } from 'react-icons/gi';
import { TbBackhoe } from 'react-icons/tb';
import './VistaCompartida.css';

const fmt = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const fmtFecha = (f) => f ? new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const TIPO_COLOR = { 'Excavadora': '#2980b9', 'Bulldozer': '#e67e22', 'Volqueta': '#8e44ad', 'Grúa': '#c0392b' };
const tipoColor = (tipo) => TIPO_COLOR[tipo] || '#27ae60';

const CATEGORIA_CLASE = { 'Reparación': 'info', 'Repuestos': 'gold', 'Combustible': 'orange', 'Mantenimiento': 'golddeep', 'Lubricantes': 'purple', 'Otros': 'neutral', 'Otro': 'neutral' };
const claseCategoria = (cat) => CATEGORIA_CLASE[cat] || 'neutral';

const IcoMaquina = ({ tipo, size = 22 }) => {
    if (tipo === 'Excavadora') return <TbBackhoe size={size} />;
    if (tipo === 'Bulldozer')  return <GiBulldozer size={size} />;
    return <Tractor size={size} />;
};

const generarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const obtenerVisitanteId = (token) => {
    const key = `mc_visitante_id_${token}`;
    let id = localStorage.getItem(key);
    if (!id) { id = generarId(); localStorage.setItem(key, id); }
    return id;
};

export default function VistaCompartida({ token }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [buscarGas, setBuscarGas] = useState('');
    const [buscarIng, setBuscarIng] = useState('');

    const nombreGuardado = localStorage.getItem(`mc_visitante_${token}`);
    const [mostrarPrompt, setMostrarPrompt] = useState(!nombreGuardado);
    const [nombreInput, setNombreInput] = useState('');
    const visitanteId = obtenerVisitanteId(token);

    useEffect(() => {
        const prev = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'auto';
        document.body.style.overflow = 'auto';
        return () => {
            document.documentElement.style.overflow = prev;
            document.body.style.overflow = '';
        };
    }, []);

    useEffect(() => {
        getDatosPublicos(token)
            .then(d => { setDatos(d); setCargando(false); })
            .catch(() => { setError('Enlace inválido o revocado.'); setCargando(false); });
    }, [token]);

    useEffect(() => {
        // Si ya sabemos el nombre de este visitante (o que prefirió no darlo), registra la
        // visita en silencio sin volver a preguntarle cada vez que abre el mismo enlace.
        if (nombreGuardado) {
            registrarVista(token, nombreGuardado === '__anon__' ? '' : nombreGuardado, visitanteId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const confirmarNombre = (nombre) => {
        const limpio = nombre.trim();
        localStorage.setItem(`mc_visitante_${token}`, limpio || '__anon__');
        registrarVista(token, limpio, visitanteId);
        setMostrarPrompt(false);
    };

    if (cargando) return (
        <div className="vc-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
            <GiBulldozer size={48} color="#f5a623" />
            <p style={{ color: '#6b7a8d' }}>Cargando vista compartida…</p>
        </div>
    );

    if (error) return (
        <div className="vc-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
            <Lock size={48} color="#e74c3c" />
            <p style={{ color: '#e74c3c', fontWeight: '700' }}>{error}</p>
            <p style={{ color: '#93a2b3', fontSize: '13px' }}>Este enlace puede haber expirado o ser incorrecto.</p>
        </div>
    );

    const { nombre, periodoNombre, maquina, resumen, faenas, ingresos = [], gastos = [], mantenimientos } = datos;
    const estadoTono = maquina.estado === 'Activa' ? 'ok' : maquina.estado === 'En mantenimiento' ? 'warn' : 'off';

    return (
        <div className="vc-root">
            {mostrarPrompt && (
                <div className="vc-modal-mask">
                    <div className="vc-modal">
                        <User size={30} color="#f5a623" />
                        <h3>¿Cómo te llamas?</h3>
                        <p>Para que {nombre || 'quien te compartió esto'} sepa que revisaste la información.</p>
                        <input
                            autoFocus
                            placeholder="Tu nombre"
                            value={nombreInput}
                            onChange={e => setNombreInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && confirmarNombre(nombreInput)}
                        />
                        <button className="vc-modal-btn" onClick={() => confirmarNombre(nombreInput)} disabled={!nombreInput.trim()}>
                            Continuar
                        </button>
                        <button className="vc-modal-skip" onClick={() => confirmarNombre('')}>
                            Prefiero no decirlo
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="vc-header">
                <div className="vc-brand">
                    <GiBulldozer size={24} color="#f5a623" />
                    Maqui<span>Control</span>
                </div>
                <div className="vc-lock"><Lock size={12} /> Solo lectura</div>
            </div>

            <div className="vc-wrap">
                <p className="vc-linklabel">{nombre}</p>

                {/* Identidad de la máquina */}
                <div className="vc-identity">
                    <div className="vc-identity-ico" style={{ background: tipoColor(maquina.tipo) }}>
                        <IcoMaquina tipo={maquina.tipo} size={26} />
                    </div>
                    <div>
                        <h1>{maquina.nombre}</h1>
                        <div className="vc-identity-meta">
                            <span>{maquina.tipo} · {maquina.placa} · {(maquina.horometroActual || 0).toLocaleString('es-CO')} hrs</span>
                            <span className={`vc-pill ${estadoTono}`}><i></i>{maquina.estado}</span>
                        </div>
                        {periodoNombre && (
                            <div className="vc-periodo-tag"><Briefcase size={11} /> Mostrando solo el periodo: {periodoNombre}</div>
                        )}
                    </div>
                </div>

                {/* KPI principales */}
                <div className="vc-hero">
                    <div className="vc-kpi good">
                        <div className="vc-kpi-label">Total ingresos</div>
                        <div className="vc-kpi-val vc-num">{fmt(resumen.totalIngresos)}</div>
                    </div>
                    <div className="vc-kpi bad">
                        <div className="vc-kpi-label">Total gastos</div>
                        <div className="vc-kpi-val vc-num">{fmt(resumen.totalGastos)}</div>
                    </div>
                    <div className="vc-kpi profit">
                        <div className="vc-kpi-label">Utilidad neta</div>
                        <div className="vc-kpi-val vc-num">{fmt(resumen.utilidadNeta)}</div>
                    </div>
                </div>
                <div className="vc-mini2">
                    <div className="vc-mini2-tile"><span className="l"><Briefcase size={13} /> Periodos</span><span className="v">{resumen.totalFaenas}</span></div>
                    <div className="vc-mini2-tile"><span className="l"><Clock size={13} /> Horas del periodo</span><span className="v">{(resumen.totalHoras || 0).toLocaleString('es-CO')}</span></div>
                </div>

                {/* Periodos */}
                <div className="vc-panel">
                    <div className="vc-panel-head">
                        <div className="vc-panel-title"><Briefcase size={16} />Periodos de trabajo</div>
                    </div>
                    {faenas.length === 0 ? (
                        <div className="vc-empty">Sin periodos registrados</div>
                    ) : (
                        <div className="vc-scrollx">
                            <table className="vc-table">
                                <thead><tr>{['Obra / Cliente', 'Inicio', 'Fin', 'Estado', 'Ingresos', 'Gastos', 'Utilidad'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {faenas.map(f => (
                                        <tr key={f.id}>
                                            <td><div style={{ fontWeight: 600 }}>{f.nombreObra || '—'}</div><div style={{ color: 'var(--vc-ink-faint)', fontSize: '11px' }}>{f.cliente || ''}</div></td>
                                            <td style={{ whiteSpace: 'nowrap', color: 'var(--vc-ink-soft)' }}>{fmtFecha(f.fechaInicio)}</td>
                                            <td style={{ whiteSpace: 'nowrap', color: 'var(--vc-ink-soft)' }}>{fmtFecha(f.fechaFin)}</td>
                                            <td><span className={`vc-pill ${f.estado === 'activa' ? 'ok' : 'off'}`}><i></i>{f.estado === 'activa' ? 'Activo' : 'Cerrado'}</span></td>
                                            <td className="vc-money pos">{fmt(f.totalIngresos)}</td>
                                            <td className="vc-money neg">{fmt(f.totalGastos)}</td>
                                            <td className={`vc-money ${f.utilidadNeta >= 0 ? 'mut' : 'neg'}`}>{fmt(f.utilidadNeta)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <IngresosSection ingresos={ingresos} buscar={buscarIng} setBuscar={setBuscarIng} />
                <GastosSection gastos={gastos} buscar={buscarGas} setBuscar={setBuscarGas} />

                {mantenimientos.length > 0 && (
                    <div className="vc-panel">
                        <div className="vc-panel-head">
                            <div className="vc-panel-title"><Wrench size={16} />Últimos mantenimientos</div>
                        </div>
                        <div className="vc-scrollx">
                            <table className="vc-table">
                                <thead><tr>{['Fecha', 'Tipo', 'Descripción', 'Costo', 'Horómetro'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {mantenimientos.map((mt, i) => (
                                        <tr key={i}>
                                            <td style={{ whiteSpace: 'nowrap', color: 'var(--vc-ink-soft)' }}>{fmtFecha(mt.fecha)}</td>
                                            <td><span className={`vc-pill ${mt.tipo === 'Preventivo' ? 'ok' : 'warn'}`}><i></i>{mt.tipo}</span></td>
                                            <td>{mt.descripcion}</td>
                                            <td className="vc-money neg">{fmt(mt.costo)}</td>
                                            <td style={{ whiteSpace: 'nowrap', color: 'var(--vc-ink-soft)' }}>{(mt.horometro || 0).toLocaleString('es-CO')} hrs</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <p className="vc-footer">Vista de solo lectura generada por MaquiControl · Los datos son confidenciales</p>
            </div>
        </div>
    );
}

function IngresosSection({ ingresos, buscar, setBuscar }) {
    const q = buscar.toLowerCase();
    const filtrados = ingresos.filter(i =>
        (i.descripcion || '').toLowerCase().includes(q) || (i.tipoTrabajo || '').toLowerCase().includes(q)
    );
    const totalFiltrado = filtrados.reduce((s, i) => s + (i.total || 0), 0);

    return (
        <div className="vc-panel">
            <div className="vc-panel-head">
                <div className="vc-panel-title"><TrendingUp size={16} />Historial de ingresos <span className="vc-count">{ingresos.length}</span></div>
                <div className="vc-search"><Search size={13} /><input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por descripción o tipo…" /></div>
            </div>
            {ingresos.length === 0 ? (
                <div className="vc-empty">Sin ingresos registrados</div>
            ) : filtrados.length === 0 ? (
                <div className="vc-empty">Sin resultados para "{buscar}"</div>
            ) : (
                <div className="vc-scrollx">
                    <table className="vc-table">
                        <thead><tr>{['Fecha', 'Descripción', 'Tipo', 'Horas/Cant.', 'Total'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>
                            {filtrados.map((i, idx) => (
                                <tr key={idx}>
                                    <td style={{ whiteSpace: 'nowrap', color: 'var(--vc-ink-soft)' }}>{fmtFecha(i.fecha)}</td>
                                    <td>{i.descripcion || '—'}</td>
                                    <td><span className="vc-catpill vc-cat-info">{i.tipoTrabajo || '—'}</span></td>
                                    <td style={{ whiteSpace: 'nowrap', color: 'var(--vc-ink-soft)' }}>{i.cantidad}{i.tipoTrabajo === 'Horas' ? ' hrs' : ''}</td>
                                    <td className="vc-money pos">{fmt(i.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={4}>{buscar ? `Total filtrado (${filtrados.length} de ${ingresos.length})` : `Total (${ingresos.length} ingresos)`}</td>
                                <td className="vc-money pos">{fmt(totalFiltrado)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

function GastosSection({ gastos, buscar, setBuscar }) {
    const q = buscar.toLowerCase();
    const filtrados = gastos.filter(g =>
        (g.descripcion || '').toLowerCase().includes(q) || (g.categoria || '').toLowerCase().includes(q)
    );
    const totalFiltrado = filtrados.reduce((s, g) => s + (g.monto || 0), 0);

    return (
        <div className="vc-panel">
            <div className="vc-panel-head">
                <div className="vc-panel-title"><Receipt size={16} />Historial de gastos <span className="vc-count">{gastos.length}</span></div>
                <div className="vc-search"><Search size={13} /><input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por descripción o categoría…" /></div>
            </div>
            {gastos.length === 0 ? (
                <div className="vc-empty">Sin gastos registrados</div>
            ) : filtrados.length === 0 ? (
                <div className="vc-empty">Sin resultados para "{buscar}"</div>
            ) : (
                <div className="vc-scrollx">
                    <table className="vc-table">
                        <thead><tr>{['Fecha', 'Descripción', 'Categoría', 'Monto'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>
                            {filtrados.map((g, i) => (
                                <tr key={i}>
                                    <td style={{ whiteSpace: 'nowrap', color: 'var(--vc-ink-soft)' }}>{fmtFecha(g.fecha)}</td>
                                    <td>{g.descripcion || '—'}</td>
                                    <td><span className={`vc-catpill vc-cat-${claseCategoria(g.categoria)}`}>{g.categoria || '—'}</span></td>
                                    <td className="vc-money neg">{fmt(g.monto)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3}>{buscar ? `Total filtrado (${filtrados.length} de ${gastos.length})` : `Total (${gastos.length} gastos)`}</td>
                                <td className="vc-money neg">{fmt(totalFiltrado)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}
