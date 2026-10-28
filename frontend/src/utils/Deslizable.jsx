import { useEffect, useRef, useState } from 'react';
import './Deslizable.css';

// Solo en pantallas de celular: en escritorio las filas conservan sus botones de siempre.
export function useEsMovil(px = 760) {
    const q = `(max-width:${px}px)`;
    const [movil, setMovil] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
    useEffect(() => {
        const mq = window.matchMedia(q);
        const f = () => setMovil(mq.matches);
        f();
        mq.addEventListener?.('change', f);
        return () => mq.removeEventListener?.('change', f);
    }, [q]);
    return movil;
}

const ANCHO = 76; // ancho de cada botón escondido
let cerrarAbierta = null; // solo una fila queda abierta a la vez

// Fila que se desliza a la izquierda para mostrar acciones (Editar, Borrar...).
// acciones: [{ label, icono, tono: 'azul' | 'rojo' | 'verde', onClick }]. Sin acciones o en escritorio
// se dibuja la fila normal, con la misma clase y estilo que ya tenía.
function FilaDeslizable({ acciones, className = '', style, children }) {
    const movil = useEsMovil();
    const [x, setX] = useState(0);
    const [arrastra, setArrastra] = useState(false);
    const ref = useRef({ x0: 0, y0: 0, base: 0, activo: false, horizontal: false, id: null });
    const tope = acciones.length * ANCHO;
    const cerrar = useRef(() => setX(0)).current;

    useEffect(() => () => { if (cerrarAbierta === cerrar) cerrarAbierta = null; }, [cerrar]);

    if (!movil) return <div className={className} style={style}>{children}</div>;

    const abrir = () => { if (cerrarAbierta && cerrarAbierta !== cerrar) cerrarAbierta(); cerrarAbierta = cerrar; setX(-tope); };

    const alBajar = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target.closest('button, a, input, select, textarea, label')) return;
        if (cerrarAbierta && cerrarAbierta !== cerrar && x === 0) cerrarAbierta();
        ref.current = { x0: e.clientX, y0: e.clientY, base: x, activo: true, horizontal: false, id: e.pointerId };
    };
    const alMover = (e) => {
        const r = ref.current;
        if (!r.activo) return;
        const dx = e.clientX - r.x0, dy = e.clientY - r.y0;
        if (!r.horizontal) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { r.activo = false; return; } // es un scroll vertical
            if (Math.abs(dx) < 8) return;
            r.horizontal = true;
            setArrastra(true);
            e.currentTarget.setPointerCapture?.(r.id);
        }
        setX(Math.max(-tope, Math.min(0, r.base + dx)));
    };
    const alSoltar = () => {
        const r = ref.current;
        if (!r.activo) return;
        r.activo = false;
        setArrastra(false);
        if (!r.horizontal) return;
        if (x < -tope / 2) abrir(); else { setX(0); if (cerrarAbierta === cerrar) cerrarAbierta = null; }
    };

    return (
        <div className="dz">
            <div className="dz-acc" style={{ width: tope }}>
                {acciones.map(a => (
                    <button key={a.label} type="button" className={`dz-b ${a.tono || 'azul'}`} style={{ width: ANCHO }}
                        onClick={() => { cerrar(); a.onClick(); }}>
                        {a.icono}<span>{a.label}</span>
                    </button>
                ))}
            </div>
            <div className={`dz-fr ${className}${arrastra ? ' mov' : ''}`}
                style={{ ...style, transform: `translateX(${x}px)` }}
                onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
                {children}
            </div>
        </div>
    );
}

// Las filas sin acciones (casi todas) no pagan el costo de los eventos ni de la consulta de pantalla.
export default function Deslizable({ acciones = [], className = '', style, children }) {
    if (!acciones.length) return <div className={className} style={style}>{children}</div>;
    return <FilaDeslizable acciones={acciones} className={className} style={style}>{children}</FilaDeslizable>;
}
