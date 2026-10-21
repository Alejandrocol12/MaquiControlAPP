import { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Wrench, CloudRain, Moon, Fuel } from 'lucide-react';
import { getPartesDiarios } from '../../api';
import ParteDiarioModal from './ParteDiarioModal';
import './CalendarioTrabajo.css';

const DOWS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const nivel = (h) => (h <= 0 ? '' : h > 10 ? 'l3' : h >= 8 ? 'l2' : 'l1');
const r1 = (n) => Math.round(n * 10) / 10;
const num = (n) => String(r1(n)).replace('.', ',');
const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const ICONO = { MANTENIMIENTO: Wrench, LLUVIA: CloudRain, DESCANSO: Moon };
const TITULO = { MANTENIMIENTO: 'Mantenimiento', LLUVIA: 'Parado por lluvia', DESCANSO: 'Día de descanso' };

// Número de semana ISO (la semana empieza el lunes)
function semanaISO(y, m, d) {
    const f = new Date(Date.UTC(y, m, d));
    const dia = f.getUTCDay() || 7;
    f.setUTCDate(f.getUTCDate() + 4 - dia);
    return Math.ceil(((f - Date.UTC(f.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

// El mes en una cuadrícula: cada día con sus horas (y los galones si hay combustible), los días que vienen con
// la proyección según el patrón histórico, y al costado de cada semana sus horas y su valor.
// Al tocar un día se abre su parte diario.
function CalendarioTrabajo({ maq, ingresos, combustibles = [], esperadoPorDia = null, verGalones = false, onCambio }) {
    const hoy = new Date();
    const [mes, setMes] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
    const [abierto, setAbierto] = useState(null);
    const [partes, setPartes] = useState([]);

    const cargarPartes = useCallback(() => {
        getPartesDiarios(maq.nombre).then(r => setPartes(r.data || [])).catch(() => {});
    }, [maq.nombre]);
    useEffect(() => { cargarPartes(); }, [cargarPartes]);

    const horasIng = useMemo(() => ingresos.filter(i => i.tipoTrabajo === 'Horas' && i.fecha), [ingresos]);
    const porDia = useMemo(() => {
        const r = {};
        horasIng.forEach(i => {
            const k = String(i.fecha).slice(0, 10);
            r[k] = r[k] || { horas: 0, total: 0, lista: [] };
            r[k].horas += Number(i.cantidad) || 0;
            r[k].total += Number(i.total) || 0;
            r[k].lista.push(i);
        });
        return r;
    }, [horasIng]);
    const galonesDia = useMemo(() => {
        const r = {};
        combustibles.filter(c => c.fecha).forEach(c => { const k = String(c.fecha).slice(0, 10); r[k] = (r[k] || 0) + (Number(c.galones) || 0); });
        return r;
    }, [combustibles]);
    const parteDe = useMemo(() => Object.fromEntries(partes.map(p => [String(p.fecha).slice(0, 10), p])), [partes]);

    const diasMes = new Date(mes.y, mes.m + 1, 0).getDate();
    const offset = (new Date(mes.y, mes.m, 1).getDay() + 6) % 7;
    const hoyISO = iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const esMesActual = mes.y === hoy.getFullYear() && mes.m === hoy.getMonth();
    const etiquetaMes = new Date(mes.y, mes.m, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const tarifa = Number(maq.valorHoraMaquina) || 0;

    let acumulado = 0;
    for (let d = 1; d <= diasMes; d++) { const k = iso(mes.y, mes.m, d); if (k <= hoyISO) acumulado += porDia[k]?.horas || 0; }

    const mover = (delta) => {
        setMes(({ y, m }) => { const nd = new Date(y, m + delta, 1); return { y: nd.getFullYear(), m: nd.getMonth() }; });
    };

    // Último horómetro final conocido antes de un día, para proponer el inicial de uno sin registros
    const ultimoHorometroAntes = (fecha) => {
        if (fecha === hoyISO) return maq.horometroActual;
        const previos = horasIng.filter(i => String(i.fecha).slice(0, 10) < fecha && i.horometroFin != null)
            .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
        return previos[0]?.horometroFin ?? maq.horometroActual;
    };

    const celdas = [];
    for (let i = 0; i < offset; i++) celdas.push(<span key={`e${i}`} className="cl-vacio" />);
    let horasSemana = 0, valorSemana = 0, haySemana = false;
    for (let d = 1; d <= diasMes; d++) {
        const k = iso(mes.y, mes.m, d);
        const dowIdx = (offset + d - 1) % 7;
        const futuro = k > hoyISO;
        const dato = porDia[k];
        const h = dato?.horas || 0;
        const parte = parteDe[k];
        const estado = parte?.estadoOperacion && parte.estadoOperacion !== 'NORMAL' && h === 0 ? parte.estadoOperacion : '';
        const Icono = ICONO[estado];
        const proy = futuro && esperadoPorDia ? esperadoPorDia[(dowIdx + 1) % 7] : null;
        const gal = galonesDia[k];

        if (!futuro && h > 0) { horasSemana += h; valorSemana += dato.total; haySemana = true; }
        if (futuro && proy) { horasSemana += proy; valorSemana += proy * tarifa; haySemana = true; }

        const clase = futuro ? 'fut' : estado ? `paro ${estado.toLowerCase()}` : nivel(h);
        celdas.push(
            <button key={k} type="button" disabled={futuro}
                className={`cl-dia ${clase} ${k === hoyISO ? 'hoy' : ''}`}
                title={futuro ? '' : estado ? TITULO[estado] : h > 0 ? `${num(h)} h` : 'Sin horas'}
                aria-label={`${d}: ${futuro ? (proy ? `proyección ${num(proy)} horas` : 'por venir') : `${num(h)} horas${estado ? ', ' + TITULO[estado] : ''}`}`}
                onClick={() => setAbierto(k)}>
                <span className="cl-top">
                    <b>{d}</b>
                    {k === hoyISO && <i className="cl-punto" aria-hidden="true" />}
                    {!futuro && verGalones && gal > 0 && <small><Fuel size={11} aria-hidden="true" />{Math.round(gal)}g</small>}
                    {Icono && <Icono size={15} className="cl-estado" aria-hidden="true" />}
                </span>
                {futuro
                    ? (proy ? <em className="cl-proy">proj. ~{num(proy)}h</em> : <em />)
                    : <strong className="cl-horas">{num(h)} h</strong>}
            </button>
        );
        if (dowIdx === 6 || d === diasMes) {
            for (let r = dowIdx; r < 6; r++) celdas.push(<span key={`p${d}-${r}`} className="cl-vacio" />);
            celdas.push(
                <div key={`w${d}`} className={`cl-sem ${haySemana ? '' : 'sin'}`} title="Horas de la semana">
                    <small>SEMANA {semanaISO(mes.y, mes.m, d)}</small>
                    <b>{haySemana ? `${num(horasSemana)} h` : '—'}</b>
                    {haySemana && <span>{fmt(valorSemana)}</span>}
                </div>
            );
            horasSemana = 0; valorSemana = 0; haySemana = false;
        }
    }

    return (
        <div className="cl">
            <div className="cl-barra">
                <div className="cl-nav">
                    <button type="button" aria-label="Mes anterior" onClick={() => mover(-1)}><ChevronLeft size={16} /></button>
                    <b>{etiquetaMes.charAt(0).toUpperCase() + etiquetaMes.slice(1)}</b>
                    <button type="button" aria-label="Mes siguiente" onClick={() => mover(1)} disabled={esMesActual}><ChevronRight size={16} /></button>
                </div>
                <span className="cl-acum">Horómetro acumulado mensual: <b>{num(acumulado)} hrs</b></span>
                <div className="cl-leyenda" aria-label="Leyenda de horas">
                    <span><i className="l0" />0 h / Parada</span>
                    <span><i className="l1" />1 - 7 h</span>
                    <span><i className="l2" />8 - 10 h</span>
                    <span><i className="l3" />&gt;10 h</span>
                </div>
            </div>

            <div className="cl-grid">
                {DOWS.map(d => <span key={d} className="cl-dow">{d}</span>)}
                <span className="cl-dow cl-dow-sem">SEM.</span>
                {celdas}
            </div>

            {abierto && (
                <ParteDiarioModal key={abierto} maq={maq} fecha={abierto}
                    ingresosDia={porDia[abierto]?.lista || []} parte={parteDe[abierto]}
                    ultimoHorometro={ultimoHorometroAntes(abierto)}
                    onCerrar={() => setAbierto(null)}
                    onGuardado={() => { setAbierto(null); cargarPartes(); onCambio && onCambio(); }} />
            )}
        </div>
    );
}

export default CalendarioTrabajo;
