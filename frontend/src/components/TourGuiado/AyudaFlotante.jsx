import { useState } from 'react';
import { HelpCircle, X, Compass, PlayCircle } from 'lucide-react';
import './TourGuiado.css';

// Botón "?" fijo: abre la guía de la pantalla actual (si la tiene) o el tour completo
export default function AyudaFlotante({ hayGuia, onGuia, onTour }) {
    const [abierto, setAbierto] = useState(false);
    const elegir = (f) => { setAbierto(false); f(); };
    return (
        <div className="tg-ayuda">
            {abierto && (
                <div className="tg-ayuda-menu" role="menu">
                    {hayGuia && <button type="button" role="menuitem" onClick={() => elegir(onGuia)}><Compass size={15} aria-hidden="true" /> Guía de esta pantalla</button>}
                    <button type="button" role="menuitem" onClick={() => elegir(onTour)}><PlayCircle size={15} aria-hidden="true" /> Tour completo</button>
                </div>
            )}
            <button type="button" className="tg-ayuda-btn" aria-label="Ayuda" aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
                {abierto ? <X size={20} /> : <HelpCircle size={22} />}
            </button>
        </div>
    );
}
