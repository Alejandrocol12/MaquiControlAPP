import { useState } from 'react';
import { Calendar, X, Gauge, FileText, Save, Loader, AlertTriangle } from 'lucide-react';
import { createIngreso, updateIngreso, updateMaquina, createHora, getOperadoresAPI, guardarParteDiario } from '../../api';
import { useToast } from '../../utils/toast';
import { fmtHoro } from '../../utils/horometro';

export const ESTADOS = [
    ['NORMAL', 'Trabajo normal'],
    ['LLUVIA', 'Parado por lluvia'],
    ['MANTENIMIENTO', 'Mantenimiento'],
    ['DESCANSO', 'Día de descanso'],
];

const r1 = (n) => Math.round(n * 10) / 10;
const aNum = (s) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const aTexto = (n) => (n === null || n === undefined ? '' : String(r1(n)).replace('.', ','));
const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const num = (n) => String(r1(n)).replace('.', ',');

// Parte diario de un día: horas, facturación y mano de obra del día (salen de los ingresos y de la tarifa),
// horómetro inicial y final, cómo operó la máquina y las observaciones.
// Las horas de un día con un solo registro se pueden corregir desde aquí; con varios solo se leen.
function ParteDiarioModal({ maq, fecha, ingresosDia, parte, ultimoHorometro, onCerrar, onGuardado }) {
    const toast = useToast();
    const unico = ingresosDia.length <= 1;
    const existente = ingresosDia[0] || null;
    const iniExist = ingresosDia.map(i => i.horometroInicio).filter(v => v != null);
    const finExist = ingresosDia.map(i => i.horometroFin).filter(v => v != null);

    const [estado, setEstado] = useState(parte?.estadoOperacion || 'NORMAL');
    const [ini, setIni] = useState(aTexto(iniExist.length ? Math.min(...iniExist) : ultimoHorometro));
    const [fin, setFin] = useState(aTexto(finExist.length ? Math.max(...finExist) : ultimoHorometro));
    const [actividad, setActividad] = useState(parte?.actividad ?? existente?.descripcion ?? '');
    const [obs, setObs] = useState(parte?.observaciones || '');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const horasExistentes = ingresosDia.reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
    const totalExistente = ingresosDia.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const nIni = aNum(ini), nFin = aNum(fin);
    const horasEditadas = estado === 'NORMAL' && nIni !== null && nFin !== null ? Math.max(0, r1(nFin - nIni)) : 0;
    const horas = unico ? horasEditadas : horasExistentes;
    const tarifa = existente ? Number(existente.valorUnitario) || 0 : Number(maq.valorHoraMaquina) || 0;
    const facturacion = unico ? horas * tarifa : totalExistente;
    const manoObra = horas * (Number(maq.valorHoraOperador) || 0);

    const bloqueaEstado = estado !== 'NORMAL' && ingresosDia.length > 0;

    const guardar = async () => {
        setError('');
        if (bloqueaEstado) {
            return setError('Este día ya tiene horas registradas. Elimina el registro en Ingresos si quieres marcarlo como día parado.');
        }
        if (unico && estado === 'NORMAL' && (nIni !== null || nFin !== null)) {
            if (nIni === null || nFin === null) return setError('Escribe el horómetro inicial y el final.');
            if (nFin < nIni) return setError('El horómetro final no puede ser menor que el inicial.');
            if (existente && horasEditadas <= 0) return setError('El horómetro final debe ser mayor que el inicial.');
        }
        setGuardando(true);
        try {
            await guardarParteDiario({ maquinaNombre: maq.nombre, fecha, estadoOperacion: estado, actividad: actividad.trim(), observaciones: obs.trim() });

            if (unico && estado === 'NORMAL') {
                const desc = actividad.trim() || `Horas – ${maq.nombre}`;
                if (existente && (horasEditadas !== r1(horasExistentes) || desc !== existente.descripcion)) {
                    await updateIngreso(existente.id, { descripcion: desc, cantidad: horasEditadas, valorUnitario: tarifa, fecha });
                } else if (!existente && horasEditadas > 0) {
                    const { data } = await createIngreso({
                        maquinaNombre: maq.nombre, tipoTrabajo: 'Horas', cantidad: horasEditadas, valorUnitario: tarifa,
                        total: horasEditadas * tarifa, fecha, descripcion: desc, horometroInicio: nIni, horometroFin: nFin,
                    });
                    if (nFin > (Number(maq.horometroActual) || 0)) await updateMaquina(maq.id, { ...maq, horometroActual: nFin });
                    if (maq.operadorNombre) {
                        const ops = await getOperadoresAPI().then(r => r.data || []).catch(() => []);
                        await createHora({
                            operador_id: ops.find(o => o.nombre === maq.operadorNombre)?.id || null,
                            operadorNombre: maq.operadorNombre, maquinaNombre: maq.nombre, fecha,
                            horas: horasEditadas, valorHora: maq.valorHoraOperador || 0,
                            horometroInicio: nIni, horometroFin: nFin, ingresoId: data?.id ?? null,
                        });
                    }
                }
            }
            toast('Parte diario guardado');
            onGuardado();
        } catch (e) {
            console.error(e);
            setError('No se pudo guardar el parte diario. Intenta de nuevo.');
            setGuardando(false);
        }
    };

    return (
        <div className="pd-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="pd-modal" role="dialog" aria-modal="true" aria-labelledby="pd-titulo">
                <header className="pd-cab">
                    <span className="pd-ico" aria-hidden="true"><Calendar size={20} /></span>
                    <div>
                        <h3 id="pd-titulo">Parte Diario · {fecha}</h3>
                        <p>Control de horómetro y jornada de operador</p>
                    </div>
                    <button type="button" className="pd-x" aria-label="Cerrar" onClick={onCerrar}><X size={18} /></button>
                </header>

                <div className="pd-cuerpo">
                    <div className="pd-resumen">
                        <div><span>Horas jornada</span><b className="h">{num(horas)} h</b></div>
                        <div><span>Facturación máquina</span><b className="f">{fmt(facturacion)}</b></div>
                        <div><span>Mano de obra</span><b>{fmt(manoObra)}</b></div>
                    </div>

                    <div className="pd-fila">
                        <label className="pd-campo"><span><Gauge size={13} aria-hidden="true" /> Horómetro inicial</span>
                            <input inputMode="decimal" value={ini} disabled={!unico} onChange={e => setIni(e.target.value)} /></label>
                        <label className="pd-campo"><span><Gauge size={13} aria-hidden="true" /> Horómetro final</span>
                            <input inputMode="decimal" value={fin} disabled={!unico} onChange={e => setFin(e.target.value)} /></label>
                    </div>
                    {!unico && <p className="pd-nota">Este día tiene {ingresosDia.length} registros de horas, así que el horómetro se muestra solo de lectura. Edítalos desde Ingresos.</p>}
                    {unico && existente && <p className="pd-nota">Horómetro actual de la máquina: {fmtHoro(maq.horometroActual)} h. Si corriges las horas se recalcula.</p>}

                    <label className="pd-campo"><span>Estado de operación</span>
                        <select value={estado} onChange={e => setEstado(e.target.value)}>
                            {ESTADOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select></label>

                    <label className="pd-campo"><span><FileText size={13} aria-hidden="true" /> Actividad y frente de trabajo</span>
                        <input value={actividad} maxLength={300} placeholder="Ej: Excavación de zanja frente norte" onChange={e => setActividad(e.target.value)} /></label>

                    <label className="pd-campo"><span>Observaciones técnicas</span>
                        <textarea rows={3} value={obs} maxLength={1000} onChange={e => setObs(e.target.value)} /></label>

                    {error && <p className="pd-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</p>}
                </div>

                <footer className="pd-pie">
                    <button type="button" className="pd-cancelar" onClick={onCerrar}>Cancelar</button>
                    <button type="button" className="pd-guardar" disabled={guardando} onClick={guardar}>
                        {guardando ? <Loader size={16} className="pd-giro" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />} Guardar Parte Diario
                    </button>
                </footer>
            </div>
        </div>
    );
}

export default ParteDiarioModal;
