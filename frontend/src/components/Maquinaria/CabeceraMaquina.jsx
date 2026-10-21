import { Gauge, MapPin, HardHat, Wallet, Cog } from 'lucide-react';
import { fmtHoro } from '../../utils/horometro';
import './CabeceraMaquina.css';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');

// Ficha de la máquina: quién es, en qué estado está y cuánto vale su hora, de un vistazo
export default function CabeceraMaquina({ maq, faenaActiva, icono }) {
    const estado = maq.estado === 'Activa' ? 'ok' : maq.estado === 'En mantenimiento' ? 'warn' : 'off';
    return (
        <header className="cm">
            <div className="cm-id">
                <span className="cm-ico" aria-hidden="true">{icono}</span>
                <div className="cm-nombre">
                    <div className="cm-linea">
                        <h2>{maq.nombre}</h2>
                        {maq.placa && <span className="cm-placa">Placa {maq.placa}</span>}
                    </div>
                    <div className="cm-chips">
                        <span className={`cm-chip ${estado}`}><i aria-hidden="true" />{maq.estado}</span>
                        <span className="cm-chip horo"><Gauge size={13} aria-hidden="true" /> {fmtHoro(maq.horometroActual)} hrs horómetro</span>
                        {faenaActiva
                            ? <span className="cm-chip periodo"><MapPin size={13} aria-hidden="true" /> Periodo: {faenaActiva.nombreObra}</span>
                            : <span className="cm-chip sin"><MapPin size={13} aria-hidden="true" /> Sin periodo activo</span>}
                    </div>
                </div>
            </div>

            <dl className="cm-datos">
                <div><dt><Cog size={14} aria-hidden="true" /> Tipo</dt><dd>{maq.tipo || '—'}</dd></div>
                <div><dt><HardHat size={14} aria-hidden="true" /> Operador</dt><dd>{maq.operadorNombre || 'Sin asignar'}</dd></div>
                <div><dt><Wallet size={14} aria-hidden="true" /> Hora operador</dt><dd className="mono">{fmt(maq.valorHoraOperador)}</dd></div>
                <div><dt><Wallet size={14} aria-hidden="true" /> Hora máquina</dt><dd className="mono vd">{fmt(maq.valorHoraMaquina)}</dd></div>
            </dl>
        </header>
    );
}
