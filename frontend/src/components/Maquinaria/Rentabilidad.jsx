import { useState, useEffect, useMemo } from 'react';
import { getMaquinas, getIngresos, getGastos, getSalarios, getFaenas } from '../../api';
import { esPagoOperador, salarioCuenta } from '../../utils/nomina';
import './Rentabilidad.css';

const mon = (n) => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(Number(n) || 0)).toLocaleString('es-CO');
const M = (n) => (n < 0 ? '−' : '') + '$' + (Math.abs(Number(n) || 0) / 1e6).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M';
const hrs = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('es-CO');
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORES = ['#2471a3', '#8e44ad', '#d9731a', '#5c7086', '#c0392b'];
const PERIODOS = [['act', 'Periodo activo'], ['mes', 'Este mes'], ['pas', 'Mes anterior'], ['tri', 'Últimos 3 meses'], ['todo', 'Todo']];
const dia = (f) => (f ? String(f).slice(0, 10) : '');
const prefijoMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// A qué grupo de costo pertenece un gasto
function grupoDeGasto(g) {
    const c = String(g.categoria || '').toLowerCase();
    if (c === 'combustible') return 'comb';
    if (c === 'mantenimiento' || c === 'reparación' || c === 'reparacion' || c === 'lubricantes') return 'mant';
    if (c === 'repuestos') return 'rep';
    return 'otros';
}
const GRUPOS = [['comb', 'Combustible'], ['mant', 'Mantenimiento y reparación'], ['rep', 'Repuestos'], ['oper', 'Pago al operador'], ['otros', 'Otros gastos'], ['ext', 'Gastos externos']];

