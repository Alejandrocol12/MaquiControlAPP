import { useState, useEffect, useCallback } from 'react';
import { Scissors, X, Printer, Loader, AlertTriangle } from 'lucide-react';
import { getCortes, getPagos, createCorte } from '../../api';
import { useToast } from '../../utils/toast';
import { fmtFecha } from '../../utils/fmtFecha';
import {
    hoyISO, diaSiguiente, ordenarCortes, nombreCorte, resumenTramo, fmtHoras, resumenGastosTramo, leerContarOperador,
} from '../../utils/cortes';
import './FacturacionPorCorte.css';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const dia10 = (f) => String(f || '').slice(0, 10);
const pct = (n) => (Math.round(n * 10) / 10).toLocaleString('es-CO') + '%';
const diasEntre = (a, b) => Math.max(1, Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000) + 1);

// Pestaña Ingresos del periodo: lo facturado, el desglose por corte y la liquidación del corte en curso
export default function FacturacionPorCorte({ maq, faena, ingresos, gastos, onCambio }) {
    const [cortes, setCortes] = useState([]);
    const [pagos, setPagos] = useState([]);
    const [liquidando, setLiquidando] = useState(false);
    const contarOp = leerContarOperador();

    const cargar = useCallback(() => {
        Promise.all([getCortes(), getPagos()]).then(([c, p]) => {
            setCortes(ordenarCortes((c.data || []).filter(x => String(x.faenaId) === String(faena.id))));
            setPagos(p.data || []);
        }).catch(() => {});
    }, [faena.id]);
    useEffect(() => { cargar(); }, [cargar, ingresos.length]);

    const horasTot = ingresos.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
    const totalTot = ingresos.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const tarifa = Number(maq.valorHoraMaquina) || 0;
    const cliente = faena.cliente || faena.nombreObra || '—';

    const ultimo = cortes[cortes.length - 1];
    const desde = ultimo ? diaSiguiente(ultimo.fechaFin) : dia10(faena.fechaInicio);
    const hasta = hoyISO();
    const curso = resumenTramo(ingresos, desde, null);
    const gasCurso = resumenGastosTramo(gastos, desde, null, contarOp);
    const numCurso = cortes.length + 1;

    const filas = cortes.map((c, i) => {
        const t = resumenTramo(ingresos, c.fechaInicio, c.fechaFin);
        const g = resumenGastosTramo(gastos, c.fechaInicio, c.fechaFin, contarOp);
        const pago = c.pagoClienteId ? pagos.find(p => String(p.id) === String(c.pagoClienteId)) : null;
        const estado = !pago ? ['gris', 'SIN COBRO'] : pago.estado === 'Pagado' ? ['verde', 'COBRADO 100%'] : ['azul', 'FACTURADO / SALDO PENDIENTE'];
        return { c, nombre: nombreCorte(c, i + 1), t, util: t.total - g.total, estado };
    });

    return (
        <>
            <section className="fc-hero">
                <div className="fc-hero-main">
                    <span className="fc-eyebrow">Liquidación y facturación de maquinaria</span>
                    <b className="fc-hero-total">{fmt(totalTot)}</b>
                    <span className="fc-hero-sub">Acumulado total de ingresos en el proyecto <b>{faena.nombreObra}</b></span>
                </div>
                <div className="fc-hero-datos">
                    <div><span>Horas facturables</span><b className="am">{fmtHoras(horasTot)} h</b></div>
                    <div><span>Tarifa pactada</span><b className="vd">{fmt(tarifa)}/h</b></div>
                    <div><span>Cliente principal</span><b>{cliente}</b></div>
                </div>
            </section>

            <section className="fc-desglose">
                <header>
                    <div>
                        <h3>Desglose de Facturación por Corte</h3>
                        <p>Cortes hechos y corte activo</p>
                    </div>
                    <button type="button" className="fc-btn-liq" onClick={() => setLiquidando(true)}>Liquidación Corte en Curso</button>
                </header>

                <div className="fc-lista">
                    {filas.map(f => (
                        <div className="fc-fila" key={f.c.id}>
                            <div className="fc-nombre">
                                <b>{f.nombre}</b><span className={`fc-chip ${f.estado[0]}`}>{f.estado[1]}</span>
                                <small>{fmtFecha(f.c.fechaInicio)} al {fmtFecha(f.c.fechaFin)}{faena.cliente ? ` · ${faena.cliente}` : ''}</small>
                            </div>
                            <Dato etq="Horas" v={`${fmtHoras(f.t.horas)} h`} />
                            <Dato etq="Valor facturado" v={fmt(f.t.total)} cls="vd" />
                            <Dato etq="Utilidad neta" v={fmt(f.util)} cls={f.util < 0 ? 'rj' : 'na'} />
                        </div>
                    ))}
                    <div className="fc-fila curso">
                        <div className="fc-nombre">
                            <b>{nombreCorte(null, numCurso)}</b><span className="fc-chip amarillo">EN CURSO (ACTIVO)</span>
                            <small>{fmtFecha(desde)} al {fmtFecha(hasta)}{faena.cliente ? ` · ${faena.cliente}` : ''}</small>
                        </div>
                        <Dato etq="Horas" v={`${fmtHoras(curso.horas)} h`} />
                        <Dato etq="Valor facturado" v={fmt(curso.total)} cls="vd" />
                        <Dato etq="Utilidad neta" v={fmt(curso.total - gasCurso.total)} cls={curso.total - gasCurso.total < 0 ? 'rj' : 'na'} />
                    </div>
                </div>

                <footer><span>Total facturación acumulada del periodo:</span><b>{fmt(totalTot)}</b></footer>
            </section>

            {liquidando && (
                <LiquidacionModal maq={maq} faena={faena} numero={numCurso} desde={desde} hasta={hasta} curso={curso} gasCurso={gasCurso}
                    tarifa={tarifa} cliente={cliente} contarOp={contarOp}
                    onCerrar={() => setLiquidando(false)}
                    onHecho={() => { setLiquidando(false); cargar(); onCambio && onCambio(); }} />
            )}
        </>
    );
}

