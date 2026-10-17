import Estado from '../../utils/Estado';
import { fmtHoras } from '../../utils/cortes';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');

// Los cortes del operador como tarjetas (el mismo diseño de los cortes de Periodo en Maquinaria),
// con lo que se ganó, lo que se le pagó y lo que se le debe en cada uno. Los pagos se aplican
// primero al corte más viejo que tenga deuda.
function CortesOperador({ filas, resumen = true, onVerHoras, extraEnCurso }) {
    if (!filas.length) return null;
    const pagado = filas.reduce((a, f) => a + f.pagado, 0);
    const porPagar = filas.filter(f => f.id !== 'curso').reduce((a, f) => a + f.debe, 0);
    const enCurso = filas.filter(f => f.id === 'curso').reduce((a, f) => a + f.debe, 0);
    const base = pagado + porPagar + enCurso;
    const pct = (v) => (base > 0 ? (v / base) * 100 : 0);

    return (
        <>
            {resumen && (
                <>
                    <div className="ct-sum">
                        <div className="ct-sum-t ok"><span>Pagado</span><b>{fmt(pagado)}</b><small>{Math.round(pct(pagado))}% de lo ganado</small></div>
                        <div className="ct-sum-t warn"><span>Por pagar</span><b>{fmt(porPagar)}</b><small>cortes ya hechos</small></div>
                        <div className="ct-sum-t"><span>En curso</span><b>{fmt(enCurso)}</b><small>corte sin cerrar</small></div>
                    </div>
                    <div className="ct-sbar" role="img" aria-label="Pagado, por pagar y en curso">
                        <i className="ok" style={{ width: `${pct(pagado)}%` }} />
                        <i className="warn" style={{ width: `${pct(porPagar)}%` }} />
                        <i className="gold" style={{ width: `${pct(enCurso)}%` }} />
                    </div>
                </>
            )}
            <div className="ct-cards">
                {filas.map(f => {
                    const curso = f.id === 'curso';
                    const tono = curso ? 'curso' : f.debe <= 0 ? 'ok' : f.pagado > 0 ? 'warn' : 'bad';
                    return (
                        <div key={f.id} className={`ct-card ${tono}`}>
                            <div className="ct-card-top">
                                <b>{f.nombre}</b>
                                {curso ? <Estado valor="En curso" /> : f.debe <= 0 ? <Estado valor="Pagado" /> : f.pagado > 0 ? <Estado valor="Parcial" /> : <Estado valor="Pendiente" />}
                            </div>
                            <div className="ct-card-f">{f.fechas}</div>
                            <div className="ct-card-big">{fmt(f.debe)} <small className="ct-card-lb">le debes</small></div>
                            <div className="ct-card-r"><span>Horas</span><b>{fmtHoras(f.horas)} h</b></div>
                            <div className="ct-card-r"><span>Se ganó</span><b>{fmt(f.ganado)}</b></div>
                            <div className="ct-card-r"><span>Pagado</span><b className="pos">{fmt(f.pagado)}</b></div>
                            <div className="ct-bar" aria-hidden="true"><i style={{ width: `${f.ganado > 0 ? Math.min(100, f.pagado / f.ganado * 100) : 0}%` }} /></div>
                            {curso && extraEnCurso}
                            {onVerHoras && <div className="ct-card-a"><button type="button" className="ct-link" onClick={() => onVerHoras(f.id)}>Ver las horas</button></div>}
                        </div>
                    );
                })}
            </div>
        </>
    );
}

export default CortesOperador;
