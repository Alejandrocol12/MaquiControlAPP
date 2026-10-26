import { useMemo, useState } from 'react';
import { X, Loader, HardHat } from 'lucide-react';
import { updateGasto } from '../../api';
import { useToast } from '../../utils/toast';
import MoneyInput from '../../utils/MoneyInput';
import Monto from '../../utils/Monto';
import './Carteras.css';

const dia10 = (f) => String(f || '').slice(0, 10);
const n = (v) => Number(v) || 0;
const fmt = (v) => '$' + Math.round(n(v)).toLocaleString('es-CO');

function Tarjeta({ titulo, valor, nota, tono = '' }) {
    return (
        <div className={`crt-t ${tono}`}>
            <span>{titulo}</span>
            <b><Monto v={valor} /></b>
            {nota && <small>{nota}</small>}
        </div>
    );
}

// Operadores: lo pagado y lo que se les debe de los cortes ya cerrados. Lo que van ganando en el corte en curso
// todavía no es deuda, así que no entra en estas cuentas.
export function TarjetasOperadores({ maquinas, horas, cortes, pagosOp }) {
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
            // los pagos llenan primero lo ya cortado
            const cerrado = Math.max(0, ganado - enCurso);
            const pendiente = Math.max(0, cerrado - pagado);
            const maq = maquinas.find(m => m.operadorNombre === nombre) || null;
            return { nombre, cerrado, pagado: Math.min(pagado, cerrado) + Math.max(0, pagado - cerrado), pendiente, maq };
        }).filter(f => f.cerrado > 0 || f.pagado > 0).sort((a, b) => b.pendiente - a.pendiente);
    }, [maquinas, horas, cortes, pagosOp]);

    if (!filas.length) return null;
    const total = (k) => filas.reduce((a, f) => a + f[k], 0);

    return (
        <section className="crt" aria-label="Resumen de pagos a operadores">
            <div className="crt-tot dos">
                <Tarjeta titulo="Pagado" valor={total('pagado')} tono="ok" nota={`${filas.length} operador${filas.length === 1 ? '' : 'es'}`} />
                <Tarjeta titulo="Por pagar" valor={total('pendiente')} tono={total('pendiente') > 0.5 ? 'mal' : ''} nota={total('pendiente') > 0.5 ? 'cortes cerrados sin pagar' : 'todo al día'} />
            </div>
            <div className="crt-lista">
                {filas.map(f => {
                    const pct = f.cerrado > 0 ? Math.min(100, f.pagado / f.cerrado * 100) : 100;
                    return (
                        <article className={`crt-c ${f.pendiente > 0.5 ? 'debe' : ''}`} key={f.nombre}>
                            <header>
                                <span className="crt-ico" aria-hidden="true"><HardHat size={16} /></span>
                                <div><b>{f.nombre}</b><small>{f.maq ? f.maq.nombre : 'Sin máquina asignada'}</small></div>
                            </header>
                            <dl className="dos">
                                <div><dt>Pagado</dt><dd className="pos">{fmt(f.pagado)}</dd></div>
                                <div><dt>Por pagar</dt><dd className={f.pendiente > 0.5 ? 'neg' : ''}>{fmt(f.pendiente)}</dd></div>
                            </dl>
                            <div className="crt-barra" role="img" aria-label={`${Math.round(pct)}% de lo cortado ya pagado`}><i style={{ width: `${pct}%` }} /></div>
                            <footer><small>{Math.round(pct)}% de lo cortado pagado</small></footer>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

// Edita el costo causado por un corte (o un pago viejo que quedó solo como gasto): descripción, monto y fecha
export function EditarGastoOperadorModal({ gasto, onCerrar, onGuardado }) {
    const toast = useToast();
    const [descripcion, setDescripcion] = useState(gasto.descripcion || '');
    const [monto, setMonto] = useState(String(Math.round(n(gasto.monto))));
    const [fecha, setFecha] = useState(dia10(gasto.fecha));
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const causado = gasto.corteId != null;

    const guardar = async () => {
        setError('');
        const valor = parseFloat(monto) || 0;
        if (valor <= 0) return setError('Escribe el monto.');
        if (!fecha) return setError('Escribe la fecha.');
        setGuardando(true);
        try {
            await updateGasto(gasto.id, {
                descripcion: descripcion.trim(), categoria: gasto.categoria, monto: valor, fecha,
                maquinaNombre: gasto.maquinaNombre, faenaId: gasto.faenaId ?? null,
            });
            toast('Cambios guardados');
            onGuardado();
        } catch {
            setError('No se pudo guardar. Intenta de nuevo.');
        } finally { setGuardando(false); }
    };

    return (
        <div className="crt-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="crt-modal" role="dialog" aria-modal="true" aria-labelledby="crt-eg">
                <header>
                    <h3 id="crt-eg">{causado ? 'Editar corte causado' : 'Editar pago'}</h3>
                    <button type="button" className="crt-x" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
                </header>
                <p className="crt-sub">{causado
                    ? 'Es lo que ganó el operador en este corte. Si lo cambias, cambia el costo del periodo.'
                    : 'Este pago solo existe como gasto. Al cambiarlo, cambia el gasto.'}</p>
                <div className="crt-campo">
                    <label htmlFor="crt-eg-d">Descripción</label>
                    <input id="crt-eg-d" className="crt-in" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
                </div>
                <div className="crt-f2">
                    <div className="crt-campo"><label htmlFor="crt-eg-m">Monto</label>
                        <MoneyInput id="crt-eg-m" className="crt-in" value={monto} onChange={e => setMonto(e.target.value)} /></div>
                    <div className="crt-campo"><label htmlFor="crt-eg-f">Fecha</label>
                        <input id="crt-eg-f" className="crt-in" type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
                </div>
                {error && <p className="crt-error" role="alert">{error}</p>}
                <div className="crt-acc">
                    <button type="button" className="crt-btn sec" onClick={onCerrar}>Cancelar</button>
                    <button type="button" className="crt-btn" onClick={guardar} disabled={guardando}>{guardando ? <><Loader size={14} aria-hidden="true" /> Guardando…</> : 'Guardar cambios'}</button>
                </div>
            </div>
        </div>
    );
}
