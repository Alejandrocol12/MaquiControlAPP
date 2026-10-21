import { Briefcase, Calendar, Plus, AlertTriangle } from 'lucide-react';
import { fmtFecha } from '../../utils/fmtFecha';
import { fmtHoras } from '../../utils/cortes';
import './PeriodoMaquina.css';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const dia10 = (f) => String(f || '').slice(0, 10);
const diasEntre = (a, b) => Math.max(1, Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000) + 1);

// Cabecera del periodo en campo: nombre, cliente, fechas, lo que lleva y qué tan largo va frente al promedio
export function PeriodoHero({ faena, ingresos, gastos, horas, diasCampo, promedioDias }) {
    const util = ingresos - gastos;
    const pasado = promedioDias && diasCampo > promedioDias;
    return (
        <section className="pm-hero">
            <div className="pm-hero-top">
                <div>
                    <span className="pm-eyebrow"><i aria-hidden="true" /> Periodo activo · En campo</span>
                    <h2>{faena.nombreObra}</h2>
                    <p className="pm-meta">
                        {faena.cliente && <span>Cliente: <b>{faena.cliente}</b></span>}
                        <span><Calendar size={13} aria-hidden="true" /> Inicio: <b>{fmtFecha(faena.fechaInicio)}</b></span>
                        <span>{diasCampo} día{diasCampo === 1 ? '' : 's'} en campo</span>
                    </p>
                    {faena.nota && <p className="pm-nota">{faena.nota}</p>}
                </div>
            </div>
            <div className="pm-datos">
                <div><span>Ingresos</span><b className="vd">{fmt(ingresos)}</b></div>
                <div><span>Gastos</span><b className="rj">{fmt(gastos)}</b></div>
                <div><span>Utilidad</span><b className={util < 0 ? 'rj' : 'na'}>{fmt(util)}</b></div>
                <div><span>Horas</span><b className="am">{fmtHoras(horas)} h</b></div>
            </div>
            {promedioDias && (
                <div className="pm-prog">
                    <div className="pm-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min((diasCampo / promedioDias) * 100, 100))} aria-label="Días en campo frente al promedio">
                        <i className={pasado ? 'alerta' : ''} style={{ width: `${Math.min((diasCampo / promedioDias) * 100, 100)}%` }} />
                    </div>
                    <p className={pasado ? 'alerta' : ''}>
                        {pasado && <AlertTriangle size={14} aria-hidden="true" />}
                        {diasCampo} días en campo — {pasado ? 'por encima del' : 'dentro del'} promedio histórico de {promedioDias} días de esta máquina
                    </p>
                </div>
            )}
        </section>
    );
}

// Lo que se ve cuando la máquina no tiene periodo abierto
export function SinPeriodo({ maquina, onAbrir, mostrando }) {
    return (
        <section className="pm-vacio">
            <span className="pm-vacio-ico" aria-hidden="true"><Briefcase size={26} /></span>
            <h3>No hay periodo activo para {maquina}</h3>
            <p>Cuando la máquina salga a trabajar, abre un periodo. Todos los ingresos, gastos y horas quedan registrados en él hasta que se rindan cuentas.</p>
            {!mostrando && <button type="button" className="pm-abrir" onClick={onAbrir}><Plus size={16} aria-hidden="true" /> Abrir nuevo periodo</button>}
        </section>
    );
}

// Periodos de trabajo ya cerrados de la máquina, del más reciente al más antiguo
export function PeriodosAnteriores({ faenas }) {
    const cerrados = faenas.filter(f => f.tipo !== 'gastos' && f.estado === 'cerrada')
        .sort((a, b) => dia10(b.fechaInicio).localeCompare(dia10(a.fechaInicio)));
    if (!cerrados.length) return null;
    return (
        <section className="pm-hist">
            <header>
                <h3>Periodos anteriores</h3>
                <p>Los periodos que ya se cerraron con rendición de cuentas</p>
            </header>
            {cerrados.map(f => {
                const util = (Number(f.totalIngresos) || 0) - (Number(f.totalGastos) || 0);
                return (
                    <div className="pm-fila" key={f.id}>
                        <div className="pm-fila-nombre">
                            <b>{f.nombreObra || 'Sin nombre'}</b>
                            <small>{fmtFecha(f.fechaInicio)} → {fmtFecha(f.fechaFin)}{f.fechaInicio && f.fechaFin ? ` · ${diasEntre(dia10(f.fechaInicio), dia10(f.fechaFin))} días` : ''}{f.cliente ? ` · ${f.cliente}` : ''}</small>
                        </div>
                        <div className="pm-dato"><span>Ingresos</span><b className="vd">{fmt(f.totalIngresos)}</b></div>
                        <div className="pm-dato"><span>Gastos</span><b className="rj">{fmt(f.totalGastos)}</b></div>
                        <div className="pm-dato"><span>Utilidad</span><b className={util < 0 ? 'rj' : 'na'}>{fmt(util)}</b></div>
                    </div>
                );
            })}
        </section>
    );
}
