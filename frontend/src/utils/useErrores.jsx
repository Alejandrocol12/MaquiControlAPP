import { useState, useCallback } from 'react';

// Errores de formulario marcados en el campo, en vez de solo un aviso abajo.
// validar([{ campo, ok, msg }]) marca los que fallan, lleva el cursor al primero
// y devuelve true si todo está bien. Cada campo se marca con {...props('campo')}.
export function useErrores() {
    const [errores, setErrores] = useState({});

    const validar = useCallback((reglas) => {
        const nuevos = {};
        let primero = null;
        reglas.forEach(r => {
            if (!r.ok && !nuevos[r.campo]) {
                nuevos[r.campo] = r.msg;
                if (!primero) primero = r.campo;
            }
        });
        setErrores(nuevos);
        if (primero) {
            const el = document.querySelector(`[data-campo="${primero}"]`);
            if (el) {
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                el.focus({ preventScroll: true });
            }
        }
        return !primero;
    }, []);

    const limpiar = useCallback((campo) => {
        setErrores(e => {
            if (!e[campo]) return e;
            const n = { ...e };
            delete n[campo];
            return n;
        });
    }, []);

    const props = (campo) => ({
        'data-campo': campo,
        'aria-invalid': errores[campo] ? true : undefined,
    });

    const clase = (base, campo) => (errores[campo] ? `${base} err` : base);

    return { errores, validar, limpiar, props, clase, setErrores };
}

export function ErrorCampo({ msg }) {
    return msg ? <span className="ferr" role="alert">{msg}</span> : null;
}
