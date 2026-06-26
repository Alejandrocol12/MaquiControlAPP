import { useEffect, useRef } from 'react';
import { getPusher } from '../utils/pusher';

// Suscribe al canal del usuario y llama onEvent(evento, datos) para cada mensaje.
// La suscripción se crea una sola vez por userId — onEvent puede cambiar libremente
// sin re-suscribir gracias al ref.
export function usePusherChannel(userId, onEvent) {
    const handlerRef = useRef(onEvent);
    handlerRef.current = onEvent;

    useEffect(() => {
        if (!userId || !process.env.REACT_APP_PUSHER_KEY) return;
        const pusher = getPusher();
        const canal = pusher.subscribe(`mc-${userId}`);
        const handler = (evento, data) => handlerRef.current(evento, data);
        canal.bind_global(handler);
        return () => {
            canal.unbind_global(handler);
            canal.unsubscribe();
        };
    }, [userId]);
}
