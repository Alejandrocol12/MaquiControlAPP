import { useState, useEffect } from 'react';
import { getFotoMaquina } from '../api';

// Muestra la foto de una máquina (si tiene) o el contenido de respaldo (fallback) si no.
// La foto requiere sesión, así que no puede ser un <img src="..."> directo -- se trae con
// axios (que sí manda el token) y se convierte a un object URL local.
export default function FotoMaquina({ maquina, size = 40, radius = '50%', fallback }) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        if (!maquina?.tieneFoto) { setUrl(null); return undefined; }
        let objectUrl = null;
        let cancelado = false;
        getFotoMaquina(maquina.id).then(res => {
            if (cancelado) return;
            objectUrl = URL.createObjectURL(res.data);
            setUrl(objectUrl);
        }).catch(() => setUrl(null));
        return () => {
            cancelado = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [maquina?.id, maquina?.tieneFoto]);

    if (url) {
        return (
            <img
                src={url}
                alt={maquina?.nombre || 'Máquina'}
                style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }}
            />
        );
    }
    return fallback || null;
}