function Dato({ etq, v, cls = '' }) {
    return <div className="fc-dato"><span>{etq}</span><b className={cls}>{v}</b></div>;
}

function LiquidacionModal({ maq, faena, numero, desde, hasta, curso, gasCurso, tarifa, cliente, contarOp, onCerrar, onHecho }) {
    const toast = useToast();
    const [obs, setObs] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const util = curso.total - gasCurso.total;
    const margen = curso.total > 0 ? (util / curso.total) * 100 : 0;
    const dias = desde <= hasta ? diasEntre(desde, hasta) : 0;
    const sinTrabajos = curso.registros === 0;

    const cerrar = async () => {
        setError('');
        if (sinTrabajos) return setError('No hay trabajos registrados en este corte.');
        setGuardando(true);
        try {
            await createCorte({ faenaId: faena.id, fechaInicio: desde, fechaFin: hasta, crearCobro: true, conOperador: contarOp, observaciones: obs.trim() });
            toast(`Corte ${numero} hecho: ${fmtHoras(curso.horas)} h, ${fmt(curso.total)} a cobrar`);
            onHecho();
        } catch (e) {
            setError(e.response?.data?.error || 'No se pudo cerrar el corte. Intenta de nuevo.');
            setGuardando(false);
        }
    };

    const imprimir = () => {
        const w = window.open('', '_blank');
        if (!w) return setError('El navegador bloqueó la ventana de impresión.');
        const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const filas = gasCurso.lista.map(g => `<tr><td>${esc(g.descripcion)}</td><td>${esc(g.categoria)}</td><td>${esc(fmtFecha(g.fecha))}</td><td style="text-align:right">-${fmt(g.monto)}</td></tr>`).join('');
        w.document.write(`<html><head><title>Liquidación corte ${numero}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border-bottom:1px solid #ddd;padding:6px;font-size:13px;text-align:left}h1{font-size:20px;margin:0}</style></head><body>
<h1>Liquidación de corte ${numero} · ${esc(maq.nombre)}</h1><p>${esc(faena.nombreObra)} · Cliente: ${esc(cliente)}<br>Periodo: ${esc(fmtFecha(desde))} a ${esc(fmtFecha(hasta))} (${dias} días)</p>
<p><b>Horas a liquidar:</b> ${fmtHoras(curso.horas)} h @ ${fmt(tarifa)}/h<br><b>Por cobrar (cliente):</b> ${fmt(curso.total)}<br><b>Gastos del corte:</b> ${fmt(gasCurso.total)}<br><b>Utilidad neta:</b> ${fmt(util)} (${pct(margen)} margen)</p>
<h3>Gastos deducibles (${gasCurso.n})</h3><table><tr><th>Descripción</th><th>Categoría</th><th>Fecha</th><th style="text-align:right">Monto</th></tr>${filas}</table>
${obs.trim() ? `<p><b>Observaciones:</b> ${esc(obs)}</p>` : ''}</body></html>`);
        w.document.close(); w.focus(); w.print();
    };

    return (
        <div className="fc-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="fc-modal" role="dialog" aria-modal="true" aria-labelledby="fc-titulo">
                <header className="fc-m-cab">
                    <span className="fc-m-ico" aria-hidden="true"><Scissors size={20} /></span>
                    <div>
                        <h3 id="fc-titulo">Liquidación y Cierre de Corte #{numero} <span className="fc-chip amarillo">EN CURSO</span></h3>
                        <p>Periodo: <b>{fmtFecha(desde)}</b> → <b>{fmtFecha(hasta)}</b> ({dias} días)</p>
                    </div>
                    <button type="button" className="fc-m-x" aria-label="Cerrar" onClick={onCerrar}><X size={18} /></button>
                </header>

                <div className="fc-m-cuerpo">
                    <div className="fc-m-resumen">
                        <div><span>Horas a liquidar</span><b>{fmtHoras(curso.horas)} h</b><small>@ {fmt(tarifa)}/h</small></div>
                        <div><span>Por cobrar (cliente)</span><b className="vd">{fmt(curso.total)}</b><small>Factura de venta</small></div>
                        <div><span>Utilidad neta corte</span><b className={util < 0 ? 'rj' : 'na'}>{fmt(util)}</b><small className={util < 0 ? 'rj' : 'vd'}>{pct(margen)} margen</small></div>
                    </div>

                    <h4>Gastos deducibles de este corte <span className="fc-chip rojo">{gasCurso.n} registro{gasCurso.n === 1 ? '' : 's'} · {fmt(gasCurso.total)}</span></h4>
                    {gasCurso.n === 0 ? <p className="fc-vacio">Este corte no tiene gastos.</p> : (
                        <ul className="fc-gastos">
                            {gasCurso.lista.map(g => (
                                <li key={g.id}>
                                    <div>
                                        <b>{g.descripcion}{g.numeroFactura ? <code>({g.numeroFactura})</code> : null}</b>
                                        <small>{[g.categoria, fmtFecha(g.fecha), g.proveedor].filter(Boolean).join(' · ')}</small>
                                    </div>
                                    <span>-{fmt(g.monto)}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <label className="fc-campo"><span>Observaciones de cuenta de cobro / remisión</span>
                        <input value={obs} maxLength={150} placeholder="Ej: Liquidación quincenal de horas frente San José" onChange={e => setObs(e.target.value)} /></label>

                    <p className="fc-nota">Al cerrar se crea el corte y su cobro en Pagos Clientes por {fmt(curso.total)}. {contarOp ? 'El pago al operador cuenta como gasto del corte.' : 'El pago al operador no cuenta como gasto del corte.'}</p>
                    {error && <p className="fc-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</p>}
                </div>

                <footer className="fc-m-pie">
                    <button type="button" className="fc-imprimir" onClick={imprimir}><Printer size={15} aria-hidden="true" /> Imprimir Liquidación</button>
                    <button type="button" className="fc-cancelar" onClick={onCerrar}>Cerrar</button>
                    <button type="button" className="fc-cerrar" disabled={guardando || sinTrabajos} onClick={cerrar}>
                        {guardando ? <Loader size={16} className="fc-giro" aria-hidden="true" /> : <Scissors size={16} aria-hidden="true" />} Cerrar y Facturar Corte #{numero}
                    </button>
                </footer>
            </div>
        </div>
    );
}
