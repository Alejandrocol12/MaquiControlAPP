import { useState, useEffect, useCallback } from 'react';
import { Scissors, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { getCortes, createCorte, deleteCorte, getPagos, getHoras } from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import { fmtFecha } from '../../utils/fmtFecha';
import Estado from '../../utils/Estado';
import {
    hoyISO, diaSiguiente, ordenarCortes, resumenTramo, resumenOperador, sinCortarAntesDe, fmtHoras,
    resumenGastosTramo, gastosSinCortarAntesDe, leerContarOperador, guardarContarOperador,
} from '../../utils/cortes';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const ESTADO_PAGO = { Pagado: 'Pagado', Parcial: 'Parcial', Deuda: 'Pendiente' };

// Cortes de un periodo: tramos entre dos fechas que digita el admin. De cada corte salen las
// horas y la plata a cobrar al cliente; las mismas fechas sirven para liquidar al operador.
function CortesFaena({ faena, ingresos, gastos = [], onCambio }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [cortes, setCortes] = useState([]);
    const [pagos, setPagos] = useState([]);
    const [horasOp, setHorasOp] = useState([]);
    const [abierto, setAbierto] = useState(false);
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [crearCobro, setCrearCobro] = useState(true);
    const [conOperador, setConOperador] = useState(true);
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [contarOp, setContarOp] = useState(leerContarOperador);
    const [abierta, setAbierta] = useState(null); // corte (id) o 'curso' con el detalle de gastos a la vista
    const cambiarOp = (v) => { setContarOp(v); guardarContarOperador(v); };

    const cargar = useCallback(async () => {
        try {
            const [c, p, h] = await Promise.all([getCortes(), getPagos(), getHoras()]);
            setCortes(ordenarCortes((c.data || []).filter(x => String(x.faenaId) === String(faena.id))));
            setPagos(p.data || []);
            setHorasOp((h.data || []).filter(x => String(x.faenaId) === String(faena.id)));
        } catch (e) { console.error(e); }
    }, [faena.id]);

    useEffect(() => { cargar(); }, [cargar]);

    const inicioPeriodo = String(faena.fechaInicio || '').slice(0, 10);
    const finPeriodo = faena.estado === 'activa' ? hoyISO() : String(faena.fechaFin || hoyISO()).slice(0, 10);
    const ultimo = cortes[cortes.length - 1];
    const sigue = ultimo ? diaSiguiente(ultimo.fechaFin) : inicioPeriodo;

    // Lo que falta por cortar después del último corte, y lo que quedó suelto antes de él
    const enCurso = resumenTramo(ingresos, sigue, null);
    const sueltos = ultimo ? sinCortarAntesDe(ingresos, cortes, ultimo.fechaFin) : { registros: 0, horas: 0, total: 0 };

    const gastosSueltos = ultimo ? gastosSinCortarAntesDe(gastos, cortes, ultimo.fechaFin, contarOp) : { n: 0, total: 0 };
    const gasEnCurso = resumenGastosTramo(gastos, sigue, null, contarOp);

    const abrir = () => {
        setDesde(sigue > finPeriodo ? finPeriodo : sigue);
        setHasta(finPeriodo);
        setError('');
        setAbierto(true);
    };

    const fechasOk = desde && hasta && desde <= hasta;
    const previa = fechasOk ? resumenTramo(ingresos, desde, hasta) : { horas: 0, total: 0, registros: 0 };
    const previaOp = fechasOk ? resumenOperador(horasOp, desde, hasta) : { horas: 0, ganado: 0 };
    const previaGas = fechasOk ? resumenGastosTramo(gastos, desde, hasta, contarOp) : { total: 0, n: 0, categorias: [], lista: [] };

    const guardar = async () => {
        if (!desde || !hasta) { setError('Escribe las dos fechas.'); return; }
        if (desde > hasta) { setError('La fecha "desde" no puede ser después de "hasta".'); return; }
        if (cortes.some(c => desde <= String(c.fechaFin).slice(0, 10) && hasta >= String(c.fechaInicio).slice(0, 10))) {
            setError('Esas fechas se cruzan con un corte que ya existe.'); return;
        }
        if (previa.registros === 0) { setError('No hay trabajos registrados en esas fechas.'); return; }
        setGuardando(true);
        try {
            await createCorte({ faenaId: faena.id, fechaInicio: desde, fechaFin: hasta, crearCobro, conOperador });
            toast(`Corte hecho: ${fmtHoras(previa.horas)} h, ${fmt(previa.total)} a cobrar`);
            setAbierto(false);
            await cargar();
            onCambio?.();
        } catch (e) {
            setError(e.response?.data?.error || 'No se pudo hacer el corte. Intenta de nuevo.');
        }
        setGuardando(false);
    };

    const deshacer = async (c, pago) => {
        const aviso = pago && Number(pago.valorPagado) > 0
            ? ' El cobro de este corte ya tiene abonos, así que se conserva en Pagos Clientes.'
            : pago ? ' También se borra el cobro que se creó en Pagos Clientes.' : '';
        if (!await confirm(`¿Deshacer el corte del ${fmtFecha(c.fechaInicio)} al ${fmtFecha(c.fechaFin)}?${aviso}`)) return;
        try {
            await deleteCorte(c.id);
            toast('Corte deshecho');
            await cargar();
            onCambio?.();
        } catch (e) {
            toast(e.response?.data?.error || 'No se pudo deshacer el corte', 'e');
        }
    };

    return (
        <div className="ct-box">
            {ConfirmUI}
            <div className="ct-head">
                <b><Scissors size={14} /> Cortes</b>
                {!abierto && <button className="bp ct-btn" onClick={abrir}><Scissors size={13} /> Hacer corte</button>}
            </div>

            <label className="ct-check ct-op"><input type="checkbox" checked={contarOp} onChange={e => cambiarOp(e.target.checked)} /><span>Contar el pago al operador como gasto del corte <small>Apágalo si el operador no cobra.</small></span></label>

            {abierto && (
                <div className="ct-form">
                    <div className="fg2-keep">
                        <div><label className="fl" htmlFor={`ctd${faena.id}`}>Desde</label><input id={`ctd${faena.id}`} className="fi" type="date" value={desde} min={inicioPeriodo || undefined} onChange={e => { setDesde(e.target.value); setError(''); }} /></div>
                        <div><label className="fl" htmlFor={`cth${faena.id}`}>Hasta</label><input id={`cth${faena.id}`} className="fi" type="date" value={hasta} min={inicioPeriodo || undefined} onChange={e => { setHasta(e.target.value); setError(''); }} /></div>
                    </div>
                    <div className="ct-calc">
                        <div><span>Horas en esas fechas</span><b>{fmtHoras(previa.horas)} h</b></div>
                        <div><span>A cobrar al cliente</span><b className="pos">{fmt(previa.total)}</b></div>
                        <div><span>Gastos en esas fechas ({previaGas.n})</span><b className="neg">{fmt(previaGas.total)}</b></div>
                        <div><span>Utilidad del corte</span><b className={previa.total - previaGas.total < 0 ? 'neg' : 'pos'}>{fmt(previa.total - previaGas.total)}</b></div>
                        {conOperador && <div><span>Horas del operador</span><b>{fmtHoras(previaOp.horas)} h</b></div>}
                    </div>
                    <label className="ct-check"><input type="checkbox" checked={crearCobro} onChange={e => setCrearCobro(e.target.checked)} /><span>Crear el cobro en Pagos Clientes</span></label>
                    <label className="ct-check"><input type="checkbox" checked={conOperador} onChange={e => setConOperador(e.target.checked)} /><span>Hacer también el corte del operador con estas fechas</span></label>
                    {error && <p className="ct-error" role="alert">{error}</p>}
                    <div className="ct-acts">
                        <button className="bs" onClick={() => setAbierto(false)}>Cancelar</button>
                        <button className="bp" onClick={guardar} disabled={guardando}><Check size={14} /> {guardando ? 'Guardando…' : 'Hacer corte'}</button>
                    </div>
                </div>
            )}

            {sueltos.registros > 0 && (
                <div className="ct-aviso"><AlertTriangle size={14} /> Hay {fmtHoras(sueltos.horas)} h ({fmt(sueltos.total)}) sin cortar en fechas anteriores al último corte.</div>
            )}

            {gastosSueltos.n > 0 && (
                <div className="ct-aviso"><AlertTriangle size={14} /> Hay {gastosSueltos.n} gasto{gastosSueltos.n === 1 ? '' : 's'} ({fmt(gastosSueltos.total)}) sin cortar en fechas anteriores al último corte.</div>
            )}

            <div className="ct-tabla">
                <div className="ct-row cli h"><span>Corte</span><span>Fechas</span><span className="r">Horas</span><span className="r">A cobrar</span><span className="r">Gastos</span><span className="r">Utilidad</span><span>Estado</span><span /></div>
                {cortes.length === 0 && enCurso.registros === 0 && (
                    <div className="ct-vacio">Todavía no hay cortes ni trabajos en este periodo.</div>
                )}
                {cortes.map((c, i) => {
                    const vivo = resumenTramo(ingresos, c.fechaInicio, c.fechaFin);
                    const pago = c.pagoClienteId ? pagos.find(p => String(p.id) === String(c.pagoClienteId)) : null;
                    const cambio = Math.round(vivo.total) !== Math.round(Number(c.total) || 0);
                    const gas = resumenGastosTramo(gastos, c.fechaInicio, c.fechaFin, contarOp);
                    const util = vivo.total - gas.total;
                    return (
                        <div key={c.id}>
                            <div className="ct-row cli abrible" onClick={() => setAbierta(abierta === c.id ? null : c.id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setAbierta(abierta === c.id ? null : c.id); }}>
                                <span data-l="Corte"><b>Corte {i + 1}</b></span>
                                <span data-l="Fechas">{fmtFecha(c.fechaInicio)} a {fmtFecha(c.fechaFin)}</span>
                                <span data-l="Horas" className="r ct-num">{fmtHoras(vivo.horas)} h</span>
                                <span data-l="A cobrar" className="r ct-num">
                                    {fmt(vivo.total)}
                                    {cambio && <small className="ct-cambio" title="Se registraron o corrigieron trabajos de estas fechas después de hacer el corte.">cambió, antes {fmt(c.total)}</small>}
                                </span>
                                <span data-l="Gastos" className="r ct-num neg">{fmt(gas.total)}</span>
                                <span data-l="Utilidad" className={`r ct-num ${util < 0 ? 'neg' : 'pos'}`}>{fmt(util)}</span>
                                <span data-l="Estado">{pago ? <Estado valor={ESTADO_PAGO[pago.estado] || pago.estado} /> : <Estado valor="Sin cobro" tono="neutral" />}</span>
                                <span className="ct-fin">
                                    {i === cortes.length - 1 && (
                                        <button className="ct-link" onClick={e => { e.stopPropagation(); deshacer(c, pago); }}><RotateCcw size={12} /> Deshacer</button>
                                    )}
                                </span>
                            </div>
                            {abierta === c.id && <DetalleGastos gas={gas} />}
                        </div>
                    );
                })}
                {(enCurso.registros > 0 || gasEnCurso.n > 0) && (
                    <div>
                        <div className="ct-row cli curso abrible" onClick={() => setAbierta(abierta === 'curso' ? null : 'curso')} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setAbierta(abierta === 'curso' ? null : 'curso'); }}>
                            <span data-l="Corte"><b>{faena.estado === 'activa' ? 'En curso' : 'Sin cortar'}</b></span>
                            <span data-l="Fechas">{fmtFecha(sigue)} a {faena.estado === 'activa' ? 'hoy' : fmtFecha(finPeriodo)}</span>
                            <span data-l="Horas" className="r ct-num">{fmtHoras(enCurso.horas)} h</span>
                            <span data-l="A cobrar" className="r ct-num">{fmt(enCurso.total)}</span>
                            <span data-l="Gastos" className="r ct-num neg">{fmt(gasEnCurso.total)}</span>
                            <span data-l="Utilidad" className={`r ct-num ${enCurso.total - gasEnCurso.total < 0 ? 'neg' : 'pos'}`}>{fmt(enCurso.total - gasEnCurso.total)}</span>
                            <span data-l="Estado"><Estado valor="Sin cortar" tono="neutral" /></span>
                            <span />
                        </div>
                        {abierta === 'curso' && <DetalleGastos gas={gasEnCurso} />}
                    </div>
                )}
            </div>
        </div>
    );
}

// Gastos de un corte, uno por uno y en dos columnas para ahorrar espacio
function DetalleGastos({ gas }) {
    if (gas.n === 0) return <div className="ct-det"><p className="ct-vacio" style={{ margin: 0 }}>No hay gastos en estas fechas.</p></div>;
    return (
        <div className="ct-det">
            <div className="ct-glist">
                {gas.lista.map(g => (
                    <div className="ct-gl" key={g.id}>
                        <span className="ct-gf">{fmtFecha(g.fecha)}</span>
                        <span>{g.descripcion}<small>{g.categoria}{g.pagadoPor ? ` · pagó ${g.pagadoPor}` : ''}</small></span>
                        <b className="ct-num">{fmt(g.monto)}</b>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CortesFaena;
