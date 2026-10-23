import { useState, useEffect } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { getCortes } from '../../api';
import './PrimerosPasos.css';

// Lista que se marca sola con los datos reales de la cuenta. Desaparece al completarse (o si se descarta)
export default function PrimerosPasos({ maquinas, faenas, ingresos, onIr }) {
    const [cortes, setCortes] = useState(null);
    const [oculto, setOculto] = useState(() => { try { return localStorage.getItem('mc_pp_oculto') === '1'; } catch (e) { return false; } });
    useEffect(() => { getCortes().then(r => setCortes((r.data || []).length)).catch(() => setCortes(0)); }, []);

    const pasos = [
        { t: 'Crea tu primera máquina', ok: maquinas.length > 0, modulo: 'maquinaria' },
        { t: 'Abre un periodo (la obra de una máquina)', ok: faenas.length > 0, modulo: 'faenas' },
        { t: 'Registra tu primer trabajo', ok: ingresos.length > 0, modulo: 'maquinaria' },
        { t: 'Haz tu primer corte', ok: !!cortes, modulo: 'faenas' },
    ];
    const hechos = pasos.filter(p => p.ok).length;
    const siguiente = pasos.findIndex(p => !p.ok);
    if (oculto || cortes === null || hechos === pasos.length) return null;

    const ocultar = () => { try { localStorage.setItem('mc_pp_oculto', '1'); } catch (e) { /* sin almacenamiento */ } setOculto(true); };
    return (
        <section className="pp" aria-label="Primeros pasos">
            <div className="pp-cab">
                <div><b>Primeros pasos</b><span>{hechos} de {pasos.length} listos</span></div>
                <button type="button" className="pp-x" onClick={ocultar} aria-label="Ocultar primeros pasos"><X size={15} /></button>
            </div>
            <div className="pp-barra" aria-hidden="true"><i style={{ width: `${(hechos / pasos.length) * 100}%` }} /></div>
            <ul>
                {pasos.map((p, i) => (
                    <li key={i} className={p.ok ? 'ok' : i === siguiente ? 'sig' : ''}>
                        <span className="pp-ck" aria-hidden="true">{p.ok && <Check size={12} />}</span>
                        <span className="pp-t">{p.t}</span>
                        {!p.ok && <button type="button" onClick={() => onIr(p.modulo)}>{i === siguiente ? 'Empezar' : 'Ir'} <ChevronRight size={13} aria-hidden="true" /></button>}
                    </li>
                ))}
            </ul>
        </section>
    );
}
