import { useState, useEffect } from 'react';
import { Scissors } from 'lucide-react';
import { getCortes } from '../../api';
import { fmtFecha } from '../../utils/fmtFecha';
import { diaSiguiente, ordenarCortes, resumenTramo, fmtHoras } from '../../utils/cortes';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');

// Tarjeta resumen del corte en curso de un periodo: horas y plata que van desde el último
// corte. Para hacer el corte se va a la sección Cortes (onVer).
function CorteEnCurso({ faena, ingresos, onVer }) {
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

    return (
        <div className="ct-curso">
            <div>
                <div className="ct-curso-lab"><Scissors size={13} /> Corte en curso</div>
                <div className="ct-curso-big">{fmtHoras(enCurso.horas)} h</div>
                <div className="ct-curso-ln">
                    Cuenta desde el <b>{fmtFecha(desde)}</b>
                    {ultimo ? ` · día siguiente al corte ${cortes.length}` : ' · inicio del periodo'}
                </div>
                <div className="ct-curso-ln">
                    {cortes.length === 0 ? 'Todavía no hay cortes en este periodo' : `${cortes.length} corte${cortes.length === 1 ? '' : 's'} hecho${cortes.length === 1 ? '' : 's'}`}
                    {onVer && <> · <button className="ct-curso-fecha" onClick={onVer}>Ver cortes y hacer corte</button></>}
                </div>
            </div>
            <div className="ct-curso-debe">
                <span>Por cobrar en este corte</span>
                <b className="fav">{fmt(enCurso.total)}</b>
            </div>
        </div>
    );
}

export default CorteEnCurso;
