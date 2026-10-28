import { useEffect, useRef, useState } from 'react';
import { Bell, X, AlertTriangle, Wrench, DollarSign, HardHat, Clock, Briefcase, Copy, TrendingDown, CheckCheck } from 'lucide-react';
import { useToast } from '../../utils/toast';
import './Campana.css';

const ICONOS = {
    gasto: TrendingDown, novedad: AlertTriangle, mant: Wrench, cobro: DollarSign,
    operador: HardHat, reloj: Clock, periodo: Briefcase, dup: Copy,
};
const ROTULO = { crit: 'Crítico', warn: 'Atención', info: 'Para tener en cuenta' };

// Campana de avisos: lo pendiente o raro que sale del historial real (cobros, pagos al operador, mantenimientos,
// novedades...). Cada aviso lleva a la pantalla donde se resuelve. Los nuevos se ven con una marca ámbar.
export default function Campana({ avisos, leidos, noLeidos, onMarcar, onMarcarTodos, onRecargar, onIr, variante = 'sb' }) {
    const toast = useToast();
    const [abierta, setAbierta] = useState(false);
    const [pos, setPos] = useState({});
    const btn = useRef(null);

    useEffect(() => {
        if (!abierta) return undefined;
        const esc = (e) => { if (e.key === 'Escape') setAbierta(false); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [abierta]);

    const abrir = () => {
        if (abierta) { setAbierta(false); return; }
        const r = btn.current?.getBoundingClientRect();
        if (window.innerWidth <= 768 || !r) setPos({ left: 8, right: 8, top: 56, maxHeight: 'calc(100vh - 72px)' });
        else if (variante === 'top') setPos({ left: Math.max(12, r.right - 360), top: r.bottom + 8, width: 360, maxHeight: `calc(100vh - ${r.bottom + 24}px)` });
        else setPos({ left: Math.min(r.right + 10, window.innerWidth - 380), top: Math.max(12, Math.min(r.top - 8, window.innerHeight - 200)), width: 360, maxHeight: `calc(100vh - ${Math.max(12, r.top - 8) + 16}px)` });
        onRecargar?.();
        setAbierta(true);
    };

    const ir = (a) => {
        onMarcar(a.id);
        setAbierta(false);
        onIr?.(a.destino);
    };

    const resolver = async (e, a) => {
        e.stopPropagation();
        try {
            await a.accion.run();
            toast('Listo, ya quedó resuelto');
            onRecargar?.();
        } catch { toast('No se pudo actualizar. Intenta de nuevo.', 'e'); }
    };

    return (
        <>
            <button ref={btn} type="button" className={`campana ${variante}${abierta ? ' on' : ''}${noLeidos > 0 ? ' tiene' : ''}`} onClick={abrir}
                aria-label={noLeidos ? `Avisos: ${noLeidos} sin leer` : 'Avisos'} aria-expanded={abierta} title="Avisos">
                <Bell size={variante === 'mob' ? 20 : 17} />
                {noLeidos > 0 && <i className="campana-n">{noLeidos > 9 ? '9+' : noLeidos}</i>}
                {variante === 'top' && <span className="campana-t">Avisos</span>}
            </button>

            {abierta && (
                <>
                    <div className="campana-velo" onClick={() => setAbierta(false)} />
                    <div className="campana-panel" style={pos} role="dialog" aria-label="Avisos">
                        <div className="campana-cab">
                            <b>Avisos</b>
                            <span>{avisos.length ? `${avisos.length} · ${noLeidos} sin leer` : ''}</span>
                            {noLeidos > 0 && <button type="button" className="campana-todo" onClick={onMarcarTodos}><CheckCheck size={13} /> Marcar leídos</button>}
                            <button type="button" className="campana-x" aria-label="Cerrar" onClick={() => setAbierta(false)}><X size={15} /></button>
                        </div>
                        <div className="campana-lista">
                            {avisos.length === 0 && <div className="campana-vacio"><Bell size={22} />Todo al día. No hay nada pendiente.</div>}
                            {['crit', 'warn', 'info'].map(t => {
                                const items = avisos.filter(a => a.tipo === t);
                                if (!items.length) return null;
                                return (
                                    <div key={t}>
                                        <div className="campana-grupo">{ROTULO[t]}</div>
                                        {items.map(a => {
                                            const Ico = ICONOS[a.icono] || Bell;
                                            const nuevo = !leidos.has(a.id);
                                            return (
                                                <div key={a.id} className={`campana-av ${a.tipo}${nuevo ? ' nuevo' : ''}`} role="button" tabIndex={0}
                                                    onClick={() => ir(a)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(a); } }}>
                                                    <span className="campana-ico"><Ico size={15} /></span>
                                                    <div>
                                                        <b>{a.titulo}</b>
                                                        <small>{a.detalle}</small>
                                                        {a.accion && <button type="button" className="campana-ac" onClick={e => resolver(e, a)}>{a.accion.label}</button>}
                                                    </div>
                                                    {nuevo && <i className="campana-pt" aria-label="Nuevo" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
