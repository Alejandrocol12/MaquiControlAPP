import { useEffect, useRef, useState } from 'react';
import { X, Eraser, FileText, PenLine, Check } from 'lucide-react';
import { fmtFecha } from '../../utils/fmtFecha';
import './FirmaActaModal.css';

const ANCHO = 480, ALTO = 160; // tamaño fijo de la imagen de la firma: liviana y con la misma forma en el PDF

// Recuadro para firmar con el dedo o el mouse. Avisa con la imagen (o null si quedó vacío).
function PadFirma({ etiqueta, inicial, onCambio }) {
    const cv = useRef(null);
    const dibujando = useRef(false);
    const [tiene, setTiene] = useState(!!inicial);

    useEffect(() => {
        const c = cv.current;
        c.width = ANCHO; c.height = ALTO;
        const cx = c.getContext('2d');
        if (inicial) {
            const img = new Image();
            img.onload = () => cx.drawImage(img, 0, 0, ANCHO, ALTO);
            img.src = inicial;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pos = (e) => {
        const r = cv.current.getBoundingClientRect();
        return [(e.clientX - r.left) * (ANCHO / r.width), (e.clientY - r.top) * (ALTO / r.height)];
    };
    const estilo = (cx) => { cx.lineWidth = 3; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#111'; };
    const abajo = (e) => {
        e.preventDefault();
        cv.current.setPointerCapture?.(e.pointerId);
        dibujando.current = true;
        const cx = cv.current.getContext('2d'); estilo(cx);
        const [x, y] = pos(e);
        cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + 0.1, y + 0.1); cx.stroke();
    };
    const mueve = (e) => {
        if (!dibujando.current) return;
        const cx = cv.current.getContext('2d');
        const [x, y] = pos(e);
        cx.lineTo(x, y); cx.stroke();
    };
    const arriba = () => {
        if (!dibujando.current) return;
        dibujando.current = false;
        setTiene(true);
        onCambio(cv.current.toDataURL('image/png'));
    };
    const limpiar = () => {
        cv.current.getContext('2d').clearRect(0, 0, ANCHO, ALTO);
        setTiene(false);
        onCambio(null);
    };

    return (
        <div className="fa-pad">
            <div className="fa-pad-cab"><b>{etiqueta}</b><button type="button" onClick={limpiar} disabled={!tiene}><Eraser size={13} aria-hidden="true" /> Borrar</button></div>
            <canvas ref={cv} className="fa-canvas" aria-label={`Recuadro para la firma: ${etiqueta}`}
                onPointerDown={abajo} onPointerMove={mueve} onPointerUp={arriba} onPointerCancel={arriba} />
            {!tiene && <span className="fa-pista"><PenLine size={14} aria-hidden="true" /> Firma aquí</span>}
        </div>
    );
}

// Antes de generar el acta de horas: firmas en pantalla del cliente y del operador (cada una es opcional).
// Sin firmas, el acta sale con las líneas en blanco para firmar a mano.
export default function FirmaActaModal({ titulo, subtitulo, guardadas, nombreOperador, generando, onGenerar, onCerrar }) {
    const [cliente, setCliente] = useState(guardadas?.cliente?.img || null);
    const [operador, setOperador] = useState(guardadas?.operador?.img || null);
    const [nombreCliente, setNombreCliente] = useState(guardadas?.cliente?.nombre || '');
    const [nombreOp, setNombreOp] = useState(guardadas?.operador?.nombre || nombreOperador || '');
    const [recordar, setRecordar] = useState(true);

    useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onCerrar]);

    const hay = !!(cliente || operador);
    const generar = () => onGenerar({
        cliente: cliente ? { img: cliente, nombre: nombreCliente.trim() } : null,
        operador: operador ? { img: operador, nombre: nombreOp.trim() } : null,
        nombres: { cliente: nombreCliente.trim(), operador: nombreOp.trim() },
        recordar,
    });

    return (
        <div className="fa-fondo" role="dialog" aria-modal="true" aria-label="Firmar el acta de horas" onClick={onCerrar}>
            <div className="fa-caja" onClick={e => e.stopPropagation()}>
                <header>
                    <div><h2>Firmar el acta de horas</h2><p>{titulo}{subtitulo ? ` · ${subtitulo}` : ''}</p></div>
                    <button type="button" className="fa-x" aria-label="Cerrar" onClick={onCerrar}><X size={16} /></button>
                </header>

                {guardadas?.guardada && (
                    <div className="fa-previa"><Check size={14} aria-hidden="true" /> Este corte ya se firmó el {fmtFecha(String(guardadas.guardada).slice(0, 10))}. Puedes cambiar las firmas o volver a imprimir el acta.</div>
                )}

                <div className="fa-cols">
                    <div>
                        <PadFirma etiqueta="Firma del cliente" inicial={guardadas?.cliente?.img} onCambio={setCliente} />
                        <label className="fa-n">Nombre de quien firma<input value={nombreCliente} maxLength={60} placeholder="Opcional" onChange={e => setNombreCliente(e.target.value)} /></label>
                    </div>
                    <div>
                        <PadFirma etiqueta="Firma del operador" inicial={guardadas?.operador?.img} onCambio={setOperador} />
                        <label className="fa-n">Nombre del operador<input value={nombreOp} maxLength={60} placeholder="Opcional" onChange={e => setNombreOp(e.target.value)} /></label>
                    </div>
                </div>

                <label className="fa-rec"><input type="checkbox" checked={recordar} onChange={e => setRecordar(e.target.checked)} /> Guardar las firmas de este corte en este equipo para reimprimir el acta cuando quieras</label>

                <footer>
                    <button type="button" className="fa-sec" disabled={generando} onClick={() => onGenerar({ cliente: null, operador: null, nombres: { cliente: nombreCliente.trim(), operador: nombreOp.trim() }, recordar: false })}>
                        <FileText size={14} aria-hidden="true" /> Generar para firmar a mano
                    </button>
                    <button type="button" className="fa-pri" disabled={!hay || generando} onClick={generar}>
                        <PenLine size={14} aria-hidden="true" /> {generando ? 'Generando…' : 'Generar con las firmas'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
