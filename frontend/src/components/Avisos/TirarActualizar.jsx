import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import './TirarActualizar.css';

const UMBRAL = 70;
const MAXIMO = 110;

// Tirar hacia abajo para actualizar (solo celular/tableta con pantalla táctil).
// Funciona cuando la pantalla está arriba del todo y el dedo no está sobre algo que se desplaza.
function dentroDeAlgoQueSeDesplaza(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (n.scrollTop > 0) return true;
        const st = getComputedStyle(n);
        if (st.position === 'fixed') return true; // ventanas, menú lateral, barra inferior
    }
    return false;
}

export default function TirarActualizar({ onActualizar, activo = true }) {
    const caja = useRef(null);
    const cb = useRef(onActualizar);
    cb.current = onActualizar;

    useEffect(() => {
        const el = caja.current;
        if (!activo || !el) return undefined;
        let y0 = null, dy = 0, ocupado = false;
        const pintar = (d, girando) => {
            el.style.transform = `translate(-50%, ${d - 46}px)`;
            el.style.opacity = d > 8 || girando ? '1' : '0';
            el.classList.toggle('listo', d >= UMBRAL);
            el.classList.toggle('gira', !!girando);
            el.firstChild.style.transform = girando ? '' : `rotate(${d * 3}deg)`;
        };
        const ini = (e) => {
            if (ocupado || e.touches.length !== 1) return;
            if ((document.scrollingElement?.scrollTop || 0) > 0) return;
            if (e.target.closest?.('input,textarea,select,.leaflet-container') || dentroDeAlgoQueSeDesplaza(e.target)) return;
            y0 = e.touches[0].clientY; dy = 0;
            el.style.transition = 'none';
        };
        const mov = (e) => {
            if (y0 == null) return;
            const d = e.touches[0].clientY - y0;
            if (d <= 0) { dy = 0; pintar(0); return; }
            dy = Math.min(MAXIMO, d * 0.5);
            pintar(dy);
        };
        const fin = () => {
            if (y0 == null) return;
            y0 = null;
            el.style.transition = 'transform .25s, opacity .25s';
            if (dy >= UMBRAL) {
                ocupado = true; pintar(52, true);
                Promise.resolve(cb.current?.()).finally(() => setTimeout(() => { pintar(0); ocupado = false; }, 700));
            } else pintar(0);
            dy = 0;
        };
        document.addEventListener('touchstart', ini, { passive: true });
        document.addEventListener('touchmove', mov, { passive: true });
        document.addEventListener('touchend', fin, { passive: true });
        document.addEventListener('touchcancel', fin, { passive: true });
        return () => {
            document.removeEventListener('touchstart', ini); document.removeEventListener('touchmove', mov);
            document.removeEventListener('touchend', fin); document.removeEventListener('touchcancel', fin);
        };
    }, [activo]);

    return <div ref={caja} className="tira-act" aria-hidden="true"><RefreshCw size={18} /></div>;
}
