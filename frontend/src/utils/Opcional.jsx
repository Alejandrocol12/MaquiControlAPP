import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// Sección plegable para los campos opcionales de un formulario: lo obligatorio
// se ve primero y lo demás queda guardado. Se abre sola si `abierto` pasa a true
// (por ejemplo, al editar un registro que ya trae esos datos).
function Opcional({ label, abierto = false, children }) {
    const [open, setOpen] = useState(abierto);
    useEffect(() => { if (abierto) setOpen(true); }, [abierto]);
    return (
        <>
            <button type="button" className="fopt" aria-expanded={open} onClick={() => setOpen(o => !o)}>
                {label} <ChevronDown size={15} />
            </button>
            {open && children}
        </>
    );
}

export default Opcional;
