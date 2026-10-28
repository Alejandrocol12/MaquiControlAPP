import { useState, useEffect, useCallback } from 'react';
import { Scissors, Check, RotateCcw, AlertTriangle, Share2, Pencil, X, Printer, Clock } from 'lucide-react';
import { gruposDeCortes, pdfReporteCorte, pdfActaHoras } from '../../utils/reporteCorte';
import './CortesNuevo.css';
import { getCortes, createCorte, deleteCorte, getPagos, getHoras, renombrarCorte } from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import { fmtFecha } from '../../utils/fmtFecha';
import CalendarioCorte from './CalendarioCorte';
import {
    hoyISO, diaSiguiente, ordenarCortes, nombreCorte, resumenTramo, resumenOperador, sinCortarAntesDe, fmtHoras,
    resumenGastosTramo, gastosSinCortarAntesDe, leerContarOperador, guardarContarOperador,
} from '../../utils/cortes';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');

// Cortes de un periodo: tramos entre dos fechas que digita el admin. De cada corte salen las
// horas y la plata a cobrar al cliente; las mismas fechas sirven para liquidar al operador.
function CortesFaena({ faena, ingresos, gastos = [], onCambio, onCompartir }) {
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
    const [generandoActa, setGenerandoActa] = useState('');
    const cambiarOp = (v) => { setContarOp(v); guardarContarOperador(v); };
    const [renombrando, setRenombrando] = useState(null); // id del corte que se está renombrando
    const [nombreNuevo, setNombreNuevo] = useState('');
    const guardarNombre = async (c) => {
        try {
            await renombrarCorte(c.id, nombreNuevo.trim());
            setRenombrando(null);
            toast(nombreNuevo.trim() ? 'Nombre del corte guardado' : 'Se quitó el nombre del corte');
            await cargar();
            onCambio?.();
        } catch { toast('No se pudo cambiar el nombre. Intenta de nuevo.', 'e'); }
    };

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

    // Acta del corte: el mismo reporte por corte (ingresos y gastos) que se genera en Reportes
    const acta = async (idGrupo) => {
        const g = gruposDeCortes(faena, cortes, ingresos, gastos).find(x => x.id === idGrupo);
        if (!g) { toast('Este corte no tiene movimientos para el acta.', 'e'); return; }
        setGenerandoActa(idGrupo);
        try {
            await pdfReporteCorte({ maquina: faena.maquinaNombre, faena, grupos: [g], incluir: 'amb' });
            toast('Acta generada');
        } catch (e) { console.error(e); toast('No se pudo generar el acta. Intenta de nuevo.', 'e'); }
        setGenerandoActa('');
    };

    // Acta de horas: cada día del corte con sus horas y el horómetro de inicio y fin, para firmar
    const actaHoras = async (idGrupo) => {
        const g = gruposDeCortes(faena, cortes, ingresos, gastos).find(x => x.id === idGrupo);
        if (!g) { toast('Este corte no tiene horas para el acta.', 'e'); return; }
        setGenerandoActa('h' + idGrupo);
        try {
            await pdfActaHoras({ maquina: faena.maquinaNombre, faena, grupo: g });
            toast('Acta de horas generada');
        } catch (e) { console.error(e); toast('No se pudo generar el acta de horas. Intenta de nuevo.', 'e'); }
        setGenerandoActa('');
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

    // Una fila por corte con lo que sale de los trabajos de esas fechas y de su cobro
    const filas = cortes.map((c, i) => {
        const vivo = resumenTramo(ingresos, c.fechaInicio, c.fechaFin);
        const pago = c.pagoClienteId ? pagos.find(p => String(p.id) === String(c.pagoClienteId)) : null;
        const gas = resumenGastosTramo(gastos, c.fechaInicio, c.fechaFin, contarOp);
        const pagado = pago ? Math.min(Number(pago.valorPagado) || 0, vivo.total) : 0;
        return { c, i, vivo, pago, gas, pagado };
    });
    const cobrado = filas.reduce((a, f) => a + f.pagado, 0);
    const porCobrar = filas.reduce((a, f) => a + Math.max(0, f.vivo.total - f.pagado), 0);
    const sinCortar = enCurso.total + sueltos.total;
    const baseTotal = cobrado + porCobrar + sinCortar;
    const pct = (v) => (baseTotal > 0 ? (v / baseTotal) * 100 : 0);
    const hayAlgo = cortes.length > 0 || enCurso.registros > 0 || gasEnCurso.n > 0;

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
                    <CalendarioCorte desde={desde} hasta={hasta} min={inicioPeriodo} max={finPeriodo} cortes={cortes} ingresos={ingresos}
                        onCambio={r => { setDesde(r.desde); setHasta(r.hasta); setError(''); }} />
                    <div className="ct-calc">
                        <div><span>Horas en esas fechas</span><b>{fmtHoras(previa.horas)} h</b></div>
                        <div><span>A cobrar al cliente</span><b className="pos">{fmt(previa.total)}</b></div>
                        <div><span>Gastos en esas fechas ({previaGas.n})</span><b className="neg">{fmt(previaGas.total)}</b></div>
                        <div><span>Utilidad del corte</span><b className={previa.total - previaGas.total < 0 ? 'neg' : 'pos'}>{fmt(previa.total - previaGas.total)}</b></div>
                        {conOperador && <div><span>Horas del operador</span><b>{fmtHoras(previaOp.horas)} h</b></div>}
                    </div>
                    <label className="ct-check"><input type="checkbox" checked={crearCobro} onChange={e => setCrearCobro(e.target.checked)} /><span>Crear el cobro en Pagos Clientes</span></label>
                    <label className="ct-check"><input type="checkbox" checked={conOperador} onChange={e => setConOperador(e.target.checked)} /><span>Hacer también el corte del operador con estas fechas</span></label>
                    {conOperador && previaOp.ganado > 0 && <p className="ct-error" style={{ color: "inherit", margin: "0 0 8px", fontSize: 13 }}>Se registra el gasto del operador por <b>{fmt(previaOp.ganado)}</b> ({fmtHoras(previaOp.horas)} h) como "Pago operador", pendiente de pagar. Cuando le pagues, ese pago se descuenta de ahí y no se cuenta dos veces.</p>}
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

            {hayAlgo && (
                <>
                    <div className="ct-sum">
                        <div className="ct-sum-t ok"><span>Cobrado</span><b>{fmt(cobrado)}</b><small>{Math.round(pct(cobrado))}% del periodo</small></div>
                        <div className="ct-sum-t warn"><span>Por cobrar</span><b>{fmt(porCobrar)}</b><small>cortes sin pagar</small></div>
                        <div className="ct-sum-t"><span>Sin cortar</span><b>{fmt(sinCortar)}</b><small>{faena.estado === 'activa' ? 'corte en curso' : 'sin cortar'}</small></div>
                    </div>
                    <div className="ct-sbar" role="img" aria-label="Cobrado, por cobrar y sin cortar">
                        <i className="ok" style={{ width: `${pct(cobrado)}%` }} />
                        <i className="warn" style={{ width: `${pct(porCobrar)}%` }} />
                        <i className="gold" style={{ width: `${pct(sinCortar)}%` }} />
                    </div>
                </>
            )}

            {!hayAlgo && <div className="ct-vacio">Todavía no hay cortes ni trabajos en este periodo.</div>}

            <div className="ctn-cards">
                {filas.map(({ c, i, vivo, pago, gas, pagado }) => {
                    const util = vivo.total - gas.total;
                    const cambio = Math.round(vivo.total) !== Math.round(Number(c.total) || 0);
                    const saldo = Math.max(0, vivo.total - pagado);
                    const chip = !pago ? ['gris', 'SIN COBRO'] : pago.estado === 'Pagado' ? ['verde', 'COBRADO'] : ['azul', 'SALDO PENDIENTE'];
                    return (
                        <article key={c.id} className="ctn-card">
                            <div className="ctn-top">
                                {renombrando === c.id ? (
                                    <span className="ct-ren">
                                        <input className="fi" autoFocus maxLength={60} value={nombreNuevo} aria-label="Nombre del corte" placeholder="Nombre del corte"
                                            onChange={e => setNombreNuevo(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') guardarNombre(c); if (e.key === 'Escape') setRenombrando(null); }} />
                                        <button type="button" className="ct-link" aria-label="Guardar nombre" onClick={() => guardarNombre(c)}><Check size={13} /></button>
                                        <button type="button" className="ct-link" aria-label="Cancelar" onClick={() => setRenombrando(null)}><X size={13} /></button>
                                    </span>
                                ) : (
                                    <span className="ctn-n">{nombreCorte(c, i + 1).toUpperCase().replace(/^CORTE (\d+)$/, 'CORTE #$1')}
                                        <button type="button" className="ct-pen" aria-label="Cambiar el nombre del corte" title="Cambiar el nombre" onClick={() => { setNombreNuevo(c.nombre || nombreCorte(c, i + 1)); setRenombrando(c.id); }}><Pencil size={12} /></button>
                                    </span>
                                )}
                                {renombrando === c.id ? null : <span className={`ctn-chip ${chip[0]}`}>{chip[1]}</span>}
                            </div>
                            <div className="ctn-big">{fmtHoras(vivo.horas)} h</div>
                            <div className="ctn-f">{fmtFecha(c.fechaInicio)} al {fmtFecha(c.fechaFin)}</div>
                            {cambio && <small className="ct-cambio" title="Se registraron o corrigieron trabajos de estas fechas después de hacer el corte.">cambió, antes {fmt(c.total)}</small>}
                            <div className="ctn-filas">
                                <div><span>Facturado Cliente:</span><b className="vd">{fmt(vivo.total)}</b></div>
                                <div><span>Gastos Deducibles ({gas.n}):</span><b className="rj">-{fmt(gas.total)}</b></div>
                                <div className="neta"><span>Utilidad Neta:</span><b className={util < 0 ? 'rj' : 'na'}>{fmt(util)}</b></div>
                                {pago && saldo > 0 && <div><span>Falta por cobrar:</span><b className="na">{fmt(saldo)}</b></div>}
                            </div>
                            <div className="ctn-pie">
                                <span className="ctn-obra">{faena.nombreObra}</span>
                                <span className="ctn-acc">
                                    {onCompartir && <button type="button" className="ctn-ico" aria-label="Compartir este corte" title="Compartir" onClick={() => onCompartir('c:' + c.id)}><Share2 size={14} /></button>}
                                    {i === cortes.length - 1 && <button type="button" className="ctn-ico" aria-label="Deshacer el último corte" title="Deshacer corte" onClick={() => deshacer(c, pago)}><RotateCcw size={14} /></button>}
                                    <button type="button" className="ctn-acta" data-tour="acta-horas" disabled={!!generandoActa} onClick={() => actaHoras('c' + c.id)}><Clock size={14} aria-hidden="true" /> {generandoActa === 'hc' + c.id ? 'Generando…' : 'Acta de horas'}</button>
                                    <button type="button" className="ctn-acta" data-tour="acta" disabled={!!generandoActa} onClick={() => acta('c' + c.id)}><Printer size={14} aria-hidden="true" /> {generandoActa === 'c' + c.id ? 'Generando…' : 'Acta'}</button>
                                </span>
                            </div>
                        </article>
                    );
                })}
                {(enCurso.registros > 0 || gasEnCurso.n > 0) && (
                    <article className="ctn-card curso">
                        <div className="ctn-top">
                            <span className="ctn-n">CORTE #{cortes.length + 1}</span>
                            <span className="ctn-chip amarillo">{faena.estado === 'activa' ? 'ACTIVO / EN CURSO' : 'SIN CORTAR'}</span>
                        </div>
                        <div className="ctn-big">{fmtHoras(enCurso.horas)} h</div>
                        <div className="ctn-f">{fmtFecha(sigue)} al {faena.estado === 'activa' ? 'hoy' : fmtFecha(finPeriodo)}</div>
                        <div className="ctn-filas">
                            <div><span>Facturado Cliente:</span><b className="vd">{fmt(enCurso.total)}</b></div>
                            <div><span>Gastos Deducibles ({gasEnCurso.n}):</span><b className="rj">-{fmt(gasEnCurso.total)}</b></div>
                            <div className="neta"><span>Utilidad Neta:</span><b className={enCurso.total - gasEnCurso.total < 0 ? 'rj' : 'na'}>{fmt(enCurso.total - gasEnCurso.total)}</b></div>
                        </div>
                        <div className="ctn-pie">
                            <span className="ctn-obra">{faena.nombreObra}</span>
                            <span className="ctn-acc">
                                {onCompartir && faena.estado === 'activa' && <button type="button" className="ctn-ico" aria-label="Compartir el corte en curso" title="Compartir" onClick={() => onCompartir('curso:' + faena.id)}><Share2 size={14} /></button>}
                                <button type="button" className="ctn-acta" data-tour="acta-horas" disabled={!!generandoActa} onClick={() => actaHoras('curso')}><Clock size={14} aria-hidden="true" /> {generandoActa === 'hcurso' ? 'Generando…' : 'Acta de horas'}</button>
                                <button type="button" className="ctn-acta" data-tour="acta" disabled={!!generandoActa} onClick={() => acta('curso')}><Printer size={14} aria-hidden="true" /> {generandoActa === 'curso' ? 'Generando…' : 'Acta'}</button>
                                {!abierto && <button type="button" className="ctn-cerrar" onClick={abrir}>Cerrar Corte →</button>}
                            </span>
                        </div>
                    </article>
                )}
            </div>
        </div>
    );
}

export default CortesFaena;
