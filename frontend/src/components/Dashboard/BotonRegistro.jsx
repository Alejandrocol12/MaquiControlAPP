import { useEffect, useState } from 'react';
import { Plus, Clock, TrendingDown } from 'lucide-react';
import { getMaquinas } from '../../api';
import { useToast } from '../../utils/toast';
import RegistroRapido from './RegistroRapido';
import './BotonRegistro.css';

// Botón + siempre a mano: abre el mismo formulario de horas o de gasto del registro rápido, sin importar
// en qué pantalla estés. Con la fecha se pueden cargar registros de días anteriores.
export default function BotonRegistro({ onGuardado }) {
    const toast = useToast();
    const [abierto, setAbierto] = useState(false);
    const [registro, setRegistro] = useState(null); // { tipo, maquinas }
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        if (!abierto) return undefined;
        const esc = (e) => { if (e.key === 'Escape') setAbierto(false); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [abierto]);

    const elegir = async (tipo) => {
        setAbierto(false);
        setCargando(true);
        try {
            const r = await getMaquinas();
            const maquinas = r.data || [];
            if (!maquinas.length) { toast('Primero crea una máquina para poder registrar horas o gastos', 'i'); return; }
            setRegistro({ tipo, maquinas });
        } catch {
            toast('No se pudieron cargar las máquinas. Intenta de nuevo.', 'e');
        } finally {
            setCargando(false);
        }
    };

    return (
        <>
            {abierto && <div className="fab-velo" onClick={() => setAbierto(false)} />}
            <div className="fab-wrap">
                {abierto && (
                    <div className="fab-menu">
                        <button type="button" onClick={() => elegir('gasto')}><TrendingDown size={16} /> Nuevo gasto</button>
                        <button type="button" onClick={() => elegir('horas')}><Clock size={16} /> Registrar horas</button>
                    </div>
                )}
                <button type="button" className={`fab${abierto ? ' abierto' : ''}`} onClick={() => setAbierto(a => !a)} disabled={cargando}
                    aria-label="Registrar horas o un gasto" aria-expanded={abierto} data-tour="fab-registro">
                    <Plus size={26} strokeWidth={2.6} />
                </button>
            </div>
            {registro && (
                <RegistroRapido modal maquinas={registro.maquinas} tipoInicial={registro.tipo}
                    onGuardado={onGuardado} onCerrar={() => setRegistro(null)} />
            )}
        </>
    );
}
