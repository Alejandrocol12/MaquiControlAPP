import { createContext, useContext, useState, useCallback } from 'react';

export const ToastContext = createContext(null);

export function useToast() {
    return useContext(ToastContext);
}

export function useToastState() {
    const [toasts, setToasts] = useState([]);

    const toast = useCallback((msg, tipo = 's') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, tipo }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    }, []);

    return { toasts, toast };
}
