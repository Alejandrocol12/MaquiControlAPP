import { useState, useEffect } from 'react';
import { Scissors, ChevronRight, ArrowUpRight } from 'lucide-react';
import { getCortes } from '../../api';
import { fmtFecha } from '../../utils/fmtFecha';
import { diaSiguiente, ordenarCortes, resumenTramo, fmtHoras, resumenGastosTramo, leerContarOperador } from '../../utils/cortes';
import Monto from '../../utils/Monto';
import './CorteEnCurso.css';


// Tarjeta del corte en curso de un periodo: las horas y la plata que van desde el último corte.
// Para hacer el corte se va a la sección Cortes (onVer); los gastos del corte llevan a Gastos (onVerGastos).
function CorteEnCurso({ faena, ingresos, gastos = [], onVer, onVerGastos }) {
    const [cortes, setCortes] = useState([]);

    useEffect(() => {
        let vivo = true;
        getCortes()
            .then(r => { if (vivo) setCortes(ordenarCortes((r.data || []).filter(c => String(c.faenaId) === String(faena.id)))); })
            .catch(() => {});
        return () => { vivo = false; };
    }, [faena.id]);

    const ultimo = cortes[cortes.length - 1];
    const desde = ultimo ? diaSiguiente(ultimo.fechaFin) : String(faena.fechaInicio || '').slice(0, 10);
    const enCurso = resumenTramo(ingresos, desde, null);
    const gas = resumenGastosTramo(gastos, desde, null, leerContarOperador());
    const util = enCurso.total - gas.total;
    const margen = enCurso.total > 0 ? (util / enCurso.total) * 100 : 0;

    return (
        <section className="cc">
            <div className="cc-izq">
                <div className="cc-fila-chip">
                    <span className="cc-chip"><Scissors size={14} aria-hidden="true" /> Corte en curso</span>
                    <span className="cc-prev">
                        {cortes.length === 0 ? 'Todavía no hay cortes en este periodo' : `${cortes.length} corte${cortes.length === 1 ? '' : 's'} cerrado${cortes.length === 1 ? '' : 's'} previamente`}
                    </span>
                </div>
                <div className="cc-horas">{fmtHoras(enCurso.horas)}<small> h</small></div>
                <p className="cc-desde">
                    Cuenta desde el <b>{fmtFecha(desde)}</b>
                    <span aria-hidden="true"> · </span>
                    {ultimo ? `día siguiente al corte ${cortes.length}` : 'inicio del periodo'}
                </p>
                {onVer && <button type="button" className="cc-boton" onClick={onVer}><Scissors size={16} aria-hidden="true" /> Ver cortes y hacer corte <ChevronRight size={16} aria-hidden="true" /></button>}
            </div>

            <div className="cc-der">
                <div className="cc-linea">
                    <span>Por cobrar en este corte:</span>
                    <b className="vd"><Monto v={enCurso.total} /></b>
                </div>
                <div className="cc-linea">
                    {onVerGastos
                        ? <button type="button" className="cc-enlace" onClick={onVerGastos}>Gastos en este corte ({gas.n}) <ArrowUpRight size={13} aria-hidden="true" /></button>
                        : <span>Gastos en este corte ({gas.n})</span>}
                    <b className="rj"><Monto v={gas.total} /></b>
                </div>
                <div className="cc-linea util">
                    <span><strong>Utilidad hasta hoy:</strong>{enCurso.total > 0 && <small>Margen neto {(Math.round(margen * 10) / 10).toLocaleString('es-CO')}%</small>}</span>
                    <b className={util < 0 ? 'rj' : 'vd2'}><Monto v={util} /></b>
                </div>
            </div>
        </section>
    );
}

export default CorteEnCurso;
