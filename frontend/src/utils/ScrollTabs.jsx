import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Barra de pestañas con desplazamiento: muestra una flecha y un desvanecido cuando
// hay pestañas fuera de la vista, y centra sola la pestaña activa.
function ScrollTabs({ className, activeIndex, children }) {
    const ref = useRef(null);
    const [izq, setIzq] = useState(false);
    const [der, setDer] = useState(false);

    const sync = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        setIzq(el.scrollLeft > 4);
        setDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        sync();
        el.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync);
        return () => {
            el.removeEventListener('scroll', sync);
            window.removeEventListener('resize', sync);
        };
    }, [sync]);

    useEffect(() => {
        const el = ref.current;
        const btn = el?.children[activeIndex];
        if (!btn) return;
        el.scrollTo({ left: btn.offsetLeft - (el.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' });
    }, [activeIndex]);

    const mover = (dir) => ref.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });

    return (
        <div className="stabs">
            <div ref={ref} className={className}>{children}</div>
            {izq && (
                <div className="stabs-fade l">
                    <button type="button" className="stabs-arrow" aria-label="Ver pestañas anteriores" onClick={() => mover(-1)}>
                        <ChevronLeft size={14} />
                    </button>
                </div>
            )}
            {der && (
                <div className="stabs-fade r">
                    <button type="button" className="stabs-arrow" aria-label="Ver más pestañas" onClick={() => mover(1)}>
                        <ChevronRight size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}

export default ScrollTabs;
