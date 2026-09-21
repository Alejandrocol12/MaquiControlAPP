import { useState, useEffect } from 'react';
import { getMaquinas, getIngresos, getGastos, getSalarios, getFaenas, getPagos } from '../../api';
import { fmtFecha } from '../../utils/fmtFecha';
import { Tractor, TrendingUp, TrendingDown, BarChart2, Clock, Target } from 'lucide-react';
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

// #9: número que anima desde 0 al valor objetivo
function AnimatedNumber({ value, prefix = '', suffix = '', style }) {
    const animated = useCountUp(value);
    const display  = prefix + animated.toLocaleString('es-CO') + suffix;
    return <span style={style}>{display}</span>;
}

const fmt    = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const mesHoy = () => new Date().toISOString().slice(0, 7);
const parseLocal = (str) => { const [y, m, d] = String(str).split('-').map(Number); return new Date(y, m - 1, d); };
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Proyecta el valor (ingresos o egresos) que se acumulará a fin de mes, a partir del patrón
// histórico real del negocio: qué días de la semana suele haber movimiento y cuánto, en vez
// de asumir un calendario fijo de días hábiles — mismo enfoque que calcularPronosticoHoras
// en Maquinaria, pero a nivel de todo el negocio en vez de una sola máquina.
function proyectarValorMes(items, getFecha, getValor) {
    const conFecha = items.filter(x => getFecha(x));
    if (conFecha.length === 0) return null;

    const hoyD = new Date();
    const hoyStr = isoLocal(hoyD);
    const inicioMesStr = `${hoyD.getFullYear()}-${String(hoyD.getMonth() + 1).padStart(2, '0')}-01`;
    const finMes = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0);

    const valorEsteMes = conFecha
        .filter(x => getFecha(x) >= inicioMesStr && getFecha(x) <= hoyStr)
        .reduce((a, x) => a + (Number(getValor(x)) || 0), 0);

    const primerRegistro = parseLocal(conFecha.map(getFecha).sort()[0]);
    const limite60 = new Date(hoyD); limite60.setDate(limite60.getDate() - 60);
    const ventanaInicio = primerRegistro > limite60 ? primerRegistro : limite60;

    const valorPorFecha = {};
    conFecha.forEach(x => { const f = getFecha(x); valorPorFecha[f] = (valorPorFecha[f] || 0) + (Number(getValor(x)) || 0); });

    const ocurrencias = Array(7).fill(0);
    const diasConMovimiento = Array(7).fill(0);
    const sumaValor = Array(7).fill(0);
    for (let d = new Date(ventanaInicio); d <= hoyD; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        ocurrencias[dow]++;
        const v = valorPorFecha[isoLocal(d)] || 0;
        if (v !== 0) { diasConMovimiento[dow]++; sumaValor[dow] += v; }
    }

    if (diasConMovimiento.reduce((a, b) => a + b, 0) < 3) return null; // historial insuficiente

    const valorEsperadoPorDia = Array(7).fill(0).map((_, dow) => {
        const frecuencia = ocurrencias[dow] > 0 ? diasConMovimiento[dow] / ocurrencias[dow] : 0;
        const promedio    = diasConMovimiento[dow] > 0 ? sumaValor[dow] / diasConMovimiento[dow] : 0;
        return frecuencia * promedio;
    });

    let restante = 0;
    for (let d = new Date(hoyD); d <= finMes; d.setDate(d.getDate() + 1)) {
        if (isoLocal(d) === hoyStr) continue; // hoy ya está contado en valorEsteMes
        restante += valorEsperadoPorDia[d.getDay()];
    }

    return { realizado: valorEsteMes, restante: Math.round(restante), total: Math.round(valorEsteMes + restante) };
}


