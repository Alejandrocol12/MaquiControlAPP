import { useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import Estado from '../../utils/Estado';
import { fmtFecha } from '../../utils/fmtFecha';
import { fmtHoras } from '../../utils/cortes';
import { fmtHoro } from '../../utils/horometro';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const diaSemana = (f) => { const [y, m, d] = String(f || '').slice(0, 10).split('-').map(Number); return DSEM[new Date(y, m - 1, d).getDay()] || ''; };
const horasDe = (h) => Number(h.horas ?? 0) || 0;
const ESTADO = { curso: <Estado valor="En curso" />, pagado: <Estado valor="Pagado" />, parcial: <Estado valor="Parcial" />, pendiente: <Estado valor="Pendiente" /> };

// Las horas del operador agrupadas por corte del periodo. Cada grupo muestra sus horas, lo ganado y
// cómo va su pago; el corte en curso viene abierto y los demás se abren con un toque.
function HorasPorCorte({ grupos, valorHora, onEliminar }) {
    const [abiertos, setAbiertos] = useState({});
    const abierto = (k, porDefecto) => (abiertos[k] !== undefined ? abiertos[k] : porDefecto);

    return (
        <div className="ic-wrap">
            {grupos.map((g, idx) => {
                const ab = abierto(g.key, idx === 0);
                const horas = g.items.reduce((a, h) => a + horasDe(h), 0);
                const ganado = g.items.reduce((a, h) => a + horasDe(h) * (h.valorHora || valorHora), 0);
                const dias = new Set(g.items.map(h => String(h.fecha || '').slice(0, 10))).size;
                return (
                    <div key={g.key} className={`ic-grupo ${ab ? 'open' : ''}`}>
                        <div className="ic-gh" role="button" tabIndex={0} aria-expanded={ab}
                            onClick={() => setAbiertos(a => ({ ...a, [g.key]: !ab }))}
                            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setAbiertos(a => ({ ...a, [g.key]: !ab })); } }}>
                            <ChevronRight size={16} className="ic-chev" />
                            <span className="ic-gt"><b>{g.nombre}</b>{g.fechas && <small>{g.fechas}</small>}</span>
                            <span className="ic-gs">{g.estado ? ESTADO[g.estado] : null}</span>
                            <span className="ic-gh2"><b>{fmtHoras(horas)} h</b><small>{dias} día{dias === 1 ? '' : 's'}{g.debe > 0 ? ` · le debes ${fmt(g.debe)}` : ''}</small></span>
                            <span className="ic-gm">{fmt(ganado)}</span>
                        </div>
                        {ab && (
                            <div className="ic-tabla">
                                <div className="ic-row ic-hd"><span>Fecha</span><span>Máquina</span><span>Horas</span><span>Horómetro inicio</span><span>Horómetro fin</span><span className="r">Valor</span><span /></div>
                                {g.items.map(h => (
                                    <div className="ic-row" key={h.id}>
                                        <span className="ic-f" data-l="Fecha"><b>{fmtFecha(h.fecha)}</b><small>{diaSemana(h.fecha)}</small></span>
                                        <span className="ic-d" data-l="Máquina">{h.maquinaNombre}</span>
                                        <span className="ic-h" data-l="Horas">{fmtHoras(horasDe(h))} h</span>
                                        <span className="ic-m" data-l="Inicio">{h.horometroInicio ? fmtHoro(h.horometroInicio) : ''}</span>
                                        <span className="ic-m" data-l="Fin">{h.horometroFin ? fmtHoro(h.horometroFin) : ''}</span>
                                        <span className="ic-t pos" data-l="Valor">{fmt(horasDe(h) * (h.valorHora || valorHora))}</span>
                                        <span className="ic-a">
                                            {onEliminar && <button type="button" className="icon-btn" aria-label="Eliminar registro de horas" onClick={() => onEliminar(h)}><Trash2 size={14} /></button>}
                                        </span>
                                    </div>
                                ))}
                                <div className="ic-row ic-sub"><span><b>Subtotal</b></span><span /><span><b>{fmtHoras(horas)} h</b></span><span /><span /><span className="ic-t"><b>{fmt(ganado)}</b></span><span /></div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default HorasPorCorte;
