import { useState, useMemo } from 'react';
import FiltroChips from '../../utils/FiltroChips';
import EmptyState from '../../utils/EmptyState';
import { fmtFecha } from '../../utils/fmtFecha';
import { History } from 'lucide-react';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const num = (n) => String(Math.round((Number(n) || 0) * 10) / 10).replace('.', ',');
const PASO = 40;

// Hoja de vida de la máquina: todo lo que le ha pasado, en orden, como un historial clínico.
function HistoriaMaquina({ ingresos, gastos, combustibles, mantenimientos, faenas, pagos }) {
    const [filtro, setFiltro] = useState('todo');
    const [limite, setLimite] = useState(PASO);

    const eventos = useMemo(() => {
        const ev = [];
        ingresos.forEach(i => ev.push({
            k: 'ing', id: `i${i.id}`, fecha: i.fecha,
            t: i.descripcion || `Trabajo por ${i.tipoTrabajo}`,
            s: i.tipoTrabajo === 'Horas' ? `${num(i.cantidad)} h` : `${num(i.cantidad)} ${i.tipoTrabajo}`,
            monto: Number(i.total) || 0, signo: '+',
        }));
        // Los gastos que se crean solos desde Combustible y Mantenimientos ya salen como su propio evento.
        gastos.filter(g => !g.descripcion?.includes('Combustible —') && !(g.categoria === 'Mantenimiento' && g.descripcion?.startsWith('Mantenimiento —')))
            .forEach(g => ev.push({
                k: 'gas', id: `g${g.id}`, fecha: g.fecha,
                t: g.descripcion || 'Gasto', s: g.categoria || 'Gasto',
                monto: Number(g.monto) || 0, signo: '−',
            }));
        combustibles.forEach(c => ev.push({
            k: 'com', id: `c${c.id}`, fecha: c.fecha,
            t: `Carga de combustible, ${num(c.galones)} gal`,
            s: c.horometro ? `Horómetro ${Number(c.horometro).toLocaleString('es-CO')}` : 'Combustible',
            monto: Number(c.total) || 0, signo: '−',
        }));
        mantenimientos.forEach(m => ev.push({
            k: 'man', id: `m${m.id}`, fecha: m.fecha,
            t: `${m.tipo || 'Mantenimiento'}${m.descripcion ? `: ${m.descripcion}` : ''}`,
            s: [m.estado, m.tecnico].filter(Boolean).join(' · ') || 'Mantenimiento',
            monto: Number(m.costo) || 0, signo: '−',
        }));
        faenas.forEach(f => {
            if (f.fechaInicio) ev.push({ k: 'per', id: `fa${f.id}`, fecha: f.fechaInicio, t: `Abrió periodo: ${f.nombreObra}`, s: f.cliente || 'Periodo' });
            if (f.fechaFin && f.estado !== 'activa') ev.push({ k: 'per', id: `fc${f.id}`, fecha: f.fechaFin, t: `Cerró periodo: ${f.nombreObra}`, s: f.cliente || 'Periodo' });
        });
        pagos.forEach(p => ev.push({
            k: 'pag', id: `p${p.id}`, fecha: p.fecha,
            t: `Pago de ${p.cliente}`, s: p.descripcion || 'Pago de cliente',
            monto: Number(p.valorPagado) || 0, signo: 'pago',
        }));
        return ev.filter(e => e.fecha).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    }, [ingresos, gastos, combustibles, mantenimientos, faenas, pagos]);

    const visibles = filtro === 'todo' ? eventos : eventos.filter(e => e.k === filtro);
    const mostrados = visibles.slice(0, limite);

    let mesPrevio = null;

    return (
        <div>
            <FiltroChips
                className="mq-filtros"
                valor={filtro}
                onChange={(k) => { setFiltro(k); setLimite(PASO); }}
                opciones={[
                    { key: 'todo', label: 'Todo' },
                    { key: 'ing', label: 'Ingresos' },
                    { key: 'gas', label: 'Gastos' },
                    { key: 'com', label: 'Combustible' },
                    { key: 'man', label: 'Mantenimiento' },
                    { key: 'per', label: 'Periodos' },
                    { key: 'pag', label: 'Pagos' },
                ]}
            />
            {visibles.length === 0 ? (
                <div className="tbl">
                    <EmptyState icono={<History size={20} />} titulo="No hay nada en la historia todavía" texto="Aquí van apareciendo los trabajos, gastos, cargas de combustible, mantenimientos y periodos de esta máquina, en orden." />
                </div>
            ) : (
                <div className="mq-tl">
                    {mostrados.map(e => {
                        const mes = String(e.fecha).slice(0, 7);
                        const cabecera = mes !== mesPrevio;
                        mesPrevio = mes;
                        const [y, m] = mes.split('-').map(Number);
                        const etiqueta = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
                        return (
                            <div key={e.id} className="mq-tl-item">
                                {cabecera && <div className="mq-tl-mes">{etiqueta}</div>}
                                <div className={`mq-tl-ev k-${e.k}`}>
                                    <span className="mq-tl-t">{e.t}<span>{fmtFecha(e.fecha)} · {e.s}</span></span>
                                    {e.monto != null && (
                                        <span className={`mq-tl-m ${e.signo === '+' ? 'pos' : e.signo === '−' ? 'neg' : ''}`}>
                                            {e.signo === 'pago' ? 'Abonó ' : e.signo}{fmt(e.monto)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {visibles.length > limite && (
                        <button type="button" className="bs mq-tl-mas" onClick={() => setLimite(l => l + PASO)}>
                            Ver más ({visibles.length - limite} restantes)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default HistoriaMaquina;
