import { Flame, AlertTriangle } from 'lucide-react';
import { fmtFecha } from '../../utils/fmtFecha';
import { fmtHoras } from '../../utils/cortes';
import { DIAS_SIN_DESCANSO } from '../../utils/racha';
import './RachaOperador.css';

const INICIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const diaSem = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

// Racha del operador: los días seguidos que lleva trabajando (con todo su historial), una tira con los
// últimos 14 días y su mejor racha. Avisa cuando lleva demasiados turnos sin un día de descanso.
export default function RachaOperador({ racha }) {
    const { actual, mejor, ultimo, hoyTrabajado, horasHoy, diasDesdeUltimo, tira, sinDescanso, totalDias } = racha;

    if (!totalDias) {
        return (
            <section className="rc-card vacia">
                <span className="rc-llama off"><Flame size={26} aria-hidden="true" /></span>
                <div><b>Sin turnos registrados</b><small>Cuando registre horas, aquí verás cuántos días seguidos lleva trabajando.</small></div>
            </section>
        );
    }

    const estado = actual > 0
        ? (hoyTrabajado ? `Hoy ya registró ${fmtHoras(horasHoy)} h` : 'Hoy todavía no registra horas')
        : `Racha cortada: último turno ${diasDesdeUltimo === 2 ? 'antes de ayer' : `hace ${diasDesdeUltimo} días`} (${fmtFecha(ultimo)})`;

    return (
        <section className={`rc-card${sinDescanso ? ' alerta' : ''}`} aria-label="Racha de turnos">
            <div className="rc-top">
                <span className={`rc-llama${actual > 0 ? '' : ' off'}`}><Flame size={28} aria-hidden="true" /></span>
                <div className="rc-num">
                    <b>{actual}<small> turno{actual === 1 ? '' : 's'} seguido{actual === 1 ? '' : 's'}</small></b>
                    <span>{estado}</span>
                </div>
                <div className="rc-mejor">
                    <span>Mejor racha</span>
                    <b>{mejor} {mejor === 1 ? 'día' : 'días'}</b>
                </div>
            </div>

            <div className="rc-tira" role="img" aria-label={`Últimos ${tira.length} días: ${tira.filter(d => d.horas > 0).length} con turno`}>
                {tira.map(d => (
                    <div key={d.fecha} className="rc-dia" title={`${fmtFecha(d.fecha)}: ${d.horas > 0 ? `${fmtHoras(d.horas)} h` : 'sin turno'}`}>
                        <i className={`${d.horas > 0 ? 'si' : ''}${d.hoy ? ' hoy' : ''}`} />
                        <small className={d.hoy ? 'hoy' : ''}>{INICIAL[diaSem(d.fecha)]}</small>
                    </div>
                ))}
            </div>

            {sinDescanso && (
                <div className="rc-aviso"><AlertTriangle size={14} aria-hidden="true" />Lleva {actual} turnos seguidos (desde {DIAS_SIN_DESCANSO}, conviene darle un día de descanso).</div>
            )}
        </section>
    );
}
