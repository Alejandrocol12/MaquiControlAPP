import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DOWS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DNAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const nivel = (h) => (h <= 0 ? '' : h < 4 ? 'l1' : h < 7 ? 'l2' : h < 9 ? 'l3' : 'l4');
const num = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

// El mes en una cuadrícula, con cada día coloreado según las horas trabajadas.
function CalendarioTrabajo({ ingresos }) {
    const hoy = new Date();
    const [mes, setMes] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
    const [sel, setSel] = useState(null);

    const porDia = useMemo(() => {
        const r = {};
        ingresos.filter(i => i.tipoTrabajo === 'Horas' && i.fecha).forEach(i => {
            const k = String(i.fecha).slice(0, 10);
            r[k] = (r[k] || 0) + (Number(i.cantidad) || 0);
        });
        return r;
    }, [ingresos]);

    const diasMes = new Date(mes.y, mes.m + 1, 0).getDate();
    const offset = (new Date(mes.y, mes.m, 1).getDay() + 6) % 7;
    const hoyISO = iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const esMesActual = mes.y === hoy.getFullYear() && mes.m === hoy.getMonth();
    const hastaDia = esMesActual ? hoy.getDate() : diasMes;
    const etiquetaMes = new Date(mes.y, mes.m, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    let trabajados = 0, total = 0;
    for (let d = 1; d <= hastaDia; d++) {
        const h = porDia[iso(mes.y, mes.m, d)] || 0;
        if (h > 0) { trabajados++; total += h; }
    }

    const mover = (delta) => {
        setSel(null);
        setMes(({ y, m }) => {
            const nd = new Date(y, m + delta, 1);
            return { y: nd.getFullYear(), m: nd.getMonth() };
        });
    };

    const infoSel = () => {
        if (!sel) return null;
        const [y, m, d] = sel.split('-').map(Number);
        const nombre = `${DNAME[new Date(y, m - 1, d).getDay()]} ${d}`;
        if (sel > hoyISO) return <><b>{nombre}</b>: todavía no llega.</>;
        const h = porDia[sel] || 0;
        return h > 0 ? <><b>{nombre}</b>: trabajó {num(h)} h.</> : <><b>{nombre}</b>: no trabajó.</>;
    };

    return (
        <div className="mq-cal">
            <div className="mq-cal-head">
                <button type="button" className="mq-cal-nav" aria-label="Mes anterior" onClick={() => mover(-1)}><ChevronLeft size={15} /></button>
                <b>{etiquetaMes.charAt(0).toUpperCase() + etiquetaMes.slice(1)}</b>
                <button type="button" className="mq-cal-nav" aria-label="Mes siguiente" onClick={() => mover(1)} disabled={esMesActual}><ChevronRight size={15} /></button>
            </div>
            <div className="mq-cal-grid">
                {DOWS.map(d => <span key={d} className="mq-cal-dow">{d}</span>)}
                {Array.from({ length: offset }, (_, i) => <span key={`e${i}`} />)}
                {Array.from({ length: diasMes }, (_, i) => {
                    const d = i + 1;
                    const k = iso(mes.y, mes.m, d);
                    const futuro = k > hoyISO;
                    const h = porDia[k] || 0;
                    return (
                        <button key={k} type="button"
                            className={`mq-cal-day ${futuro ? 'fut' : nivel(h)} ${sel === k ? 'sel' : ''} ${k === hoyISO ? 'hoy' : ''}`}
                            title={futuro ? '' : h > 0 ? `${num(h)} h` : 'No trabajó'}
                            onClick={() => setSel(k)}>
                            {d}
                        </button>
                    );
                })}
            </div>
            <div className="mq-cal-legend">
                Menos <i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" /> Más horas
            </div>
            <div className="mq-cal-info">
                {infoSel() || <><b>{trabajados} días trabajados</b> de {hastaDia}, {num(total)} h en total.</>}
            </div>
        </div>
    );
}

export default CalendarioTrabajo;
