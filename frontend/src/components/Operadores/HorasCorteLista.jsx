import { fmtFecha } from '../../utils/fmtFecha';
import { fmtHoro } from '../../utils/horometro';
import { fmtHoras } from '../../utils/cortes';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const diaSemana = (f) => { const [y, m, d] = String(f || '').slice(0, 10).split('-').map(Number); return DIAS[new Date(y, m - 1, d).getDay()] || ''; };

// Los turnos de un corte, uno por uno: día, horómetro, máquina, horas y lo que valen
export default function HorasCorteLista({ horas, valorHora, getHrs }) {
    return (
        <div className="hcl">
            <div className="hcl-cab">
                <b>Partes diarios del corte ({horas.length} turno{horas.length === 1 ? '' : 's'})</b>
            </div>
            {horas.length === 0 ? <p className="hcl-vacio">No hay horas registradas en este corte.</p> : (
                <ul>
                    {horas.map(h => {
                        const n = getHrs(h);
                        return (
                            <li key={h.id}>
                                <div>
                                    <span className="hcl-f"><b>{fmtFecha(h.fecha)}</b> ({diaSemana(h.fecha)})</span>
                                    {h.horometroInicio != null && h.horometroFin != null && h.horometroFin !== '' && (
                                        <span className="hcl-horo">{fmtHoro(h.horometroInicio)} → {fmtHoro(h.horometroFin)}</span>
                                    )}
                                    <small>{h.maquinaNombre}</small>
                                </div>
                                <div className="hcl-d">
                                    <b>{fmtHoras(n)} h</b>
                                    <small>{fmt(n * (Number(h.valorHora) || valorHora))}</small>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
