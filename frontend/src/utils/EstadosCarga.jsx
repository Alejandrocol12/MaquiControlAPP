import { AlertTriangle, RefreshCw } from 'lucide-react';
import './EstadosCarga.css';

// Esqueleto mientras carga: se parece a lo que va a aparecer, para que la pantalla no salte.
// variante: 'tarjetas' (rejilla de tarjetas) o 'lista' (filas)
export function Esqueleto({ variante = 'lista', cantidad = 4, etiqueta = 'Cargando' }) {
    return (
        <div className={`ec-esq ${variante}`} role="status" aria-busy="true" aria-label={etiqueta}>
            {Array.from({ length: cantidad }, (_, i) => (
                <div className="ec-esq-item" key={i} aria-hidden="true">
                    <span className="skel ec-l1" />
                    <span className="skel ec-l2" />
                    <span className="skel ec-l3" />
                </div>
            ))}
        </div>
    );
}

// Cuando falla una carga: dice qué pasó y deja volver a intentar sin recargar la página
export function ErrorCarga({ mensaje = 'No se pudieron cargar los datos.', onReintentar, reintentando = false }) {
    return (
        <div className="ec-error" role="alert">
            <span className="ec-error-ico" aria-hidden="true"><AlertTriangle size={20} /></span>
            <div className="ec-error-t">{mensaje}</div>
            <div className="ec-error-d">Revisa tu conexión e intenta de nuevo. Tus datos no se perdieron.</div>
            {onReintentar && (
                <button type="button" className="bp" onClick={onReintentar} disabled={reintentando}>
                    <RefreshCw size={14} aria-hidden="true" style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    {reintentando ? 'Reintentando…' : 'Reintentar'}
                </button>
            )}
        </div>
    );
}
