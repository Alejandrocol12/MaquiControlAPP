import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { getCortes, getPagos } from '../../api';
import Estado from '../../utils/Estado';
import { fmtFecha } from '../../utils/fmtFecha';
import { enRango, ordenarCortes, fmtHoras, diaSiguiente, hoyISO } from '../../utils/cortes';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const dia10 = (f) => String(f || '').slice(0, 10);
const diaSemana = (f) => { const [y, m, d] = dia10(f).split('-').map(Number); return DSEM[new Date(y, m - 1, d).getDay()] || ''; };
const ESTADO_PAGO = { Pagado: 'Pagado', Parcial: 'Parcial', Deuda: 'Pendiente' };
const FILTROS = [['todos', 'Todos los cortes'], ['sin', 'Sin cortar'], ['cobrar', 'Por cobrar'], ['pagado', 'Pagados']];

// Los ingresos de una máquina agrupados por corte: cada corte con su estado de cobro, sus horas,
// sus días trabajados y su total, y adentro los días. El corte en curso (lo que aún no se corta)
// va primero y abierto.
function IngresosPorCorte({ ingresos, faenas = [], onEditar, onEliminar, resumen = true }) {
    const [cortes, setCortes] = useState([]);
    const [pagos, setPagos] = useState([]);
    const [filtro, setFiltro] = useState('todos');
    const [abiertos, setAbiertos] = useState({});

    useEffect(() => {
        let vivo = true;
        Promise.all([getCortes(), getPagos()])
            .then(([c, p]) => { if (vivo) { setCortes(c.data || []); setPagos(p.data || []); } })
            .catch(() => {});
        return () => { vivo = false; };
    }, [ingresos.length]);

    const grupos = useMemo(() => {
        const out = [];
        const usados = new Set();
        const fs = [...faenas].sort((a, b) => dia10(b.fechaInicio).localeCompare(dia10(a.fechaInicio)));
        fs.forEach(f => {
            const propios = ingresos.filter(i => String(i.faenaId) === String(f.id));
            const cs = ordenarCortes(cortes.filter(c => String(c.faenaId) === String(f.id)));
            const sub = fs.length > 1 ? (f.nombreObra || 'Periodo') : '';
            const activa = f.estado === 'activa' || f.estado === 'abierta';
            const ultimo = cs[cs.length - 1];
            const sigue = ultimo ? diaSiguiente(ultimo.fechaFin) : dia10(f.fechaInicio);
            const curso = propios.filter(i => !cs.some(c => enRango(i.fecha, c.fechaInicio, c.fechaFin)));
            if (curso.length) {
                out.push({
                    key: `f${f.id}-curso`, nombre: activa ? 'En curso' : 'Sin cortar', sub,
                    fechas: `${fmtFecha(sigue)} a ${activa ? 'hoy' : fmtFecha(f.fechaFin || hoyISO())}`,
                    est: 'sin', items: curso,
                });
            }
            [...cs].reverse().forEach(c => {
                const items = propios.filter(i => enRango(i.fecha, c.fechaInicio, c.fechaFin));
                if (!items.length) return;
                const pago = c.pagoClienteId ? pagos.find(p => String(p.id) === String(c.pagoClienteId)) : null;
                out.push({
                    key: `c${c.id}`, nombre: `Corte ${cs.indexOf(c) + 1}`, sub,
                    fechas: `${fmtFecha(c.fechaInicio)} a ${fmtFecha(c.fechaFin)}`,
                    est: pago ? (pago.estado === 'Pagado' ? 'pagado' : 'cobrar') : 'cobrar',
                    pago, items,
                });
            });
            propios.forEach(i => usados.add(i.id));
        });
        const sueltos = ingresos.filter(i => !usados.has(i.id));
        if (sueltos.length) out.push({ key: 'sin-periodo', nombre: 'Sin periodo asignado', sub: '', fechas: '', est: 'sin', items: sueltos });
        return out.map(g => {
            const items = [...g.items].sort((a, b) => dia10(b.fecha).localeCompare(dia10(a.fecha)));
            const horas = items.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
            const dias = new Set(items.map(i => dia10(i.fecha))).size;
            return { ...g, items, horas, dias, total: items.reduce((a, i) => a + (Number(i.total) || 0), 0) };
        });
    }, [ingresos, faenas, cortes, pagos]);

    const visibles = grupos.filter(g => filtro === 'todos' || (filtro === 'sin' ? g.est === 'sin' : filtro === 'pagado' ? g.est === 'pagado' : g.est === 'cobrar'));
    const totHoras = ingresos.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
    const totDias = new Set(ingresos.filter(i => i.tipoTrabajo === 'Horas' && Number(i.cantidad) > 0).map(i => dia10(i.fecha))).size;
    const totPesos = ingresos.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const abierto = (g, idx) => (abiertos[g.key] !== undefined ? abiertos[g.key] : idx === 0);
    const estadoChip = (g) => g.est === 'pagado' ? <Estado valor="Pagado" />
        : g.est === 'cobrar' ? (g.pago ? <Estado valor={ESTADO_PAGO[g.pago.estado] || g.pago.estado} /> : <Estado valor="Sin cobro" tono="neutral" />)
            : <Estado valor="Sin cortar" tono="neutral" />;

    if (!ingresos.length) return null;

    return (
        <div className="ic-wrap">
            {resumen && (
                <div className="ic-kpis">
                    <div><span>Horas</span><b>{fmtHoras(totHoras)}</b></div>
                    <div><span>Ingresos</span><b className="pos">{fmt(totPesos)}</b></div>
                    <div><span>Días trabajados</span><b>{totDias}</b></div>
                    <div><span>Promedio por día</span><b>{totDias ? fmtHoras(totHoras / totDias) : '—'} h</b></div>
                </div>
            )}
            <div className="ic-filtros">
                {FILTROS.map(([k, l]) => <button key={k} type="button" className={filtro === k ? 'on' : ''} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l}</button>)}
            </div>
            {visibles.length === 0 && <p className="ic-vacio">No hay cortes con ese estado.</p>}
            {visibles.map((g) => {
                const idx = grupos.indexOf(g);
                const ab = abierto(g, idx);
                return (
                    <div key={g.key} className={`ic-grupo ${ab ? 'open' : ''}`}>
                        <button type="button" className="ic-gh" aria-expanded={ab} onClick={() => setAbiertos(a => ({ ...a, [g.key]: !ab }))}>
                            <ChevronRight size={16} className="ic-chev" />
                            <span className="ic-gt"><b>{g.nombre}{g.sub ? <em> · {g.sub}</em> : null}</b>{g.fechas && <small>{g.fechas}</small>}</span>
                            <span className="ic-gs">{estadoChip(g)}</span>
                            <span className="ic-gh2"><b>{fmtHoras(g.horas)} h</b><small>{g.dias} día{g.dias === 1 ? '' : 's'}{g.dias > 0 && g.horas > 0 ? ` · ${fmtHoras(g.horas / g.dias)} h/día` : ''}</small></span>
                            <span className="ic-gm">{fmt(g.total)}</span>
                        </button>
                        {ab && (
                            <div className="ic-tabla">
                                <div className="ic-row ic-hd"><span>Fecha</span><span>Descripción</span><span>Horas / cant.</span><span>Horómetro</span><span className="r">Total</span><span /></div>
                                {g.items.map(i => {
                                    const esHoras = i.tipoTrabajo === 'Horas';
                                    const h = Number(i.cantidad) || 0;
                                    return (
                                        <div className="ic-row" key={i.id}>
                                            <span className="ic-f" data-l="Fecha"><b>{fmtFecha(i.fecha)}</b><small>{diaSemana(i.fecha)}</small></span>
                                            <span className="ic-d" data-l="Descripción">{i.descripcion}{!esHoras && <small>{i.tipoTrabajo}</small>}</span>
                                            <span className="ic-h" data-l="Horas">{esHoras ? <>{fmtHoras(h)} h <i className="ic-bar"><u style={{ width: `${Math.min(100, h / 12 * 100)}%` }} /></i></> : <>{i.cantidad} <small>{i.tipoTrabajo}</small></>}</span>
                                            <span className="ic-m" data-l="Horómetro">{esHoras && i.horometroInicio != null && i.horometroFin != null ? `${Number(i.horometroInicio).toLocaleString('es-CO')} → ${Number(i.horometroFin).toLocaleString('es-CO')}` : ''}</span>
                                            <span className="ic-t pos" data-l="Total">{fmt(i.total)}</span>
                                            <span className="ic-a">
                                                {onEditar && <button type="button" className="icon-btn" aria-label="Editar ingreso" onClick={() => onEditar(i)}><Pencil size={14} /></button>}
                                                {onEliminar && <button type="button" className="icon-btn" aria-label="Eliminar ingreso" onClick={() => onEliminar(i)}><Trash2 size={14} /></button>}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div className="ic-row ic-sub"><span><b>Subtotal</b></span><span /><span><b>{fmtHoras(g.horas)} h</b></span><span /><span className="ic-t"><b>{fmt(g.total)}</b></span><span /></div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default IngresosPorCorte;
