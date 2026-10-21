import { useState, useMemo, useEffect } from 'react';
import { History, Gauge, Fuel, Wrench, Briefcase, CreditCard, Scissors, TrendingDown, CloudRain, Moon } from 'lucide-react';
import { getCortes, getPartesDiarios } from '../../api';
import EmptyState from '../../utils/EmptyState';
import { fmtFecha } from '../../utils/fmtFecha';
import { fmtHoro } from '../../utils/horometro';
import { ordenarCortes, nombreCorte } from '../../utils/cortes';
import './HistoriaMaquina.css';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const num = (n) => String(Math.round((Number(n) || 0) * 10) / 10).replace('.', ',');
const PASO = 40;
const FILTROS = [
    ['todo', 'Todo'], ['ing', 'Ingresos'], ['gas', 'Gastos'], ['com', 'Combustible'], ['man', 'Mantenimiento'],
    ['per', 'Periodos'], ['cor', 'Cortes'], ['pag', 'Pagos'], ['par', 'Partes diarios'],
];
const ICONO = { ing: Gauge, gas: TrendingDown, com: Fuel, man: Wrench, per: Briefcase, cor: Scissors, pag: CreditCard, lluvia: CloudRain, descanso: Moon, par: Wrench };
const ESTADOS = { LLUVIA: 'Parado por lluvia', MANTENIMIENTO: 'Mantenimiento', DESCANSO: 'Día de descanso' };

