import { useState } from 'react';
import { X, DollarSign, CheckCircle2, Loader } from 'lucide-react';
import { createPagoOperador } from '../../api';
import { useToast } from '../../utils/toast';
import MoneyInput from '../../utils/MoneyInput';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const CONCEPTOS = ['Liquidación corte en curso', 'Anticipo de nómina', 'Viáticos y alimentación', 'Bonificación extra'];
const METODOS = ['Transferencia', 'Daviplata / Nequi', 'Efectivo en frente', 'Cheque'];

// Pago a un operador desde la lista. Crea el mismo pago que la pestaña Pago Operador (que también queda como gasto).
export default function PagarOperadorModal({ operador, saldo, onCerrar, onPagado }) {
    const toast = useToast();
    const [monto, setMonto] = useState(saldo > 0 ? String(Math.round(saldo)) : '');
    const [concepto, setConcepto] = useState(CONCEPTOS[0]);
    const [metodo, setMetodo] = useState(METODOS[0]);
    const [referencia, setReferencia] = useState('');
    const [fecha, setFecha] = useState(hoy());
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const valor = parseFloat(monto) || 0;
    const nuevoSaldo = Math.max(0, saldo - valor);

    const guardar = async () => {
        setError('');
        if (valor <= 0) return setError('Escribe el monto del pago.');
        setGuardando(true);
        try {
            const descripcion = [concepto, metodo, referencia.trim() && `Ref. ${referencia.trim()}`].filter(Boolean).join(' · ');
            await createPagoOperador({ operadorNombre: operador.nombre, descripcion, monto: valor, fecha });
            toast(`Pago de ${fmt(valor)} registrado a ${operador.nombre}`);
            onPagado();
        } catch (e) {
            console.error(e);
            setError(e.response?.data?.error || 'No se pudo registrar el pago. Intenta de nuevo.');
            setGuardando(false);
        }
    };

    return (
        <div className="opm-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="opm-modal" role="dialog" aria-modal="true" aria-labelledby="opm-pagar-t">
                <header className="opm-cab">
                    <span className="opm-ico" aria-hidden="true"><DollarSign size={20} /></span>
                    <div>
                        <h3 id="opm-pagar-t">Registrar pago a operador</h3>
                        <p>{operador.nombre}{operador.maq ? ` · ${operador.maq.nombre} (${fmt(operador.valorHora)}/h)` : ''}</p>
                    </div>
                    <button type="button" className="opm-x" aria-label="Cerrar" onClick={onCerrar}><X size={18} /></button>
                </header>

                <div className="opm-cuerpo">
                    <div className="opm-saldos">
                        <div><span>Saldo pendiente actual</span><b>{fmt(saldo)}</b></div>
                        <div className="der"><span>Nuevo saldo estimado</span><b className="vd">{fmt(nuevoSaldo)}</b></div>
                    </div>

                    <div>
                        <label className="fl" htmlFor="opm-monto">Monto del pago ($) *</label>
                        <MoneyInput className="fi opm-monto" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 500.000" />
                    </div>

                    <div className="opm-rapido">
                        <span>Rápido:</span>
                        {saldo > 0 && <button type="button" className="tot" onClick={() => setMonto(String(Math.round(saldo)))}>Total ({fmt(saldo)})</button>}
                        {saldo > 0 && <button type="button" onClick={() => setMonto(String(Math.round(saldo / 2)))}>50% ({fmt(saldo / 2)})</button>}
                        <button type="button" onClick={() => setMonto('1000000')}>$1.000.000</button>
                        <button type="button" onClick={() => setMonto('500000')}>$500.000</button>
                    </div>

                    <div className="fg2">
                        <div>
                            <label className="fl" htmlFor="opm-concepto">Concepto</label>
                            <select id="opm-concepto" className="fi" value={concepto} onChange={e => setConcepto(e.target.value)}>
                                {CONCEPTOS.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="fl" htmlFor="opm-metodo">Método de pago</label>
                            <select id="opm-metodo" className="fi" value={metodo} onChange={e => setMetodo(e.target.value)}>
                                {METODOS.map(m => <option key={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="fg2">
                        <div>
                            <label className="fl" htmlFor="opm-fecha">Fecha</label>
                            <input id="opm-fecha" className="fi" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
                        </div>
                        <div>
                            <label className="fl" htmlFor="opm-ref">Referencia (opcional)</label>
                            <input id="opm-ref" className="fi" maxLength={60} value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej: TR-99410294" />
                        </div>
                    </div>
                    <p className="opm-nota">Cada pago queda también como gasto del periodo, así que no lo anotes otra vez en Finanzas.</p>
                    {error && <p className="opm-error" role="alert">{error}</p>}
                </div>

                <footer className="opm-pie">
                    <button type="button" className="opm-cancelar" onClick={onCerrar}>Cancelar</button>
                    <button type="button" className="opm-guardar" disabled={guardando} onClick={guardar}>
                        {guardando ? <Loader size={16} className="opm-giro" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />} Confirmar pago
                    </button>
                </footer>
            </div>
        </div>
    );
}