function Dashboard({ onIrMaquinaria, onIrFinanzas, onIrModulo }) {
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

    const gastosOperativos = gastos.filter(g => g.categoria !== 'Salario');
    const ingFiltrados = filtrarPorFecha(ingresos, 'fecha');
    const gasFiltrados = filtrarPorFecha(gastosOperativos, 'fecha');
    const salFiltrados = filtrarPorFecha(salarios, 'fecha');
    const totIngMes    = ingFiltrados.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const totGasMes    = gasFiltrados.reduce((a, g) => a + (Number(g.monto) || 0), 0);
    const totSalMes    = salFiltrados.reduce((a, s) => a + (Number(s.totalNeto) || 0), 0);
    const totEgresosMes = totGasMes + totSalMes;
    const utilidadMes  = totIngMes - totEgresosMes;
    const margenMes    = totIngMes > 0 ? Math.round((utilidadMes / totIngMes) * 100) : 0;

    const labelFiltro = filtroFecha === 'mes' ? nombreMes
        : filtroFecha === 'anio' ? `Año ${ahora.getFullYear()}`
        : filtroFecha === 'todo' ? 'Total acumulado'
        : (fechaDesde || fechaHasta) ? `${fechaDesde || '...'} → ${fechaHasta || '...'}` : 'Rango personalizado';

    // Tendencia vs. el mes calendario anterior — solo tiene sentido cuando se está viendo "Este mes"
    let tendenciaPct = null;
    if (filtroFecha === 'mes') {
        const dAnt = new Date(ahora); dAnt.setMonth(dAnt.getMonth() - 1);
        const prefixAnt = dAnt.toISOString().slice(0, 7);
        const ingAnt = ingresos.filter(i => i.fecha?.startsWith(prefixAnt)).reduce((a, i) => a + (Number(i.total) || 0), 0);
        const gasAnt = gastosOperativos.filter(g => g.fecha?.startsWith(prefixAnt)).reduce((a, g) => a + (Number(g.monto) || 0), 0)
            + salarios.filter(s => s.fecha?.startsWith(prefixAnt)).reduce((a, s) => a + (Number(s.totalNeto) || 0), 0);
        const utilAnt = ingAnt - gasAnt;
        if (utilAnt !== 0) tendenciaPct = Math.round(((utilidadMes - utilAnt) / Math.abs(utilAnt)) * 100);
    }

    // Proyección de cierre de mes a nivel de todo el negocio -- solo tiene sentido viendo "Este mes"
    let proyeccionMes = null;
    if (filtroFecha === 'mes') {
        const proyIng = proyectarValorMes(ingresos, i => i.fecha, i => i.total);
        const proyGas = proyectarValorMes(gastosOperativos, g => g.fecha, g => g.monto);
        const proySal = proyectarValorMes(salarios, s => s.fecha, s => s.totalNeto);
        if (proyIng && (proyGas || proySal)) {
            const egrRealizado = (proyGas?.realizado || 0) + (proySal?.realizado || 0);
            const egrTotal     = (proyGas?.total || 0) + (proySal?.total || 0);
            proyeccionMes = {
                ingTotal: proyIng.total,
                egrTotal,
                utilTotal: proyIng.total - egrTotal,
                utilRealizado: proyIng.realizado - egrRealizado,
            };
        }
    }


    // Periodos activos
    const periodosActivos = faenas.filter(f => f.estado === 'activa');

    // Pagos pendientes
    const pagosPendientes = pagos.filter(p => p.estado !== 'Pagado' && (p.saldoPendiente || 0) > 0);
    const totalPorCobrar  = pagosPendientes.reduce((a, p) => a + (Number(p.saldoPendiente) || 0), 0);

    // Señales que sí se pueden calcular con datos reales — nada inventado
    const gastosSinFecha = gastos.filter(g => !g.fecha);
    const totalGastosSinFecha = gastosSinFecha.reduce((a, g) => a + (Number(g.monto) || 0), 0);
    const maquinasMantenimiento = maquinas.filter(m => m.estado === 'En mantenimiento');
    const periodosLargos = periodosActivos
        .map(f => ({ ...f, dias: f.fechaInicio ? Math.round((ahora - parseLocal(f.fechaInicio)) / 86400000) : 0 }))
        .filter(f => f.dias > 30);

    // Ingresos que se repiten exactos (misma máquina, fecha, tipo, cantidad y valor unitario) --
    // típico de un doble clic o de registrar el mismo trabajo dos veces por error.
    const dupKey = (i) => `${i.maquinaNombre}|${i.fecha}|${i.tipoTrabajo}|${i.cantidad}|${i.valorUnitario}`;
    const gruposIngresos = {};
    ingresos.forEach(i => { const k = dupKey(i); (gruposIngresos[k] = gruposIngresos[k] || []).push(i); });
    const gruposDuplicados = Object.values(gruposIngresos).filter(g => g.length > 1);
    const montoEnRiesgoDup = gruposDuplicados.reduce((a, g) => a + (g.length - 1) * (Number(g[0].total) || 0), 0);

    const alertas = [
        gastosSinFecha.length > 0 && {
            tipo: 'crit',
            texto: `${gastosSinFecha.length} gasto${gastosSinFecha.length > 1 ? 's' : ''} sin fecha por ${fmt(totalGastosSinFecha)}`,
            desc: 'No se están contando en los reportes del periodo',
            accion: () => onIrFinanzas?.('gastos'),
        },
        gruposDuplicados.length > 0 && {
            tipo: 'warn',
            texto: `${gruposDuplicados.length} posible${gruposDuplicados.length > 1 ? 's' : ''} ingreso${gruposDuplicados.length > 1 ? 's' : ''} duplicado${gruposDuplicados.length > 1 ? 's' : ''} — ${fmt(montoEnRiesgoDup)} en riesgo`,
            desc: 'Misma máquina, fecha, tipo y valor registrados más de una vez',
            accion: () => onIrFinanzas?.('ingresos'),
        },
        maquinasMantenimiento.length > 0 && {
            tipo: 'warn',
            texto: `${maquinasMantenimiento.map(m => m.nombre).join(', ')} — en mantenimiento`,
            desc: 'Revisar módulo de Mantenimientos',
            accion: () => onIrModulo?.('mantenimientos'),
        },
        totalPorCobrar > 0 && {
            tipo: 'warn',
            texto: `${fmt(totalPorCobrar)} pendientes de cobro`,
            desc: `${pagosPendientes.length} pago${pagosPendientes.length > 1 ? 's' : ''} de clientes sin completar`,
            accion: () => onIrFinanzas?.('pagos'),
        },
        ...periodosLargos.map(f => ({
            tipo: 'info',
            texto: `Periodo de ${f.maquinaNombre} lleva ${f.dias} días abierto`,
            desc: 'Puede ser momento de rendir cuentas y cerrarlo',
            accion: () => onIrModulo?.('faenas'),
        })),
    ].filter(Boolean);

    // Horas trabajadas este mes por máquina, y su utilización relativa a la más activa de la flota
    const horasEsteMes = (nombre) => ingresos
        .filter(i => i.maquinaNombre === nombre && i.tipoTrabajo === 'Horas' && i.fecha?.startsWith(mes))
        .reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
    const maxHorasFlota = Math.max(1, ...maquinas.map(m => horasEsteMes(m.nombre)));

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
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                            <span style={{ fontSize: '12px', color: '#6b7a8d', alignSelf: 'center' }}>→</span>
                            <input type="date" style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #dee2e6', borderRadius: '8px' }}
                                value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                        </>
                    )}
                </div>
            </div>

            <div className="content"><div className="pad">

                {/* ── HERO KPI ── */}
                <div className="db-hero">
                    <div className="db-kpi good">
                        <div className="db-kpi-top"><span className="db-kpi-label">Ingresos</span><span className="db-kpi-ico"><TrendingUp size={15} /></span></div>
                        <div className="db-kpi-val db-num"><AnimatedNumber value={totIngMes} prefix="$" /></div>
                        <div className="db-kpi-sub">{ingFiltrados.length} registros de trabajo</div>
                    </div>
                    <div className="db-kpi bad">
                        <div className="db-kpi-top"><span className="db-kpi-label">Egresos</span><span className="db-kpi-ico"><TrendingDown size={15} /></span></div>
                        <div className="db-kpi-val db-num"><AnimatedNumber value={totEgresosMes} prefix="$" /></div>
                        <div className="db-kpi-sub">gastos + nómina de operadores</div>
                    </div>
                    <div className="db-kpi profit">
                        <div>
                            <div className="db-kpi-top"><span className="db-kpi-label">Utilidad — {labelFiltro}</span><span className="db-kpi-ico"><BarChart2 size={15} /></span></div>
                            <div className="db-kpi-val db-num"><AnimatedNumber value={utilidadMes} prefix="$" /></div>
                            <div className="db-kpi-sub">margen del {margenMes}% sobre ingresos</div>
                        </div>
                        {tendenciaPct != null && (
                            <div className={`db-trend ${tendenciaPct < 0 ? 'down' : ''}`}>
                                {tendenciaPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                {tendenciaPct >= 0 ? '+' : ''}{tendenciaPct}% vs. mes anterior
                            </div>
                        )}
                    </div>
                </div>

                {proyeccionMes && (
                    <div className="db-insight">
                        <Target size={18} />
                        <div>
                            <b>A este ritmo, cierras {nombreMes} con {fmt(proyeccionMes.utilTotal)} de utilidad</b>
                            <p>{fmt(proyeccionMes.utilRealizado)} ya realizados este mes, más lo que proyecta tu patrón histórico de ingresos y gastos para los días que faltan. Ingresos proyectados: {fmt(proyeccionMes.ingTotal)} · Egresos proyectados: {fmt(proyeccionMes.egrTotal)}.</p>
                        </div>
                    </div>
                )}

                {/* ── EN CAMPO + REQUIERE ATENCIÓN ── */}
                <div className="db-band2">
                    <div className="db-panel">
                        <div className="db-panel-head"><h2>En campo ahora</h2><span className="meta">{periodosActivos.length} periodo{periodosActivos.length !== 1 ? 's' : ''} activo{periodosActivos.length !== 1 ? 's' : ''}</span></div>
                        <div className="db-panel-body">
                            {periodosActivos.length === 0 && <div className="db-panel-empty">Ninguna máquina tiene un periodo activo</div>}
                            {periodosActivos.map(f => {
                                const ingF = ingresos.filter(i => String(i.faenaId) === String(f.id)).reduce((a, i) => a + (Number(i.total) || 0), 0);
                                const gasF = gastos.filter(g => String(g.faenaId) === String(f.id) && g.categoria !== 'Salario').reduce((a, g) => a + (Number(g.monto) || 0), 0);
                                const dias = f.fechaInicio ? Math.max(1, Math.round((ahora - parseLocal(f.fechaInicio)) / 86400000)) : null;
                                return (
                                    <div className="db-field-row" key={f.id}>
                                        <span className="db-field-dot"></span>
                                        <div className="db-field-info">
                                            <div className="db-field-name">{f.maquinaNombre}</div>
                                            <div className="db-field-meta">{f.nombreObra}{f.cliente ? ` — ${f.cliente}` : ''}</div>
                                            <div className="db-field-days"><Clock size={10} />Desde el {fmtFecha(f.fechaInicio)}{dias != null ? ` · ${dias} día${dias !== 1 ? 's' : ''}` : ''}</div>
                                        </div>
                                        <div className="db-field-nums">
                                            <div className="db-field-num ing"><div className="l">Ingresos</div><div className="v">{fmt(ingF)}</div></div>
                                            <div className="db-field-num gas"><div className="l">Gastos</div><div className="v">{fmt(gasF)}</div></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="db-panel">
                        <div className="db-panel-head"><h2>Requiere atención</h2><span className="meta">{alertas.length} pendiente{alertas.length !== 1 ? 's' : ''}</span></div>
                        <div className="db-panel-body">
                            {alertas.length === 0 && <div className="db-panel-empty">Todo al día — sin pendientes por ahora</div>}
                            {alertas.map((a, i) => (
                                <div className={`db-alert-row ${a.tipo} ${a.accion ? 'clickable' : ''}`} key={i}
                                    onClick={a.accion} role={a.accion ? 'button' : undefined} tabIndex={a.accion ? 0 : undefined}>
                                    <span className="db-alert-bar"></span>
                                    <div className="db-alert-text">
                                        <p>{a.texto}</p>
                                        <span>{a.desc}</span>
                                    </div>
                                    <span className="db-alert-tag">{a.tipo === 'crit' ? 'Crítico' : a.tipo === 'warn' ? 'Alerta' : 'Info'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── FLOTA ── */}
                <div>
                    <div className="db-sechead">
                        <h2>Flota — {maquinas.length} máquina{maquinas.length !== 1 ? 's' : ''}</h2>
                        <span className="meta">Horas trabajadas este mes, relativo a tu máquina más activa · <a onClick={onIrMaquinaria} style={{ cursor: 'pointer', color: '#f5a623', fontWeight: 600 }}>Ver todas →</a></span>
                    </div>
                    {maquinas.length === 0 ? (
                        <p className="vacio">No hay máquinas registradas</p>
                    ) : (
                        <div className="db-panel db-scrollx">
                            <div style={{ minWidth: 720 }}>
                                <div className="db-fleet-head-row"><span>Máquina</span><span>Estado</span><span>Horas este mes</span><span>Horómetro</span><span>Operador</span></div>
                                {maquinas.map(m => {
                                    const horas = horasEsteMes(m.nombre);
                                    const pillCls = m.estado === 'Activa' ? 'act' : m.estado === 'En mantenimiento' ? 'mant' : 'inact';
                                    return (
                                        <div className="db-fleet-row" key={m.id}>
                                            <div className="db-fleet-id">
                                                <span className="db-fleet-ico" style={{ background: tipoColor(m.tipo) }}><IcoMaquina tipo={m.tipo} size={17} /></span>
                                                <div><div className="db-fleet-name">{m.nombre}</div><div className="db-fleet-sub">{m.placa}</div></div>
                                            </div>
                                            <div><span className="db-flabel">Estado</span><span className={`db-pill ${pillCls}`}><i></i>{m.estado}</span></div>
                                            <div>
                                                <span className="db-flabel">Horas este mes</span>
                                                <div className="db-util-track"><div className="db-util-fill" style={{ width: `${Math.round((horas / maxHorasFlota) * 100)}%` }}></div></div>
                                                <div className="db-util-label">{horas.toLocaleString('es-CO')} hrs</div>
                                            </div>
                                            <div><span className="db-flabel">Horómetro</span><div className="db-fleet-horo">{(m.horometroActual || 0).toLocaleString('es-CO')}<span>hrs</span></div></div>
                                            <div><span className="db-flabel">Operador</span><div className={`db-fleet-op ${!m.operadorNombre ? 'empty' : ''}`}>{m.operadorNombre || 'Sin asignar'}</div></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

            </div></div>
        </div>
    );
}

export default Dashboard;