// Utilidad por hora de una máquina: lo que queda de cada hora de trabajo después de los gastos.
function Rentabilidad({ maq }) {
    const [datos, setDatos] = useState(null);
    const [periodo, setPeriodo] = useState('tri');
    const [contarOperador, setContarOperador] = useState(true);
    const [sumarExternos, setSumarExternos] = useState(false);
    const [meta, setMeta] = useState(40);
    const [tarifaSim, setTarifaSim] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let vivo = true;
        Promise.all([getMaquinas(), getIngresos(), getGastos(), getSalarios(), getFaenas()])
            .then(([m, i, g, s, f]) => { if (vivo) setDatos({ maquinas: m.data || [], ingresos: i.data || [], gastos: g.data || [], salarios: s.data || [], faenas: f.data || [] }); })
            .catch(() => { if (vivo) setError(true); });
        return () => { vivo = false; };
    }, [maq.id]);

    const calc = useMemo(() => {
        if (!datos) return null;
        const hoy = new Date();
        const mesAct = prefijoMes(hoy);
        const mesPas = prefijoMes(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
        const mesTri = new Set([mesAct, mesPas, prefijoMes(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1))]);
        const faenaDeId = new Map(datos.faenas.map(f => [String(f.id), f]));
        const esExterna = (x) => { const f = x.faenaId != null ? faenaDeId.get(String(x.faenaId)) : null; return !!f && f.tipo === 'gastos'; };

        // ¿Este registro cae en el periodo elegido?
        const dentro = (key, nombre, x, mesPrefijo) => {
            if (mesPrefijo) return dia(x.fecha).startsWith(mesPrefijo);
            if (key === 'todo') return true;
            if (key === 'mes') return dia(x.fecha).startsWith(mesAct);
            if (key === 'pas') return dia(x.fecha).startsWith(mesPas);
            if (key === 'tri') return mesTri.has(dia(x.fecha).slice(0, 7));
            if (key === 'act') {
                const act = datos.faenas.find(f => f.maquinaNombre === nombre && f.estado === 'activa' && f.tipo !== 'gastos');
                return !!act && String(x.faenaId) === String(act.id);
            }
            return false;
        };

        // key: periodo; opciones: { faenaId } para una obra concreta, { mes } para un mes concreto
        const calcular = (nombre, key, opt = {}, oper = contarOperador, ext = sumarExternos) => {
            const pred = (x) => opt.faenaId != null ? String(x.faenaId) === String(opt.faenaId) : dentro(key, nombre, x, opt.mes);
            const ing = datos.ingresos.filter(i => i.maquinaNombre === nombre && pred(i));
            const gas = datos.gastos.filter(g => g.maquinaNombre === nombre && g.categoria !== 'Salario' && pred(g));
            const sal = datos.salarios.filter(s => s.maquinaNombre === nombre && salarioCuenta(s) && pred(s));
            const horas = ing.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
            const ingresos = ing.reduce((a, i) => a + (Number(i.total) || 0), 0);
            const cat = { comb: 0, mant: 0, rep: 0, oper: 0, otros: 0, ext: 0 };
            gas.forEach(g => {
                const m = Number(g.monto) || 0;
                if (esPagoOperador(g)) { if (oper) cat.oper += m; return; }
                if (esExterna(g)) { if (ext) cat.ext += m; return; }
                cat[grupoDeGasto(g)] += m;
            });
            if (oper) cat.oper += sal.reduce((a, s) => a + (Number(s.totalNeto) || 0), 0);
            const costo = Object.values(cat).reduce((a, v) => a + v, 0);
            const util = ingresos - costo;
            return { horas, ingresos, cat, costo, util, uh: horas > 0 ? util / horas : 0, ch: horas > 0 ? costo / horas : 0, cobra: horas > 0 ? ingresos / horas : 0, margen: ingresos > 0 ? util / ingresos : 0 };
        };

        const actual = calcular(maq.nombre, periodo);
        // últimos seis meses
        const meses = Array.from({ length: 6 }, (_, k) => {
            const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - k), 1);
            const p = prefijoMes(d);
            return { p, etiqueta: MESES[d.getMonth()], c: calcular(maq.nombre, 'todo', { mes: p }), dentro: periodo === 'todo' || (periodo === 'mes' && p === mesAct) || (periodo === 'pas' && p === mesPas) || (periodo === 'tri' && mesTri.has(p)) };
        });
        // obras (periodos de trabajo) de esta máquina
        const obras = datos.faenas.filter(f => f.maquinaNombre === maq.nombre && f.tipo !== 'gastos')
            .map(f => ({ f, c: calcular(maq.nombre, 'todo', { faenaId: f.id }, contarOperador, false) }))
            .filter(x => x.c.horas > 0 || x.c.costo > 0)
            .sort((a, b) => b.c.uh - a.c.uh);
        const externos = datos.faenas.filter(f => f.maquinaNombre === maq.nombre && f.tipo === 'gastos')
            .map(f => ({ f, total: datos.gastos.filter(g => String(g.faenaId) === String(f.id)).reduce((a, g) => a + (Number(g.monto) || 0), 0) }));
        const otras = datos.maquinas.map((m, i) => ({ nombre: m.nombre, i, c: calcular(m.nombre, periodo) }))
            .sort((a, b) => b.c.uh - a.c.uh);
        const hayActivo = datos.faenas.some(f => f.maquinaNombre === maq.nombre && f.estado === 'activa' && f.tipo !== 'gastos');
        const mesesConHoras = meses.filter(m => m.dentro && m.c.horas > 0).length;
        return { actual, meses, obras, externos, otras, hayActivo, mesesConHoras };
    }, [datos, periodo, contarOperador, sumarExternos, maq.nombre]);

    if (error) return <p className="rt-vacio">No se pudieron cargar los datos. Recarga la página.</p>;
    if (!calc) return <p className="rt-vacio">Cargando…</p>;

    const { actual: c, meses, obras, externos, otras, hayActivo, mesesConHoras } = calc;
    const tarifaBase = Number(maq.valorHoraMaquina) > 0 ? Number(maq.valorHoraMaquina) : c.cobra;
    const tar = tarifaSim ?? Math.round(c.cobra || tarifaBase);
    const sinHoras = c.horas <= 0;

    // Partes de la cuenta de una hora
    const partes = GRUPOS.map(([k, nombre]) => ({ k, nombre, v: c.horas > 0 ? c.cat[k] / c.horas : 0 })).filter(p => p.v > 0.5);
    const mayor = partes.slice().sort((a, b) => b.v - a.v)[0];
    const colorGrupo = (k) => ({ comb: COLORES[0], mant: COLORES[1], rep: COLORES[2], oper: COLORES[3], otros: '#93a2b3', ext: COLORES[4] }[k]);
    const ancho = (v) => `${c.cobra > 0 ? Math.max(0, v / c.cobra * 100) : 0}%`;
    const queda = Math.max(0, c.uh);

    // Simulador
    const uSim = tar - c.ch;
    const mgSim = tar > 0 ? uSim / tar : 0;
    const horasMes = mesesConHoras > 0 ? c.horas / mesesConHoras : c.horas;
    const tarMeta = c.ch / (1 - meta / 100);
    const sMin = Math.max(5000, Math.round(c.ch * 0.8 / 5000) * 5000);
    const sMax = Math.max(sMin + 10000, Math.round((c.cobra || tarifaBase) * 1.4 / 5000) * 5000);

    // Gráfico mensual
    const W = 720, H = 210, L = 52, R = 10, T = 16, B = 26;
    const bw = (W - L - R) / meses.length;
    const mx = Math.max(...meses.map(m => m.c.uh), tarifaBase * 0.95, 1) * 1.12;
    const y = (v) => T + (H - T - B) * (1 - v / mx);

    return (
        <div className="rt">
            <div className="rt-chips" role="group" aria-label="Periodo">
                {PERIODOS.map(([k, l]) => <button key={k} type="button" className={periodo === k ? 'on' : ''} onClick={() => { setPeriodo(k); setTarifaSim(null); }}>{l}</button>)}
            </div>

            {sinHoras ? (
                <div className="rt-box rt-p">
                    <div className="rt-h3">{periodo === 'act' && !hayActivo ? 'Esta máquina no tiene un periodo activo' : 'Todavía no hay horas en este periodo'}</div>
                    <p className="rt-sub">La utilidad por hora se calcula con las horas que registras en Ingresos. {periodo === 'act' ? 'Prueba con "Este mes" o "Todo".' : 'Prueba con otro periodo.'}</p>
                </div>
            ) : (<>
                {c.horas < 60 && <div className="rt-alert">Pocos datos: solo {hrs(c.horas)} horas en este periodo. La utilidad por hora puede cambiar mucho con unas horas más.</div>}

                <div className="rt-box rt-p">
                    <div className="rt-hero">
                        <div>
                            <div className="rt-bigl">Utilidad por hora · {PERIODOS.find(p => p[0] === periodo)[1].toLowerCase()}</div>
                            <div className={`rt-big ${c.uh < 0 ? 'neg' : ''}`}>{mon(c.uh)}</div>
                            <div className="rt-tags"><span className={`rt-chip ${c.margen >= 0.5 ? 'ok' : c.margen >= 0.3 ? 'wr' : 'bad'}`}>{Math.round(c.margen * 100)}% de margen</span><span className="rt-chip n">{hrs(c.horas)} horas</span></div>
                            <p className="rt-sub" style={{ margin: '10px 0 0' }}>De cada hora que cobras a {mon(c.cobra)}, te quedan {mon(c.uh)}.</p>
                        </div>
                        <div>
                            <div className="rt-h3">La cuenta de una hora</div>
                            <p className="rt-sub" style={{ marginBottom: 8 }}>Lo que cobras por hora, repartido en lo que cuesta y lo que te queda.</p>
                            <div className="rt-stack" role="img" aria-label="Reparto de una hora">
                                {partes.map(p => <i key={p.k} title={p.nombre} style={{ width: ancho(p.v), background: colorGrupo(p.k) }} />)}
                                <i title="Te queda" style={{ width: ancho(queda), background: '#1c8a4b' }}>{queda / (c.cobra || 1) > 0.12 ? 'Te queda' : ''}</i>
                            </div>
                            <div className="rt-cuenta">
                                <div className="f"><i style={{ background: '#0d1b2a' }} /><span>Cobras por hora</span><b>{mon(c.cobra)}</b></div>
                                {partes.map(p => <div className="f" key={p.k}><i style={{ background: colorGrupo(p.k) }} /><span>− {p.nombre}</span><b className="neg">{mon(p.v)}</b></div>)}
                                <div className="f tt"><i style={{ background: '#1c8a4b' }} /><span>= Te queda por hora</span><b className={c.uh < 0 ? 'neg' : 'pos'}>{mon(c.uh)}</b></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rt-g4">
                    <div className="rt-kpi"><small>Costo por hora</small><b className="neg">{mon(c.ch)}</b><span>gastos entre horas</span></div>
                    <div className="rt-kpi"><small>Tarifa mínima</small><b>{mon(c.ch)}</b><span>para no perder plata</span></div>
                    <div className="rt-kpi"><small>Utilidad del periodo</small><b className={c.util < 0 ? 'neg' : 'pos'}>{M(c.util)}</b><span>{M(c.ingresos)} − {M(c.costo)}</span></div>
                    <div className="rt-kpi"><small>Mayor costo</small><b style={{ fontSize: 20 }}>{mayor ? mayor.nombre : '—'}</b><span>{mayor ? `${mon(mayor.v)} por hora` : 'sin gastos'}</span></div>
                </div>

                <div className="rt-box rt-p">
                    <div className="rt-h3">Utilidad por hora, mes a mes</div>
                    <p className="rt-sub" style={{ margin: '0 0 4px' }}>Los meses del periodo elegido van resaltados. La línea punteada es la tarifa de la máquina.</p>
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Utilidad por hora, mes a mes">
                        {[0, 0.25, 0.5, 0.75, 1].map(g => <g key={g}><line x1={L} x2={W - R} y1={y(mx * g)} y2={y(mx * g)} className="rt-grid" /><text className="rt-axis" x={L - 6} y={y(mx * g) + 3} textAnchor="end">{Math.round(mx * g / 1000)}k</text></g>)}
                        {meses.map((m, i) => {
                            const x = L + i * bw + bw * 0.22, w = bw * 0.56, v = Math.max(m.c.uh, 0);
                            return (
                                <g key={m.p} opacity={m.dentro ? 1 : 0.35}>
                                    {m.c.horas > 0 && <><rect x={x} y={y(v)} width={w} height={Math.max(0, y(0) - y(v))} rx="4" fill="#1c8a4b"><title>{m.etiqueta}: {mon(m.c.uh)} por hora ({hrs(m.c.horas)} h)</title></rect>
                                        <text className="rt-axis" x={x + w / 2} y={y(v) - 5} textAnchor="middle">{Math.round(m.c.uh / 1000)}k</text></>}
                                    <text className="rt-axis" x={x + w / 2} y={H - 8} textAnchor="middle">{m.etiqueta}</text>
                                </g>
                            );
                        })}
                        {tarifaBase > 0 && <><line x1={L} x2={W - R} y1={y(tarifaBase)} y2={y(tarifaBase)} stroke="#f5a623" strokeWidth="2" strokeDasharray="6 4" /><text className="rt-axis" x={W - R} y={y(tarifaBase) - 5} textAnchor="end" style={{ fill: '#b86e00', fontWeight: 700 }}>Tarifa {Math.round(tarifaBase / 1000)}k</text></>}
                    </svg>
                </div>

                <div className="rt-box">
                    <div className="rt-p" style={{ paddingBottom: 4 }}><div className="rt-h3">Por periodo</div><p className="rt-sub" style={{ margin: 0 }}>Cada obra de {maq.nombre}, de la que más deja por hora a la que menos.</p></div>
                    <div className="rt-tw"><table><thead><tr><th>Periodo</th><th className="r">Horas</th><th className="r">Ingresos</th><th className="r">Gastos</th><th className="r">Utilidad</th><th className="r">Utilidad por hora</th></tr></thead><tbody>
                        {obras.length === 0 && <tr><td colSpan="6" className="rt-vacio">Todavía no hay periodos con horas.</td></tr>}
                        {obras.map((o, i) => (
                            <tr key={o.f.id}><td><b>{o.f.nombreObra || 'Periodo'}</b> {o.f.estado === 'activa' && <span className="rt-chip ok">En campo</span>}</td>
                                <td className="r mono">{hrs(o.c.horas)}</td><td className="r mono">{M(o.c.ingresos)}</td><td className="r mono neg">{M(o.c.costo)}</td><td className={`r mono ${o.c.util < 0 ? 'neg' : 'pos'}`}>{M(o.c.util)}</td>
                                <td className="r mono">{o.c.horas > 0 ? mon(o.c.uh) : '—'} {obras.length > 1 && o.c.horas > 0 && i === 0 && <span className="rt-chip ok">Mejor</span>}{obras.length > 1 && o.c.horas > 0 && i === obras.length - 1 && <span className="rt-chip wr">Menor</span>}</td></tr>
                        ))}
                        {sumarExternos && externos.map(e => <tr className="ext" key={e.f.id}><td><b>{e.f.nombreObra || 'Gastos externos'}</b><br /><span style={{ fontSize: 12 }}>Gastos externos</span></td><td className="r mono">—</td><td className="r mono">—</td><td className="r mono">{M(e.total)}</td><td className="r mono">—</td><td className="r mono">—</td></tr>)}
                    </tbody></table></div>
                </div>

                <div className="rt-g2">
                    <div className="rt-box rt-p">
                        <div className="rt-h3">¿Y si cambio la tarifa?</div>
                        <p className="rt-sub">Mueve la tarifa y mira cuánto te queda con los costos actuales.</p>
                        <label htmlFor="rt-tar" className="rt-lab">Tarifa por hora: <b>{mon(tar)}</b></label>
                        <input id="rt-tar" type="range" min={sMin} max={sMax} step="5000" value={Math.min(Math.max(tar, sMin), sMax)} onChange={e => setTarifaSim(Number(e.target.value))} />
                        <p className="rt-sub" style={{ margin: '8px 0' }}>Para ganar el <b>{meta}%</b> necesitas cobrar <b className="mono">{mon(tarMeta)}</b> por hora.</p>
                        <div className="rt-chips" role="group" aria-label="Margen deseado">{[30, 40, 50].map(x => <button key={x} type="button" className={meta === x ? 'on' : ''} onClick={() => setMeta(x)}>Ganar {x}%</button>)}</div>
                        <div className="rt-g2" style={{ marginTop: 12 }}>
                            <div className="rt-kpi"><small>Utilidad por hora</small><b className={uSim < 0 ? 'neg' : 'pos'}>{mon(uSim)}</b><span>{Math.round(mgSim * 100)}% de margen</span></div>
                            <div className="rt-kpi"><small>En un mes típico ({hrs(horasMes)} h)</small><b className={uSim < 0 ? 'neg' : 'pos'}>{M(uSim * horasMes)}</b><span>{Math.round(tar) !== Math.round(c.cobra) ? `${uSim >= c.uh ? '+' : ''}${M((uSim - c.uh) * horasMes)} frente a hoy` : 'con la tarifa actual'}</span></div>
                        </div>
                    </div>
                    <div className="rt-box rt-p">
                        <div className="rt-h3">Frente a tus otras máquinas</div>
                        <p className="rt-sub">Utilidad por hora en {PERIODOS.find(p => p[0] === periodo)[1].toLowerCase()}.</p>
                        {otras.map((o, i) => {
                            const top = Math.max(...otras.map(x => x.c.uh), 1);
                            return (
                                <div className="rt-rk" key={o.nombre}>
                                    <span className="nm"><i className="rt-dot" style={{ background: COLORES[i % COLORES.length] }} />{o.nombre}{o.nombre === maq.nombre ? ' (esta)' : ''}</span>
                                    <div className="rt-tr"><i style={{ width: `${o.c.horas > 0 ? Math.max(0, o.c.uh) / top * 100 : 0}%`, background: COLORES[i % COLORES.length] }} /></div>
                                    <b className="mono">{o.c.horas > 0 ? mon(o.c.uh) : '—'}</b>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </>)}

            <div className="rt-box rt-p">
                <div className="rt-h3">Reglas del cálculo</div>
                <p className="rt-sub">Cambian el resultado de toda la pestaña. Las horas son las que registras en Ingresos.</p>
                <div className="rt-g2">
                    <label className={`rt-opt ${contarOperador ? 'on' : ''}`}><input type="checkbox" checked={contarOperador} onChange={e => setContarOperador(e.target.checked)} /><span><b>Contar el pago al operador</b><small>Lo que de verdad le pagaste. Quítalo si el operador es de la familia y no cobra.</small></span></label>
                    <label className={`rt-opt ${sumarExternos ? 'on' : ''}`}><input type="checkbox" checked={sumarExternos} onChange={e => setSumarExternos(e.target.checked)} /><span><b>Sumar los gastos externos</b><small>Los de periodos de gastos externos (taller, impuestos), repartidos entre las horas.</small></span></label>
                </div>
            </div>
        </div>
    );
}

export default Rentabilidad;
