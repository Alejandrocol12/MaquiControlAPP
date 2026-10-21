import { useState } from 'react';
import { TrendingUp, TrendingDown, Clock, ArrowUpRight, Target, Pencil, Check, X } from 'lucide-react';
import { fmtHoras } from '../../utils/cortes';
import './ResumenMaquina.css';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const num = (n) => (Math.round(n * 10) / 10).toLocaleString('es-CO');
const pct = (n) => (Math.round(n * 10) / 10).toLocaleString('es-CO') + '%';

// Las cuatro tarjetas del periodo (cada una lleva a su pestaña) y el pronóstico a fin de mes con el
// progreso frente a la meta de horas que el usuario se pone.
export function TarjetasPeriodo({ ingresos, gastos, utilidad, horas, diasTrabajados, periodoNombre, valorHora, onIr }) {
    const pctGasto = ingresos > 0 ? (gastos / ingresos) * 100 : 0;
    const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;
    return (
        <div className="rs-tarjetas">
            <button type="button" className="rs-tarjeta" onClick={() => onIr(2)} aria-label="Ver ingresos">
                <span className="rs-top"><span>Ingresos periodo</span><i className="rs-ico verde"><TrendingUp size={16} aria-hidden="true" /></i></span>
                <b className="rs-valor">{fmt(ingresos)}</b>
                <span className="rs-pie"><span>{periodoNombre || 'sin periodo activo'}</span>{valorHora > 0 && <em className="verde">+{fmt(valorHora)}/h</em>}</span>
            </button>
            <button type="button" className="rs-tarjeta" onClick={() => onIr(3)} aria-label="Ver gastos">
                <span className="rs-top"><span>Gastos periodo</span><i className="rs-ico rojo"><TrendingDown size={16} aria-hidden="true" /></i></span>
                <b className="rs-valor rojo">{fmt(gastos)}</b>
                <span className="rs-pie"><span>acumulados en obra</span>{ingresos > 0 && <em className="rojo">{pct(pctGasto)} de ingresos</em>}</span>
            </button>
            <button type="button" className="rs-tarjeta util" onClick={() => onIr(5)} aria-label="Ver periodo y cortes">
                <span className="rs-top"><span>Utilidad neta</span><i className="rs-ico claro"><ArrowUpRight size={16} aria-hidden="true" /></i></span>
                <b className="rs-valor">{fmt(utilidad)}</b>
                <span className="rs-pie"><span>ingresos − gastos</span>{ingresos > 0 && <em className="pastilla">{pct(margen)} margen</em>}</span>
            </button>
            <button type="button" className="rs-tarjeta" onClick={() => onIr(1)} aria-label="Ver trabajo">
                <span className="rs-top"><span>Horas periodo</span><i className="rs-ico azul"><Clock size={16} aria-hidden="true" /></i></span>
                <b className="rs-valor">{fmtHoras(horas)}<small> h</small></b>
                <span className="rs-pie"><span>trabajadas en este periodo</span>{diasTrabajados > 0 && <em className="azul">~{num(horas / diasTrabajados)} h/día prom.</em>}</span>
            </button>
        </div>
    );
}

export function PronosticoMes({ pronostico, horasMes, diasDelMes, valorHora, meta, onGuardarMeta }) {
    const [editando, setEditando] = useState(false);
    const [texto, setTexto] = useState('');
    const [error, setError] = useState('');

    // La meta del usuario manda; sin meta se compara con lo que se espera según el patrón histórico
    const metaEfectiva = meta > 0 ? meta : (pronostico?.totalProyectado || 0);
    const progreso = metaEfectiva > 0 ? Math.min(100, (horasMes / metaEfectiva) * 100) : 0;
    const ritmo = metaEfectiva > 0 ? metaEfectiva / diasDelMes : 0;

    const guardar = () => {
        const n = parseFloat(texto.replace(',', '.'));
        if (texto.trim() !== '' && (!Number.isFinite(n) || n < 0)) return setError('Escribe un número de horas');
        setError('');
        onGuardarMeta(texto.trim() === '' ? 0 : n);
        setEditando(false);
    };

    return (
        <div className="rs-pronostico">
            <div className="rs-pron-texto">
                <i className="rs-pron-ico" aria-hidden="true"><Target size={20} /></i>
                {pronostico ? (
                    <div>
                        <h4>Pronóstico a fin de mes: <code>{num(pronostico.totalProyectado)} h ({fmt(pronostico.ingresoProyectado)})</code></h4>
                        <p><b>{num(pronostico.horasEsteMes)} h</b> ya trabajadas este mes + <b>~{num(pronostico.horasRestantes)} h</b> proyectadas en los <b>{pronostico.diasRestantes} días</b> que quedan, según el patrón histórico de esta máquina.</p>
                    </div>
                ) : (
                    <div>
                        <h4>Pronóstico a fin de mes</h4>
                        <p>Aún no hay suficiente historial de horas para pronosticar (se necesitan al menos 3 días registrados). Llevas <b>{num(horasMes)} h</b> este mes.</p>
                    </div>
                )}
            </div>

            <div className="rs-meta">
                <div className="rs-meta-top">
                    <span>Progreso del Mes</span>
                    {metaEfectiva > 0 && <b>{Math.round(progreso)}%</b>}
                </div>
                <div className="rs-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso)} aria-label="Progreso del mes">
                    <i style={{ width: `${progreso}%` }} />
                </div>
                {editando ? (
                    <div className="rs-meta-edit">
                        <input autoFocus inputMode="decimal" aria-label="Meta de horas del mes" placeholder="Horas del mes" value={texto}
                            onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false); }} />
                        <button type="button" aria-label="Guardar meta" onClick={guardar}><Check size={15} /></button>
                        <button type="button" aria-label="Cancelar" onClick={() => setEditando(false)}><X size={15} /></button>
                        {error && <small role="alert">{error}</small>}
                    </div>
                ) : (
                    <div className="rs-meta-pie">
                        <span>{metaEfectiva > 0 ? <>Meta: <b>{num(metaEfectiva)} h</b>{meta > 0 ? '' : ' (pronóstico)'} · Ritmo: <b>~{num(ritmo)} h/día</b></> : 'Sin meta definida'}</span>
                        <button type="button" onClick={() => { setTexto(meta > 0 ? String(meta).replace('.', ',') : ''); setEditando(true); }}>
                            <Pencil size={12} aria-hidden="true" /> {meta > 0 ? 'Cambiar meta' : 'Definir meta'}
                        </button>
                    </div>
                )}
                {meta > 0 && !editando && valorHora > 0 && <small className="rs-meta-nota">Meta en dinero: {fmt(meta * valorHora)}</small>}
            </div>
        </div>
    );
}
