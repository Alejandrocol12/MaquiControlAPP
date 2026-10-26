import { useState } from 'react';
import { X, Loader } from 'lucide-react';
import { createPagoOperador, updatePagoOperador } from '../../api';
import { useToast } from '../../utils/toast';
import MoneyInput from '../../utils/MoneyInput';
import '../Finanzas/Carteras.css';

const n = (v) => Number(v) || 0;
const fmt = (v) => '$' + Math.round(n(v)).toLocaleString('es-CO');
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const METODOS = ['Transferencia', 'Daviplata / Nequi', 'Consignación', 'Efectivo', 'Cheque', 'Otro'];

// Registrar o editar un pago a un operador: fecha, corte al que se imputa (opcional), método, comprobante y monto.
// operadores: [{ nombre }]; cuentas: { [nombre]: cuentaOperador(...) }; inicial: { operador, corteId }; edicion: pago a editar
export default function PagoOperadorForm({ operadores, cuentas, inicial = {}, edicion = null, onCerrar, onGuardado }) {
    const toast = useToast();
    const editando = !!edicion;
    const [operador, setOperador] = useState(edicion?.operadorNombre || inicial.operador || operadores[0]?.nombre || '');
    const tramos = cuentas[operador]?.tramos || [];
    const pendientes = tramos.filter(t => t.debe > 0.5);

    const primero = () => (inicial.corteId != null ? String(inicial.corteId) : pendientes[0] ? String(pendientes[0].id) : '');
    const [corte, setCorte] = useState(editando ? (edicion.corteId != null ? String(edicion.corteId) : '') : primero());
    const tramo = tramos.find(t => String(t.id) === String(corte)) || null;
    const [monto, setMonto] = useState(editando ? String(Math.round(n(edicion.monto))) : (tramo ? String(Math.round(tramo.debe)) : ''));
    const [fecha, setFecha] = useState(editando && edicion.fecha ? String(edicion.fecha).slice(0, 10) : hoy());
    const [metodo, setMetodo] = useState(edicion?.metodoPago || 'Transferencia');
    const [comprobante, setComprobante] = useState(edicion?.comprobante || '');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const valor = parseFloat(monto) || 0;
    const saldoAntes = tramo ? tramo.debe + (editando && String(edicion.corteId) === String(tramo.id) ? n(edicion.monto) : 0) : 0;
    const saldoDespues = Math.max(0, saldoAntes - valor);

    const cambiarOperador = (v) => {
        setOperador(v);
        const t = (cuentas[v]?.tramos || []).filter(x => x.debe > 0.5)[0];
        setCorte(t ? String(t.id) : '');
        if (!editando) setMonto(t ? String(Math.round(t.debe)) : '');
    };
    const cambiarCorte = (v) => {
        setCorte(v);
        const t = tramos.find(x => String(x.id) === v);
        if (!editando && t) setMonto(String(Math.round(t.debe)));
    };

    const guardar = async () => {
        setError('');
        if (!operador) return setError('Elige el operador.');
        if (valor <= 0) return setError('Escribe cuánto se pagó.');
        if (!fecha) return setError('Escribe la fecha.');
        setGuardando(true);
        try {
            const corteNum = tramo && tramo.id !== 'antes' ? Number(tramo.id) : null;
            const payload = {
                operadorNombre: operador, monto: valor, fecha, metodoPago: metodo, comprobante: comprobante.trim(),
                corteId: corteNum, descripcion: tramo ? `Pago · ${tramo.nombre}` : 'Adelanto',
            };
            if (editando) await updatePagoOperador(edicion.id, payload); else await createPagoOperador(payload);
            toast(editando ? 'Pago actualizado' : `Pago de ${fmt(valor)} registrado a ${operador}`);
            onGuardado();
        } catch {
            setError('No se pudo guardar. Intenta de nuevo.');
        } finally { setGuardando(false); }
    };

    return (
        <div className="crt-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="crt-modal" role="dialog" aria-modal="true" aria-labelledby="pof-t">
                <header>
                    <h3 id="pof-t">{editando ? 'Editar pago a operador' : 'Registrar pago a operador'}</h3>
                    <button type="button" className="crt-x" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
                </header>
                <div className="crt-f2">
                    <div className="crt-campo"><label htmlFor="pof-fecha">Fecha</label>
                        <input id="pof-fecha" className="crt-in" type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
                    <div className="crt-campo"><label htmlFor="pof-op">Operador</label>
                        {operadores.length > 1 && !editando
                            ? <select id="pof-op" className="crt-in" value={operador} onChange={e => cambiarOperador(e.target.value)}>{operadores.map(o => <option key={o.nombre}>{o.nombre}</option>)}</select>
                            : <input id="pof-op" className="crt-in" value={operador} readOnly />}
                    </div>
                </div>
                <div className="crt-campo"><label htmlFor="pof-corte">Corte imputado <span style={{ fontWeight: 400 }}>(opcional)</span></label>
                    <select id="pof-corte" className="crt-in" value={corte} onChange={e => cambiarCorte(e.target.value)}>
                        <option value="">Sin imputar (adelanto)</option>
                        {tramos.filter(t => t.debe > 0.5 || String(t.id) === String(corte)).map(t => (
                            <option key={t.id} value={t.id}>{t.nombre}{t.debe > 0.5 ? ` · falta ${fmt(t.debe)}` : ' · pagado'}</option>
                        ))}
                    </select>
                </div>
                <div className="crt-campo"><label htmlFor="pof-monto">Pagado</label>
                    <MoneyInput id="pof-monto" className="crt-in" value={monto} onChange={e => setMonto(e.target.value)} />
                    {tramo && saldoAntes > 0.5 && (
                        <div className="crt-rapido">
                            <button type="button" onClick={() => setMonto(String(Math.round(saldoAntes)))}>Todo el corte ({fmt(saldoAntes)})</button>
                            <button type="button" onClick={() => setMonto(String(Math.round(saldoAntes / 2)))}>La mitad</button>
                        </div>
                    )}
                </div>
                <div className="crt-f2">
                    <div className="crt-campo"><label htmlFor="pof-met">Método de pago</label>
                        <select id="pof-met" className="crt-in" value={metodo} onChange={e => setMetodo(e.target.value)}>
                            {metodo && !METODOS.includes(metodo) && <option>{metodo}</option>}
                            {METODOS.map(m => <option key={m}>{m}</option>)}</select></div>
                    <div className="crt-campo"><label htmlFor="pof-comp">Comprobante #</label>
                        <input id="pof-comp" className="crt-in" maxLength={60} value={comprobante} onChange={e => setComprobante(e.target.value)} placeholder="Ej: TR-99410294" /></div>
                </div>
                <div className="pof-res" aria-live="polite">
                    <div><span>Total del corte</span><b>{tramo ? fmt(tramo.ganado) : '—'}</b></div>
                    <div><span>Pagado</span><b className="pos">{fmt(valor)}</b></div>
                    <div><span>Saldo</span><b className={saldoDespues > 0.5 ? 'neg' : ''}>{tramo ? fmt(saldoDespues) : '—'}</b></div>
                    <div><span>Estado</span><b>{!tramo ? 'Adelanto' : saldoDespues <= 0.5 ? 'Pagado' : 'Parcial'}</b></div>
                </div>
                {error && <p className="crt-error" role="alert">{error}</p>}
                <div className="crt-acc">
                    <button type="button" className="crt-btn sec" onClick={onCerrar}>Cancelar</button>
                    <button type="button" className="crt-btn" onClick={guardar} disabled={guardando}>{guardando ? <><Loader size={14} aria-hidden="true" /> Guardando…</> : editando ? 'Guardar cambios' : 'Registrar pago'}</button>
                </div>
            </div>
        </div>
    );
}
