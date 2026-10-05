// Botones de filtro (fechas, periodos…) con un solo estilo para toda la app.
// En celular quedan en una sola fila que se desliza; `children` (p. ej. los
// campos de fecha de "Personalizado") va debajo.
function FiltroChips({ opciones, valor, onChange, children, className = '' }) {
    return (
        <div className={`fchips ${className}`}>
            <div className="fchips-row" role="group">
                {opciones.map(o => (
                    <button
                        key={o.key}
                        type="button"
                        className={`fchip ${valor === o.key ? 'on' : ''}`}
                        aria-pressed={valor === o.key}
                        onClick={() => onChange(o.key)}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
            {children}
        </div>
    );
}

export default FiltroChips;
