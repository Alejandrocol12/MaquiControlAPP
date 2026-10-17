import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react';
import { getCortes, getPagos, renombrarCorte } from '../../api';
import { useToast } from '../../utils/toast';
import Estado from '../../utils/Estado';
import { fmtFecha } from '../../utils/fmtFecha';
import { fmtHoro } from '../../utils/horometro';
import { enRango, ordenarCortes, fmtHoras, diaSiguiente, hoyISO, nombreCorte } from '../../utils/cortes';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const dia10 = (f) => String(f || '').slice(0, 10);
const diaSemana = (f) => { const [y, m, d] = dia10(f).split('-').map(Number); return DSEM[new Date(y, m - 1, d).getDay()] || ''; };
const ESTADO_PAGO = { Pagado: 'Pagado', Parcial: 'Parcial', Deuda: 'Pendiente' };
const FILTROS = [['todos', 'Todos los cortes'], ['sin', 'Sin cortar'], ['cobrar', 'Por cobrar'], ['pagado', 'Pagados']];
const valorDe = (modo, i) => Number(modo === 'gastos' ? i.monto : i.total) || 0;

// Ingresos o gastos de una máquina agrupados por corte. Con `anidado`, primero va el periodo
// (por ejemplo SAN JOSE) y al abrirlo salen sus cortes, que se abren uno a uno. Sin `anidado`,
// los cortes van sueltos, el que está en curso primero y abierto. Cada corte tiene nombre editable.
function AgrupadoPorCorte({
    modo = 'ingresos', items, faenas = [], anidado = false, mostrarMaquina = false, resumen = true,
    onEditar, onEliminar, renderFila, cabecera, cols, claseFila = 'ic-row', claseCab = 'ic-row ic-hd', envoltura = '', onCambio,
}) {
    const toast = useToast();
    const esGasto = modo === 'gastos';
    const [cortes, setCortes] = useState([]);
    const [pagos, setPagos] = useState([]);
    const [filtro, setFiltro] = useState('todos');
    const [abiertos, setAbiertos] = useState({});
    const [editando, setEditando] = useState(null);
    const [nombreNuevo, setNombreNuevo] = useState('');

    useEffect(() => {
        let vivo = true;
        Promise.all([getCortes(), getPagos()])
            .then(([c, p]) => { if (vivo) { setCortes(c.data || []); setPagos(p.data || []); } })
            .catch(() => {});
        return () => { vivo = false; };
    }, [items.length]);

    const periodos = useMemo(() => {
        const usados = new Set();
        const fs = [...faenas].sort((a, b) => dia10(b.fechaInicio).localeCompare(dia10(a.fechaInicio)));
        const out = fs.map(f => {
            const propios = items.filter(i => String(i.faenaId) === String(f.id));
            propios.forEach(i => usados.add(i.id));
            const activa = f.estado === 'activa' || f.estado === 'abierta';
            const sub = !anidado && fs.length > 1 ? (f.nombreObra || 'Periodo') : '';
            const hijos = [];
            if (f.tipo === 'gastos') {
                if (propios.length) hijos.push({ key: `f${f.id}-todo`, nombre: 'Gastos del periodo', sub, fechas: '', est: 'sin', fijo: true, items: propios });
            } else {
                const cs = ordenarCortes(cortes.filter(c => String(c.faenaId) === String(f.id)));
                const ultimo = cs[cs.length - 1];
                const sigue = ultimo ? diaSiguiente(ultimo.fechaFin) : dia10(f.fechaInicio);
                const curso = propios.filter(i => !cs.some(c => enRango(i.fecha, c.fechaInicio, c.fechaFin)));
                if (curso.length) {
                    hijos.push({ key: `f${f.id}-curso`, nombre: activa ? 'En curso' : 'Sin cortar', sub, fijo: true,
                        fechas: `${fmtFecha(sigue)} a ${activa ? 'hoy' : fmtFecha(f.fechaFin || hoyISO())}`, est: 'sin', items: curso });
                }
                [...cs].reverse().forEach(c => {
                    const delCorte = propios.filter(i => enRango(i.fecha, c.fechaInicio, c.fechaFin));
                    if (!delCorte.length) return;
                    const pago = c.pagoClienteId ? pagos.find(p => String(p.id) === String(c.pagoClienteId)) : null;
                    hijos.push({ key: `c${c.id}`, nombre: nombreCorte(c, cs.indexOf(c) + 1), corte: c, sub,
                        fechas: `${fmtFecha(c.fechaInicio)} a ${fmtFecha(c.fechaFin)}`,
                        est: pago ? (pago.estado === 'Pagado' ? 'pagado' : 'cobrar') : 'cobrar', pago, items: delCorte });
                });
            }
            return {
                key: `p${f.id}`, nombre: f.nombreObra || 'Periodo', maquina: f.maquinaNombre, activa,
                rango: f.tipo === 'gastos' && activa ? `Gastos externos · abierto desde ${fmtFecha(f.fechaInicio)}`
                    : activa ? `Activo desde ${fmtFecha(f.fechaInicio)}` : `${fmtFecha(f.fechaInicio)} → ${fmtFecha(f.fechaFin)}`,
                items: propios, hijos,
            };
        });
        const sueltos = items.filter(i => !usados.has(i.id));
        if (sueltos.length) out.push({ key: 'sin-periodo', nombre: 'Sin periodo asignado', maquina: '', activa: false, rango: '', items: sueltos,
            hijos: [{ key: 'sin-periodo-g', nombre: 'Sin periodo asignado', sub: '', fechas: '', est: 'sin', fijo: true, items: sueltos }] });
        const conStats = (g) => {
            const its = [...g.items].sort((a, b) => dia10(b.fecha).localeCompare(dia10(a.fecha)));
            const horas = its.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
            const dias = new Set(its.map(i => dia10(i.fecha))).size;
            return { ...g, items: its, horas, dias, total: its.reduce((a, i) => a + valorDe(modo, i), 0) };
        };
        return out.map(p => ({ ...conStats(p), hijos: p.hijos.map(conStats) }));
    }, [items, faenas, cortes, pagos, anidado, modo]);

    const todosHijos = periodos.flatMap(p => p.hijos);
    const hijosVisibles = (hs) => hs.filter(g => esGasto || filtro === 'todos' || (filtro === 'sin' ? g.est === 'sin' : filtro === 'pagado' ? g.est === 'pagado' : g.est === 'cobrar'));
    const abierto = (key, porDefecto) => (abiertos[key] !== undefined ? abiertos[key] : porDefecto);
    const alternar = (key, porDefecto) => setAbiertos(a => ({ ...a, [key]: !abierto(key, porDefecto) }));

    const guardarNombre = async (c) => {
        const limpio = nombreNuevo.trim();
        try {
            const r = await renombrarCorte(c.id, limpio);
            setCortes(prev => prev.map(x => (x.id === c.id ? { ...x, nombre: r.data?.nombre ?? (limpio || null) } : x)));
            setEditando(null);
            toast(limpio ? 'Nombre del corte guardado' : 'Se quitó el nombre del corte');
            onCambio?.();
        } catch { toast('No se pudo cambiar el nombre. Intenta de nuevo.', 'e'); }
    };

    const estadoChip = (g) => g.est === 'pagado' ? <Estado valor="Pagado" />
        : g.est === 'cobrar' ? (g.pago ? <Estado valor={ESTADO_PAGO[g.pago.estado] || g.pago.estado} /> : <Estado valor="Sin cobro" tono="neutral" />)
            : <Estado valor="Sin cortar" tono="neutral" />;

    const filaIngreso = (i) => {
        const esHoras = i.tipoTrabajo === 'Horas';
        const h = Number(i.cantidad) || 0;
        return (
            <div className="ic-row" key={i.id}>
                <span className="ic-f" data-l="Fecha"><b>{fmtFecha(i.fecha)}</b><small>{diaSemana(i.fecha)}</small></span>
                <span className="ic-d" data-l="Descripción">{i.descripcion}{!esHoras && <small>{i.tipoTrabajo}</small>}</span>
                <span className="ic-h" data-l="Horas">{esHoras ? <>{fmtHoras(h)} h</> : <>{i.cantidad} <small>{i.tipoTrabajo}</small></>}</span>
                <span className="ic-m" data-l="Horómetro">{esHoras && i.horometroInicio != null && i.horometroFin != null ? `${fmtHoro(i.horometroInicio)} → ${fmtHoro(i.horometroFin)}` : ''}</span>
                <span className="ic-t pos" data-l="Total">{fmt(i.total)}</span>
                <span className="ic-a">
                    {onEditar && <button type="button" className="icon-btn" aria-label="Editar ingreso" onClick={() => onEditar(i)}><Pencil size={14} /></button>}
                    {onEliminar && <button type="button" className="icon-btn" aria-label="Eliminar ingreso" onClick={() => onEliminar(i)}><Trash2 size={14} /></button>}
                </span>
            </div>
        );
    };

    const cuerpo = (g) => (
        <div className={`ic-tabla ${envoltura}`}>
            {renderFila ? (
                <>
                    <div className={claseCab} style={cols ? { gridTemplateColumns: cols } : undefined}>{(cabecera || []).map((h, k) => (typeof h === 'string' ? <span key={k}>{h}</span> : <span key={k} className={h.c} style={h.s}>{h.t}</span>))}</div>
                    {g.items.map(i => (
                        <div className={claseFila} key={i.id} style={cols ? { gridTemplateColumns: cols } : undefined}>{renderFila(i)}</div>
                    ))}
                </>
            ) : (
                <>
                    <div className="ic-row ic-hd"><span>Fecha</span><span>Descripción</span><span>Horas / cant.</span><span>Horómetro</span><span className="r">Total</span><span /></div>
                    {g.items.map(filaIngreso)}
                    <div className="ic-row ic-sub"><span><b>Subtotal</b></span><span /><span><b>{fmtHoras(g.horas)} h</b></span><span /><span className="ic-t"><b>{fmt(g.total)}</b></span><span /></div>
                </>
            )}
        </div>
    );

    const grupo = (g, porDefecto) => {
        const ab = abierto(g.key, porDefecto);
        const edita = g.corte && editando === g.corte.id;
        return (
            <div key={g.key} className={`ic-grupo ${ab ? 'open' : ''}`}>
                <div className="ic-gh" role="button" tabIndex={0} aria-expanded={ab}
                    onClick={() => { if (!edita) alternar(g.key, porDefecto); }}
                    onKeyDown={e => { if (!edita && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); alternar(g.key, porDefecto); } }}>
                    <ChevronRight size={16} className="ic-chev" />
                    <span className="ic-gt">
                        {edita ? (
                            <span className="ic-ren-fila" onClick={e => e.stopPropagation()}>
                                <input className="ic-nin" autoFocus maxLength={60} value={nombreNuevo} aria-label="Nombre del corte" placeholder="Nombre del corte"
                                    onChange={e => setNombreNuevo(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') guardarNombre(g.corte); if (e.key === 'Escape') setEditando(null); }} />
                                <button type="button" className="ic-ren" aria-label="Guardar nombre" onClick={() => guardarNombre(g.corte)}><Check size={15} /></button>
                                <button type="button" className="ic-ren" aria-label="Cancelar" onClick={() => setEditando(null)}><X size={15} /></button>
                            </span>
                        ) : (
                            <b>{g.nombre}{g.sub ? <em> · {g.sub}</em> : null}
                                {g.corte && <button type="button" className="ic-ren" aria-label={`Cambiar el nombre de ${g.nombre}`} title="Cambiar el nombre" onClick={e => { e.stopPropagation(); setNombreNuevo(g.corte.nombre || g.nombre); setEditando(g.corte.id); }}><Pencil size={12} /></button>}
                            </b>
                        )}
                        {g.fechas && <small>{g.fechas}</small>}
                    </span>
                    <span className="ic-gs">{esGasto ? null : estadoChip(g)}</span>
                    <span className="ic-gh2">
                        {esGasto
                            ? <><b>{g.items.length} gasto{g.items.length === 1 ? '' : 's'}</b></>
                            : <><b>{fmtHoras(g.horas)} h</b><small>{g.dias} día{g.dias === 1 ? '' : 's'}{g.dias > 0 && g.horas > 0 ? ` · ${fmtHoras(g.horas / g.dias)} h/día` : ''}</small></>}
                    </span>
                    <span className={`ic-gm ${esGasto ? 'neg' : ''}`}>{fmt(g.total)}</span>
                </div>
                {ab && cuerpo(g)}
            </div>
        );
    };

    if (!items.length) return null;

    const totH = items.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
    const totD = new Set(items.filter(i => i.tipoTrabajo === 'Horas' && Number(i.cantidad) > 0).map(i => dia10(i.fecha))).size;
    const totP = items.reduce((a, i) => a + valorDe(modo, i), 0);
    const cats = {};
    if (esGasto) items.forEach(g => { const k = g.categoria || 'Sin categoría'; cats[k] = (cats[k] || 0) + valorDe(modo, g); });
    const catTop = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];

    return (
        <div className="ic-wrap">
            {resumen && (
                <div className="ic-kpis">
                    {esGasto ? (
                        <>
                            <div><span>Total gastado</span><b className="neg">{fmt(totP)}</b></div>
                            <div><span>Gastos</span><b>{items.length}</b></div>
                            <div><span>Categoría principal</span><b className="ic-kt">{catTop ? catTop[0] : '—'}</b></div>
                            <div><span>Gasto promedio</span><b>{fmt(totP / items.length)}</b></div>
                        </>
                    ) : (
                        <>
                            <div><span>Horas</span><b>{fmtHoras(totH)}</b></div>
                            <div><span>Ingresos</span><b className="pos">{fmt(totP)}</b></div>
                            <div><span>Días trabajados</span><b>{totD}</b></div>
                            <div><span>Promedio por día</span><b>{totD ? fmtHoras(totH / totD) : '—'} h</b></div>
                        </>
                    )}
                </div>
            )}
            {!anidado && !esGasto && (
                <div className="ic-filtros">
                    {FILTROS.map(([k, l]) => <button key={k} type="button" className={filtro === k ? 'on' : ''} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l}</button>)}
                </div>
            )}
            {anidado ? periodos.filter(p => p.items.length > 0).map((p, idx) => {
                const ab = abierto(p.key, idx === 0);
                return (
                    <div key={p.key} className={`ic-per ${ab ? 'open' : ''}`}>
                        <div className="ic-ph" role="button" tabIndex={0} aria-expanded={ab}
                            onClick={() => alternar(p.key, idx === 0)}
                            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); alternar(p.key, idx === 0); } }}>
                            <ChevronRight size={18} className="ic-chev" />
                            <span className="ic-gt"><b><i className={`ic-punto ${p.activa ? '' : 'cerrado'}`} />{p.nombre}{mostrarMaquina && p.maquina ? <em> · {p.maquina}</em> : null}</b>{p.rango && <small>{p.rango}</small>}</span>
                            <span className="ic-gs">{p.activa ? <Estado valor="En curso" /> : <Estado valor="Cerrado" />}</span>
                            <span className="ic-gh2"><b>{p.hijos.filter(h => !h.fijo).length || (p.hijos.length ? 1 : 0)} {p.hijos.filter(h => !h.fijo).length ? 'corte' + (p.hijos.filter(h => !h.fijo).length === 1 ? '' : 's') : 'grupo'}</b><small>{esGasto ? `${p.items.length} gasto${p.items.length === 1 ? '' : 's'}` : `${fmtHoras(p.horas)} h`}</small></span>
                            <span className={`ic-gm ${esGasto ? 'neg' : ''}`}>{fmt(p.total)}</span>
                        </div>
                        {ab && <div className="ic-hijos">{hijosVisibles(p.hijos).map(g => grupo(g, false))}</div>}
                    </div>
                );
            }) : (
                <>
                    {hijosVisibles(todosHijos).length === 0 && <p className="ic-vacio">No hay cortes con ese estado.</p>}
                    {hijosVisibles(todosHijos).map((g, idx) => grupo(g, idx === 0))}
                </>
            )}
        </div>
    );
}

export default AgrupadoPorCorte;
