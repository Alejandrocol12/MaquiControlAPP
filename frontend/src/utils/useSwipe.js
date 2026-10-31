import { useCallback, useRef } from 'react';

// Deslizar de lado en el celular: devuelve un "ref" para poner en el contenedor.
// Se ignora si el gesto empieza en un campo, en un control deslizante o dentro de algo
// que ya se desplaza hacia los lados (tablas anchas, chips, mapa).
function desplazableHorizontal(el, tope) {
    for (let n = el; n && n !== tope && n.nodeType === 1; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 2) {
            const ox = getComputedStyle(n).overflowX;
            if (ox === 'auto' || ox === 'scroll') return true;
        }
    }
    return false;
}

export default function useSwipe(onIzquierda, onDerecha) {
    const cb = useRef({});
    cb.current = { onIzquierda, onDerecha };
    const limpiar = useRef(null);

    return useCallback((el) => {
        if (limpiar.current) { limpiar.current(); limpiar.current = null; }
        if (!el) return;
        let p = null;
        const ini = (e) => {
            p = null;
            if (e.touches.length !== 1) return;
            const t = e.target;
            if (t.closest?.('input,textarea,select,[role=slider],.leaflet-container,[role=dialog]') || desplazableHorizontal(t, el)) return;
            p = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
        };
        const fin = (e) => {
            if (!p) return;
            const c = e.changedTouches[0];
            const dx = c.clientX - p.x, dy = c.clientY - p.y;
            const rapido = Date.now() - p.t < 600;
            p = null;
            if (!rapido || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
            if (dx < 0) cb.current.onIzquierda?.(); else cb.current.onDerecha?.();
        };
        el.addEventListener('touchstart', ini, { passive: true });
        el.addEventListener('touchend', fin, { passive: true });
        limpiar.current = () => { el.removeEventListener('touchstart', ini); el.removeEventListener('touchend', fin); };
    }, []);
}