// Bitácora de la máquina: todo lo que le ha pasado, en orden cronológico, con un ícono por tipo de evento.
function HistoriaMaquina({ maquina, ingresos, gastos, combustibles, mantenimientos, faenas, pagos }) {
    const [filtro, setFiltro] = useState('todo');
    const [limite, setLimite] = useState(PASO);
    const [cortes, setCortes] = useState([]);
    const [partes, setPartes] = useState([]);

    useEffect(() => {
        const ids = new Set(faenas.map(f => String(f.id)));
        getCortes().then(r => setCortes((r.data || []).filter(c => ids.has(String(c.faenaId))))).catch(() => {});
    }, [faenas]);
    useEffect(() => { getPartesDiarios(maquina).then(r => setPartes(r.data || [])).catch(() => {}); }, [maquina]);

    const eventos = useMemo(() => {
        const ev = [];
        ingresos.forEach(i => ev.push({
            k: 'ing', id: `i${i.id}`, fecha: i.fecha, titulo: 'Registro de trabajo',
            chip: i.tipoTrabajo === 'Horas' ? `${num(i.cantidad)} h` : `${num(i.cantidad)} ${i.tipoTrabajo}`,
            texto: i.descripcion || `Trabajo por ${i.tipoTrabajo}`,
            extra: i.horometroFin != null ? `Horómetro final: ${fmtHoro(i.horometroFin)} h` : '',
            monto: Number(i.total) || 0, signo: '+',
        }));
        // Los gastos que se crean solos desde Combustible y Mantenimientos ya salen como su propio evento.
        gastos.filter(g => !g.descripcion?.includes('Combustible —') && !(g.categoria === 'Mantenimiento' && g.descripcion?.startsWith('Mantenimiento —')))
            .forEach(g => ev.push({
                k: 'gas', id: `g${g.id}`, fecha: g.fecha, titulo: `Registro de gasto${g.categoria ? ` de ${g.categoria.toLowerCase()}` : ''}`,
                chip: fmt(g.monto), texto: g.descripcion || 'Gasto',
                extra: [g.proveedor, g.numeroFactura, g.pagadoPor && `Pagó: ${g.pagadoPor}`].filter(Boolean).join(' · '),
                monto: Number(g.monto) || 0, signo: '−',
            }));
        combustibles.forEach(c => ev.push({
            k: 'com', id: `c${c.id}`, fecha: c.fecha, titulo: 'Carga de combustible', chip: `${num(c.galones)} gal`,
            texto: `Se cargaron ${num(c.galones)} galones.`, extra: c.horometro ? `Horómetro ${fmtHoro(c.horometro)}` : '',
            monto: Number(c.total) || 0, signo: '−',
        }));
        mantenimientos.forEach(m => ev.push({
            k: 'man', id: `m${m.id}`, fecha: m.fecha, titulo: m.tipo || 'Mantenimiento', chip: m.estado || '',
            texto: m.descripcion || 'Mantenimiento de la máquina', extra: m.tecnico ? `Técnico: ${m.tecnico}` : '',
            monto: Number(m.costo) || 0, signo: '−',
        }));
        faenas.forEach(f => {
            if (f.fechaInicio) ev.push({ k: 'per', id: `fa${f.id}`, fecha: f.fechaInicio, titulo: 'Apertura de periodo', texto: `Se abrió el periodo ${f.nombreObra}.`, extra: f.cliente ? `Cliente: ${f.cliente}` : '' });
            if (f.fechaFin && f.estado !== 'activa') ev.push({ k: 'per', id: `fc${f.id}`, fecha: f.fechaFin, titulo: 'Cierre de periodo', texto: `Se cerró el periodo ${f.nombreObra}.`, extra: f.cliente ? `Cliente: ${f.cliente}` : '' });
        });
        const porFaena = {};
        cortes.forEach(c => { (porFaena[c.faenaId] = porFaena[c.faenaId] || []).push(c); });
        Object.values(porFaena).forEach(lista => ordenarCortes(lista).forEach((c, i) => ev.push({
            k: 'cor', id: `co${c.id}`, fecha: c.fechaFin, titulo: `Cierre de ${nombreCorte(c, i + 1)}`, chip: `${num(c.horas)} h`,
            texto: `Se cerró con ${num(c.horas)} horas trabajadas (${fmt(c.total)} facturados).`,
            extra: `${fmtFecha(c.fechaInicio)} al ${fmtFecha(c.fechaFin)}`,
        })));
        pagos.forEach(p => ev.push({
            k: 'pag', id: `p${p.id}`, fecha: p.fecha, titulo: `Pago de ${p.cliente}`,
            texto: p.descripcion || 'Pago de cliente', extra: [p.metodoPago, p.comprobante].filter(Boolean).join(' · '),
            monto: Number(p.valorPagado) || 0, signo: 'pago',
        }));
        partes.filter(p => p.estadoOperacion && p.estadoOperacion !== 'NORMAL').forEach(p => ev.push({
            k: 'par', icono: p.estadoOperacion === 'LLUVIA' ? 'lluvia' : p.estadoOperacion === 'DESCANSO' ? 'descanso' : 'man',
            id: `pd${p.id}`, fecha: p.fecha, titulo: ESTADOS[p.estadoOperacion] || 'Parte diario',
            texto: p.actividad || p.observaciones || 'Día sin trabajo.', extra: p.actividad && p.observaciones ? p.observaciones : '',
        }));
        return ev.filter(e => e.fecha).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    }, [ingresos, gastos, combustibles, mantenimientos, faenas, pagos, cortes, partes]);

    const visibles = filtro === 'todo' ? eventos : eventos.filter(e => e.k === filtro);
    const mostrados = visibles.slice(0, limite);
    let mesPrevio = null;

    return (
        <div className="hm">
            <header className="hm-cab">
                <span className="hm-eyebrow">Bitácora de trazabilidad</span>
                <h2>Historial de Operaciones · {maquina}</h2>
                <p>Registro cronológico de horómetros, gastos, cortes, pagos y novedades de la máquina</p>
                <div className="hm-filtros" role="group" aria-label="Filtrar eventos">
                    {FILTROS.map(([k, l]) => (
                        <button key={k} type="button" className={filtro === k ? 'on' : ''} aria-pressed={filtro === k}
                            onClick={() => { setFiltro(k); setLimite(PASO); }}>{l}</button>
                    ))}
                </div>
            </header>

            {visibles.length === 0 ? (
                <div className="hm-lista vacia">
                    <EmptyState icono={<History size={20} />} titulo="No hay nada en la historia todavía" texto="Aquí van apareciendo los trabajos, gastos, cortes, pagos y novedades de esta máquina, en orden." />
                </div>
            ) : (
                <div className="hm-lista">
                    <ol>
                        {mostrados.map(e => {
                            const mes = String(e.fecha).slice(0, 7);
                            const nuevoMes = mes !== mesPrevio;
                            mesPrevio = mes;
                            const [y, m] = mes.split('-').map(Number);
                            const etiqueta = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
                            const Icono = ICONO[e.icono || e.k] || History;
                            return (
                                <li key={e.id}>
                                    {nuevoMes && <div className="hm-mes">{etiqueta}</div>}
                                    <div className="hm-evento">
                                        <span className={`hm-nodo k-${e.icono || e.k}`} aria-hidden="true"><Icono size={15} /></span>
                                        <article className="hm-tarjeta">
                                            <div className="hm-top">
                                                <h3>{e.titulo}{e.chip && <span className={`hm-chip k-${e.k}`}>{e.chip}</span>}</h3>
                                                <time dateTime={String(e.fecha).slice(0, 10)}>{fmtFecha(e.fecha)}</time>
                                            </div>
                                            <p>{e.texto}</p>
                                            <div className="hm-pie">
                                                <span>{e.extra}</span>
                                                {e.monto != null && (
                                                    <b className={e.signo === '+' ? 'pos' : e.signo === '−' ? 'neg' : 'pago'}>
                                                        {e.signo === 'pago' ? 'Abonó ' : e.signo}{fmt(e.monto)}
                                                    </b>
                                                )}
                                            </div>
                                        </article>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                    {visibles.length > limite && (
                        <button type="button" className="hm-mas" onClick={() => setLimite(l => l + PASO)}>
                            Ver más ({visibles.length - limite} restantes)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default HistoriaMaquina;
