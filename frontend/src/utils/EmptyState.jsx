import { Plus } from 'lucide-react';

// Pantalla vacía que explica qué hacer y ofrece el botón para empezar.
function EmptyState({ icono, titulo, texto, accion }) {
    return (
        <div className="empty">
            {icono && <span className="empty-ico">{icono}</span>}
            <div className="empty-t">{titulo}</div>
            {texto && <div className="empty-d">{texto}</div>}
            {accion && (
                <button type="button" className="bp" onClick={accion.onClick}>
                    <Plus size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />{accion.label}
                </button>
            )}
        </div>
    );
}

export default EmptyState;
