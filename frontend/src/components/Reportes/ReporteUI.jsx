import { Loader, FileSpreadsheet, Download, AlertTriangle } from 'lucide-react';

export const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');

// Etiqueta + contenido de un parámetro del reporte
export function Campo({ etiqueta, id, children, className = '' }) {
    return (
        <div className={`rv-campo ${className}`}>
            <label className="rv-etq" htmlFor={id}>{etiqueta}</label>
            {children}
        </div>
    );
}

// Grupo de chips; con multiple cada chip se prende o apaga solo
export function Chips({ etiqueta, opciones, valor, onChange, multiple = false }) {
    const activo = (k) => multiple ? !!valor[k] : valor === k;
    return (
        <div className="rv-campo">
            <span className="rv-etq">{etiqueta}</span>
            <div className="rv-chips" role="group" aria-label={etiqueta}>
                {opciones.map(o => (
                    <button type="button" key={o.value} title={o.title}
                        className={`rv-chip ${activo(o.value) ? 'on' : ''}`} aria-pressed={activo(o.value)}
                        onClick={() => onChange(o.value)}>{o.label}</button>
                ))}
            </div>
        </div>
    );
}

// Selectores de máquina y periodo que comparten los reportes por máquina
export function MaquinaPeriodo({ maquinas, maq, onMaq, periodos, periodo, onPeriodo, conTodos = true }) {
    return (
        <div className="rv-fila">
            <Campo etiqueta="Máquina" id="rv-maq">
                <select id="rv-maq" className="rv-select" value={maq} onChange={e => onMaq(e.target.value)}>
                    {maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                </select>
            </Campo>
            <Campo etiqueta="Periodo" id="rv-per">
                <select id="rv-per" className="rv-select" value={periodo} onChange={e => onPeriodo(e.target.value)}>
                    {conTodos && <option value="">Todos los periodos</option>}
                    {!conTodos && periodos.length === 0 && <option value="">Sin periodos</option>}
                    {periodos.map((f, i) => (
                        <option key={f.id} value={f.id}>{`P${periodos.length - i}: ${f.nombreObra || 'Sin nombre'} (${f.fechaInicio || '—'})`}</option>
                    ))}
                </select>
            </Campo>
        </div>
    );
}

// Bloque de vista previa con el total y los botones de descarga
export function VistaPrevia({ total, detalle, tono, sinDatos, mensajeVacio, generando, onPdf, onXls, error }) {
    const ocupado = !!generando;
    return (
        <section className="rv-prev" aria-label="Vista previa">
            <span className="rv-etq">Vista previa</span>
            {sinDatos ? (
                <p className="rv-vacio">{mensajeVacio || 'No hay datos para estos parámetros.'}</p>
            ) : (
                <>
                    <div className={`rv-total ${tono || ''}`} aria-live="polite">{fmt(total)}</div>
                    <div className="rv-detalle">{detalle}</div>
                </>
            )}
            {error && <p className="rv-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</p>}
            <div className="rv-acciones">
                <button type="button" className="rv-btn pri" disabled={sinDatos || ocupado} onClick={onPdf}>
                    {generando === 'pdf' ? <><Loader size={16} className="rv-spin" aria-hidden="true" /> Generando PDF…</> : <><Download size={16} aria-hidden="true" /> Descargar PDF</>}
                </button>
                <button type="button" className="rv-btn sec" disabled={sinDatos || ocupado} onClick={onXls}>
                    {generando === 'xls' ? <><Loader size={16} className="rv-spin" aria-hidden="true" /> Generando Excel…</> : <><FileSpreadsheet size={16} aria-hidden="true" /> Excel</>}
                </button>
            </div>
        </section>
    );
}
