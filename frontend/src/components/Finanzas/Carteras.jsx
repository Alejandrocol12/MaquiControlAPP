import { useMemo, useState } from 'react';
import { X, DollarSign, Loader, HardHat, Briefcase } from 'lucide-react';
import { updatePago } from '../../api';
import { useToast } from '../../utils/toast';
import MoneyInput from '../../utils/MoneyInput';
import Monto from '../../utils/Monto';
import './Carteras.css';

const dia10 = (f) => String(f || '').slice(0, 10);
const n = (v) => Number(v) || 0;
const fmt = (v) => '$' + Math.round(n(v)).toLocaleString('es-CO');
const METODOS = ['Transferencia', 'Consignación', 'Efectivo', 'Cheque', 'Otro'];

function Tarjeta({ titulo, valor, nota, tono = '' }) {
    return (
        <div className={`crt-t ${tono}`}>
            <span>{titulo}</span>
            <b><Monto v={valor} /></b>
            {nota && <small>{nota}</small>}
        </div>
    );
}

// ── Operadores: lo pagado, lo que se debe de cortes cerrados y lo que va ganando en el corte en curso ──
export function TarjetasOperadores({ maquinas, horas, cortes, pagosOp, onPagar }) {
    const filas = useMemo(() => {
        const nombres = new Set([
            ...maquinas.map(m => m.operadorNombre), ...horas.map(h => h.operadorNombre), ...pagosOp.map(p => p.operadorNombre),
        ].filter(Boolean));
        return [...nombres].map(nombre => {
            const hs = horas.filter(h => h.operadorNombre === nombre);
            const ganado = hs.reduce((a, h) => a + n(h.horas) * n(h.valorHora), 0);
            const pagado = pagosOp.filter(p => p.operadorNombre === nombre).reduce((a, p) => a + n(p.monto), 0);
            const maqs = new Set([...maquinas.filter(m => m.operadorNombre === nombre).map(m => m.nombre), ...hs.map(h => h.maquinaNombre)].filter(Boolean));
            const finales = cortes.filter(c => maqs.has(c.maquinaNombre) && c.conOperador !== false).map(c => dia10(c.fechaFin)).sort();
            const ultimo = finales[finales.length - 1] || '';
            const enCurso = hs.filter(h => !ultimo || dia10(h.fecha) > ultimo).reduce((a, h) => a + n(h.horas) * n(h.valorHora), 0);
            const horasCurso = hs.filter(h => !ultimo || dia10(h.fecha) > ultimo).reduce((a, h) => a + n(h.horas), 0);
            // los pagos llenan primero lo ya cortado y después el corte en curso
            const cerrado = Math.max(0, ganado - enCurso);
            const pendiente = Math.max(0, cerrado - pagado);
            const maq = maquinas.find(m => m.operadorNombre === nombre) || null;
            return { nombre, ganado, pagado, enCurso, horasCurso, pendiente, maq, ncortes: finales.length };
        }).filter(f => f.ganado > 0 || f.pagado > 0).sort((a, b) => b.pendiente - a.pendiente || b.enCurso - a.enCurso);
    }, [maquinas, horas, cortes, pagosOp]);

    if (!filas.length) return null;
    const total = (k) => filas.reduce((a, f) => a + f[k], 0);

    return (
        <section className="crt" aria-label="Resumen de pagos a operadores">
            <div className="crt-tot">
                <Tarjeta titulo="Pagado a operadores" valor={total('pagado')} tono="ok" nota={`${filas.length} operador${filas.length === 1 ? '' : 'es'}`} />
                <Tarjeta titulo="Por pagar de cortes cerrados" valor={total('pendiente')} tono={total('pendiente') > 0.5 ? 'mal' : ''} nota={total('pendiente') > 0.5 ? 'lo que ya se les debe' : 'todo al día'} />
                <Tarjeta titulo="Corte en curso" valor={total('enCurso')} nota="ganado, aún sin cortar" />
            </div>
            <div className="crt-lista">
                {filas.map(f => {
                    const pct = f.ganado > 0 ? Math.min(100, f.pagado / f.ganado * 100) : 0;
                    return (
                        <article className={`crt-c ${f.pendiente > 0.5 ? 'debe' : ''}`} key={f.nombre}>
                            <header>
                                <span className="crt-ico" aria-hidden="true"><HardHat size={16} /></span>
                                <div><b>{f.nombre}</b><small>{f.maq ? f.maq.nombre : 'Sin máquina asignada'}</small></div>
                            </header>
                            <dl>
                                <div><dt>Pagado</dt><dd className="pos">{fmt(f.pagado)}</dd></div>
                                <div><dt>Por pagar</dt><dd className={f.pendiente > 0.5 ? 'neg' : ''}>{fmt(f.pendiente)}</dd></div>
                                <div><dt>En curso</dt><dd>{fmt(f.enCurso)}</dd></div>
                            </dl>
                            <div className="crt-barra" role="img" aria-label={`${Math.round(pct)}% de lo ganado ya pagado`}><i style={{ width: `${pct}%` }} /></div>
                            <footer>
                                <small>{Math.round(pct)}% de lo ganado pagado</small>
                                <button type="button" className={f.pendiente > 0.5 ? 'crt-btn' : 'crt-btn sec'} onClick={() => onPagar({ nombre: f.nombre, maq: f.maq, valorHora: f.maq?.valorHoraOperador || 0 }, f.pendiente > 0.5 ? f.pendiente : null)}>
                                    <DollarSign size={14} aria-hidden="true" /> {f.pendiente > 0.5 ? `Pagar ${fmt(f.pendiente)}` : 'Registrar pago'}
                                </button>
                            </footer>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

// ── Clientes: lo cobrado, lo que falta por cobrar de cortes cerrados y lo que va corriendo en el periodo ──
export function TarjetasClientes({ pagos, ingresos, faenas, cortes, onCobrar }) {
    const filas = useMemo(() => {
        const nombres = new Set(pagos.map(p => p.cliente).filter(Boolean));
        faenas.filter(f => f.estado === 'activa' && f.cliente).forEach(f => nombres.add(f.cliente));
        return [...nombres].map(cliente => {
            const cobros = pagos.filter(p => p.cliente === cliente);
            const total = cobros.reduce((a, p) => a + n(p.valorTotal), 0);
            const cobrado = cobros.reduce((a, p) => a + n(p.valorPagado), 0);
            const porCobrar = cobros.reduce((a, p) => a + Math.max(0, n(p.saldoPendiente)), 0);
            // lo que va corriendo: trabajos de sus periodos activos después del último corte
            const activos = faenas.filter(f => f.estado === 'activa' && f.cliente === cliente);
            let enCurso = 0;
            activos.forEach(f => {
                const ultimo = cortes.filter(c => String(c.faenaId) === String(f.id)).map(c => dia10(c.fechaFin)).sort().pop() || '';
                enCurso += ingresos.filter(i => String(i.faenaId) === String(f.id) && (!ultimo || dia10(i.fecha) > ultimo)).reduce((a, i) => a + n(i.total), 0);
            });
            return { cliente, total, cobrado, porCobrar, enCurso, pendientes: cobros.filter(p => n(p.saldoPendiente) > 0.5).sort((a, b) => dia10(a.fecha).localeCompare(dia10(b.fecha))) };
        }).filter(f => f.total > 0 || f.enCurso > 0).sort((a, b) => b.porCobrar - a.porCobrar);
    }, [pagos, ingresos, faenas, cortes]);

    if (!filas.length) return null;
    const total = (k) => filas.reduce((a, f) => a + f[k], 0);

    return (
        <section className="crt" aria-label="Resumen de cobros a clientes">
            <div className="crt-tot">
                <Tarjeta titulo="Cobrado" valor={total('cobrado')} tono="ok" nota={`de ${fmt(total('total'))} cobrados en cortes`} />
                <Tarjeta titulo="Por cobrar de cortes cerrados" valor={total('porCobrar')} tono={total('porCobrar') > 0.5 ? 'mal' : ''} nota={total('porCobrar') > 0.5 ? 'lo que te deben' : 'todo al día'} />
                <Tarjeta titulo="Corte en curso" valor={total('enCurso')} nota="trabajado, aún sin cortar" />
            </div>
            <div className="crt-lista">
                {filas.map(f => {
                    const pct = f.total > 0 ? Math.min(100, f.cobrado / f.total * 100) : 0;
                    return (
                        <article className={`crt-c ${f.porCobrar > 0.5 ? 'debe' : ''}`} key={f.cliente}>
                            <header>
                                <span className="crt-ico" aria-hidden="true"><Briefcase size={16} /></span>
                                <div><b>{f.cliente}</b><small>{f.pendientes.length ? `${f.pendientes.length} cobro${f.pendientes.length === 1 ? '' : 's'} pendiente${f.pendientes.length === 1 ? '' : 's'}` : 'Sin cobros pendientes'}</small></div>
                            </header>
                            <dl>
                                <div><dt>Cobrado</dt><dd className="pos">{fmt(f.cobrado)}</dd></div>
                                <div><dt>Por cobrar</dt><dd className={f.porCobrar > 0.5 ? 'neg' : ''}>{fmt(f.porCobrar)}</dd></div>
                                <div><dt>En curso</dt><dd>{fmt(f.enCurso)}</dd></div>
                            </dl>
                            <div className="crt-barra" role="img" aria-label={`${Math.round(pct)}% cobrado`}><i style={{ width: `${pct}%` }} /></div>
                            <footer>
                                <small>{Math.round(pct)}% cobrado</small>
                                {f.pendientes.length > 0 && (
                                    <button type="button" className="crt-btn" onClick={() => onCobrar(f.cliente, f.pendientes)}>
                                        <DollarSign size={14} aria-hidden="true" /> Registrar pago
                                    </button>
                                )}
                            </footer>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

// Registra lo que pagó un cliente: se aplica al cobro más viejo y lo que sobra pasa al siguiente
export function RegistrarCobroModal({ cliente, cobros, onCerrar, onGuardado }) {
    const toast = useToast();
    const saldo = cobros.reduce((a, p) => a + Math.max(0, n(p.saldoPendiente)), 0);
    const [monto, setMonto] = useState(String(Math.round(saldo)));
    const [metodo, setMetodo] = useState('Transferencia');
    const [comprobante, setComprobante] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const valor = parseFloat(monto) || 0;

    const guardar = async () => {
        setError('');
        if (valor <= 0) return setError('Escribe cuánto pagó el cliente.');
        if (valor > saldo + 0.5) return setError(`El cliente solo debe ${fmt(saldo)}. Si pagó más, registra primero el cobro que falta.`);
        setGuardando(true);
        try {
            let resto = valor;
            for (const c of cobros) {
                if (resto <= 0.5) break;
                const aplica = Math.min(resto, Math.max(0, n(c.saldoPendiente)));
                if (aplica <= 0) continue;
                await updatePago(c.id, {
                    cliente: c.cliente, maquinaNombre: c.maquinaNombre, descripcion: c.descripcion, valorTotal: n(c.valorTotal),
                    valorPagado: n(c.valorPagado) + aplica, fecha: c.fecha, metodoPago: metodo, comprobante: comprobante.trim() || c.comprobante || null,
                });
                resto -= aplica;
            }
            toast(`Pago de ${fmt(valor)} registrado a ${cliente}`);
            onGuardado();
        } catch {
            setError('No se pudo registrar el pago. Intenta de nuevo.');
        } finally { setGuardando(false); }
    };

    return (
        <div className="crt-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="crt-modal" role="dialog" aria-modal="true" aria-labelledby="crt-mt">
                <header>
                    <h3 id="crt-mt">Registrar pago de {cliente}</h3>
                    <button type="button" className="crt-x" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
                </header>
                <p className="crt-sub">Debe <b>{fmt(saldo)}</b> en {cobros.length} cobro{cobros.length === 1 ? '' : 's'}. El pago se aplica primero al más viejo.</p>
                <div className="crt-campo">
                    <label htmlFor="crt-monto">Cuánto pagó</label>
                    <MoneyInput id="crt-monto" className="crt-in" value={monto} onChange={e => setMonto(e.target.value)} />
                    <div className="crt-rapido">
                        <button type="button" onClick={() => setMonto(String(Math.round(saldo)))}>Todo ({fmt(saldo)})</button>
                        <button type="button" onClick={() => setMonto(String(Math.round(saldo / 2)))}>La mitad</button>
                    </div>
                </div>
                <div className="crt-f2">
                    <div className="crt-campo"><label htmlFor="crt-met">Método</label>
                        <select id="crt-met" className="crt-in" value={metodo} onChange={e => setMetodo(e.target.value)}>{METODOS.map(m => <option key={m}>{m}</option>)}</select></div>
                    <div className="crt-campo"><label htmlFor="crt-comp">Comprobante #</label>
                        <input id="crt-comp" className="crt-in" maxLength={60} value={comprobante} onChange={e => setComprobante(e.target.value)} placeholder="Ej: TR-99410294" /></div>
                </div>
                {error && <p className="crt-error" role="alert">{error}</p>}
                <div className="crt-acc">
                    <button type="button" className="crt-btn sec" onClick={onCerrar}>Cancelar</button>
                    <button type="button" className="crt-btn" onClick={guardar} disabled={guardando}>{guardando ? <><Loader size={14} aria-hidden="true" /> Guardando…</> : 'Registrar pago'}</button>
                </div>
            </div>
        </div>
    );
}
