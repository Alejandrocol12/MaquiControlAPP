import { useEffect, useRef } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import './TourGuiado.css';

// Sube VERSION_NOVEDADES cada vez que haya algo nuevo que contar: el aviso sale una sola vez por versión
export const VERSION_NOVEDADES = '2026-10-acta-horas';
const NOVEDADES = [
    'Acta de horas por corte: cada día con sus horas y el horómetro de inicio y fin.',
    'Parte diario y calendario de trabajo, con pronóstico a fin de mes.',
    'Logo nuevo de Moventra y marca de agua en los PDF.',
    'Primeros pasos en el inicio y guías cortas dentro de cada pantalla (botón ? abajo a la derecha).',
];

export default function Novedades({ onCerrar }) {
    const boton = useRef(null);
    useEffect(() => { boton.current?.focus(); }, []);
    const cerrar = () => {
        try { localStorage.setItem('mc_novedades', VERSION_NOVEDADES); } catch (e) { /* sin almacenamiento */ }
        onCerrar();
    };
    useEffect(() => {
        const t = (e) => { if (e.key === 'Escape') cerrar(); };
        window.addEventListener('keydown', t);
        return () => window.removeEventListener('keydown', t);
    });
    return (
        <div className="tg-modal" onClick={cerrar}>
            <div className="tg-card tg-nov" role="dialog" aria-modal="true" aria-labelledby="tg-nov-t" onClick={e => e.stopPropagation()}>
                <header className="tg-cab">
                    <img src={`${process.env.PUBLIC_URL}/logo-moventra-claro.png`} alt="" />
                    <span>Novedades de <b>Moventra</b></span>
                    <button type="button" className="tg-x" onClick={cerrar} aria-label="Cerrar"><X size={16} /></button>
                </header>
                <div className="tg-cuerpo">
                    <span className="tg-ico" aria-hidden="true"><Sparkles size={24} /></span>
                    <h3 id="tg-nov-t">Lo nuevo</h3>
                    <ul>{NOVEDADES.map((t, i) => <li key={i}><Check size={14} aria-hidden="true" /><span>{t}</span></li>)}</ul>
                </div>
                <footer className="tg-pie"><button type="button" className="tg-pri" ref={boton} onClick={cerrar}>Entendido</button></footer>
            </div>
        </div>
    );
}
