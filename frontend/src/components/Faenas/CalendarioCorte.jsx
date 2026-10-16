import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { enRango, hoyISO, fmtHoras } from '../../utils/cortes';
import { fmtFecha } from '../../utils/fmtFecha';

const DOWS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const aMes = (f) => { const [y, m] = String(f).slice(0, 10).split('-').map(Number); return y * 12 + (m - 1); };
const diasEntre = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5) + 1;
const ayer = () => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d.getFullYear(), d.getMonth(), d.getDate()); };

// Calendario para elegir las fechas de un corte. Un toque en un día marca hasta dónde llega el
// corte; un toque en un día anterior al inicio mueve el inicio. Los días que ya están dentro de
// otro corte, antes del periodo o después de hoy no se pueden tocar.
function CalendarioCorte({ desde, hasta, min, max, cortes = [], ingresos = [], onCambio }) {
    const [mes, setMes] = useState(() => {
        const base = String(hasta || max || hoyISO()).slice(0, 10);
        const [y, m] = base.split('-').map(Number);
        return { y, m: m - 1 };
    });

    const horasDia = useMemo(() => {
        const r = {};
        ingresos.filter(i => i.tipoTrabajo === 'Horas' && i.fecha).forEach(i => {
            const k = String(i.fecha).slice(0, 10);
            r[k] = (r[k] || 0) + (Number(i.cantidad) || 0);
        });
        return r;
    }, [ingresos]);

    const hoy = hoyISO();
    const bloqueado = (k) => (min && k < min) || (max && k > max) || cortes.some(c => enRango(k, c.fechaInicio, c.fechaFin));
    const cruza = (a, b) => cortes.some(c => a <= String(c.fechaFin).slice(0, 10) && b >= String(c.fechaInicio).slice(0, 10));

    const tocar = (k) => {
        if (bloqueado(k)) return;
        if (!desde || k < desde) {
            // mover el inicio; si ese tramo choca con otro corte, se empieza un rango nuevo en ese día
            onCambio(!hasta || cruza(k, hasta) ? { desde: k, hasta: k } : { desde: k, hasta });
        } else {
            onCambio({ desde, hasta: k });
        }
    };

    const diasMes = new Date(mes.y, mes.m + 1, 0).getDate();
    const offset = (new Date(mes.y, mes.m, 1).getDay() + 6) % 7;
    const etiqueta = new Date(mes.y, mes.m, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const actual = mes.y * 12 + mes.m;
    const hayAnterior = !min || actual > aMes(min);
    const haySiguiente = !max || actual < aMes(max);
    const mover = (delta) => setMes(({ y, m }) => { const nd = new Date(y, m + delta, 1); return { y: nd.getFullYear(), m: nd.getMonth() }; });

    const atajo = (h) => { if (!bloqueado(h) && desde && h >= desde) onCambio({ desde, hasta: h }); };
    const topeHoy = max && max < hoy ? max : hoy;

    return (
        <div className="ct-cal">
            <div className="ct-cal-head">
                <button type="button" className="ct-cal-nav" aria-label="Mes anterior" onClick={() => mover(-1)} disabled={!hayAnterior}><ChevronLeft size={15} /></button>
                <b>{etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1)}</b>
                <button type="button" className="ct-cal-nav" aria-label="Mes siguiente" onClick={() => mover(1)} disabled={!haySiguiente}><ChevronRight size={15} /></button>
            </div>
            <div className="ct-cal-grid">
                {DOWS.map(d => <span key={d} className="ct-cal-dow">{d}</span>)}
                {Array.from({ length: offset }, (_, i) => <span key={`e${i}`} />)}
                {Array.from({ length: diasMes }, (_, i) => {
                    const d = i + 1;
                    const k = iso(mes.y, mes.m, d);
                    const bl = bloqueado(k);
                    const dentro = desde && hasta && k >= desde && k <= hasta;
                    const h = horasDia[k] || 0;
                    return (
                        <button key={k} type="button" disabled={bl}
                            className={`ct-cal-day ${bl ? 'bloq' : ''} ${dentro ? 'rng' : ''} ${k === desde ? 'ini' : ''} ${k === hasta ? 'fin' : ''} ${k === hoy ? 'hoy' : ''} ${h > 0 ? 'conh' : ''}`}
                            aria-label={`${fmtFecha(k)}${h > 0 ? `, ${fmtHoras(h)} horas` : ''}${bl ? ', no disponible' : ''}`}
                            aria-pressed={!!dentro}
                            onClick={() => tocar(k)}>
                            <span>{d}</span>
                            {h > 0 && <small>{fmtHoras(h)} h</small>}
                        </button>
                    );
                })}
            </div>
            <div className="ct-cal-pie">
                <span className="ct-cal-rango">
                    {desde && hasta
                        ? <>Del <b>{fmtFecha(desde)}</b> al <b>{fmtFecha(hasta)}</b> · {diasEntre(desde, hasta)} día{diasEntre(desde, hasta) === 1 ? '' : 's'}</>
                        : 'Toca el último día del corte'}
                </span>
                <span className="ct-cal-atajos">
                    <button type="button" className="ct-link" onClick={() => atajo(topeHoy)}>Hasta hoy</button>
                    <button type="button" className="ct-link" onClick={() => atajo(ayer())}>Hasta ayer</button>
                </span>
            </div>
            <p className="ct-cal-ayuda">Toca un día para cortar hasta ahí. Si tocas un día antes del inicio, se mueve el inicio.</p>
        </div>
    );
}

export default CalendarioCorte;
