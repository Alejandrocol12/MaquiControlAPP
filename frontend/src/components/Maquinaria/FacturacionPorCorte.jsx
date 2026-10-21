import { useState, useEffect, useCallback } from 'react';
import { Scissors, X, Printer, Loader, AlertTriangle, ChevronRight, Pencil, Trash2, Check } from 'lucide-react';
import { getCortes, getPagos, createCorte, renombrarCorte } from '../../api';
import { fmtHoro } from '../../utils/horometro';
import { useToast } from '../../utils/toast';
import { fmtFecha } from '../../utils/fmtFecha';
import {
    hoyISO, diaSiguiente, ordenarCortes, nombreCorte, resumenTramo, enRango, fmtHoras, resumenGastosTramo, leerContarOperador,
} from '../../utils/cortes';
import './FacturacionPorCorte.css';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const dia10 = (f) => String(f || '').slice(0, 10);
const pct = (n) => (Math.round(n * 10) / 10).toLocaleString('es-CO') + '%';
const diasEntre = (a, b) => Math.max(1, Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000) + 1);

// Pestaña Ingresos del periodo: lo facturado, el desglose por corte y la liquidación del corte en curso
export default function FacturacionPorCorte({ maq, faena, ingresos, gastos, onCambio, onEditar, onEliminar }) {
    const toast = useToast();
    const [cortes, setCortes] = useState([]);
    const [pagos, setPagos] = useState([]);
    const [liquidando, setLiquidando] = useState(false);
    const [abiertos, setAbiertos] = useState({});
    const [renombrando, setRenombrando] = useState(null);
    const [nombreNuevo, setNombreNuevo] = useState('');
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
    const diasTrab = new Set(ingresos.filter(i => i.tipoTrabajo === 'Horas' && Number(i.cantidad) > 0).map(i => dia10(i.fecha))).size;
    const tarifa = Number(maq.valorHoraMaquina) || 0;
    const cliente = faena.cliente || faena.nombreObra || '—';

    const ultimo = cortes[cortes.length - 1];
    const desde = ultimo ? diaSiguiente(ultimo.fechaFin) : dia10(faena.fechaInicio);
    const hasta = hoyISO();
    const itemsCurso = ingresos.filter(i => !cortes.some(c => enRango(i.fecha, c.fechaInicio, c.fechaFin)));
    const curso = resumenTramo(itemsCurso, desde, null);
    const gasCurso = resumenGastosTramo(gastos, desde, null, contarOp);
    const numCurso = cortes.length + 1;

    const filas = cortes.map((c, i) => {
        const t = resumenTramo(ingresos, c.fechaInicio, c.fechaFin);
        const g = resumenGastosTramo(gastos, c.fechaInicio, c.fechaFin, contarOp);
        const pago = c.pagoClienteId ? pagos.find(p => String(p.id) === String(c.pagoClienteId)) : null;
        const estado = !pago ? ['gris', 'SIN COBRO'] : pago.estado === 'Pagado' ? ['verde', 'COBRADO 100%'] : ['azul', 'FACTURADO / SALDO PENDIENTE'];
        return { c, nombre: nombreCorte(c, i + 1), t, util: t.total - g.total, estado };
    });

    const resumenItems = (items) => ({
        items: [...items].sort((a, b) => dia10(b.fecha).localeCompare(dia10(a.fecha))),
        horas: items.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0),
        dias: new Set(items.filter(i => i.tipoTrabajo === 'Horas' && Number(i.cantidad) > 0).map(i => dia10(i.fecha))).size,
    });
    const grupos = [
        ...filas.map(f => ({
            key: `c${f.c.id}`, corte: f.c, nombre: f.nombre, estado: f.estado, total: f.t.total, util: f.util,
            fechas: `${fmtFecha(f.c.fechaInicio)} al ${fmtFecha(f.c.fechaFin)}`,
            ...resumenItems(ingresos.filter(i => enRango(i.fecha, f.c.fechaInicio, f.c.fechaFin))),
        })),
        {
            key: 'curso', curso: true, nombre: nombreCorte(null, numCurso), estado: ['amarillo', 'EN CURSO (ACTIVO)'],
            total: curso.total, util: curso.total - gasCurso.total, fechas: `${fmtFecha(desde)} al ${fmtFecha(hasta)}`,
            ...resumenItems(itemsCurso),
        },
    ];
    const alternar = (key) => setAbiertos(a => ({ ...a, [key]: !a[key] }));
    const guardarNombre = async (c) => {
        try {
            await renombrarCorte(c.id, nombreNuevo.trim());
            setRenombrando(null);
            toast(nombreNuevo.trim() ? 'Nombre del corte guardado' : 'Se quitó el nombre del corte');
            cargar();
        } catch { toast('No se pudo cambiar el nombre. Intenta de nuevo.', 'e'); }
    };

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
                    <div><span>Días trabajados</span><b>{diasTrab}</b></div>
                    <div><span>Promedio por día</span><b>{diasTrab ? fmtHoras(horasTot / diasTrab) : '—'} h</b></div>
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
                    {grupos.map(g => {
                        const ab = !!abiertos[g.key];
                        const edita = g.corte && renombrando === g.corte.id;
                        return (
                            <div key={g.key} className={`fc-grupo ${g.curso ? 'curso' : ''} ${ab ? 'open' : ''}`}>
                                <div className="fc-fila" role="button" tabIndex={0} aria-expanded={ab}
                                    onClick={() => { if (!edita) alternar(g.key); }}
                                    onKeyDown={e => { if (!edita && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); alternar(g.key); } }}>
                                    <div className="fc-nombre">
                                        <ChevronRight size={16} className="fc-chev" aria-hidden="true" />
                                        <div>
                                            {edita ? (
                                                <span className="fc-ren" onClick={e => e.stopPropagation()}>
                                                    <input autoFocus maxLength={60} value={nombreNuevo} aria-label="Nombre del corte" onChange={e => setNombreNuevo(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') guardarNombre(g.corte); if (e.key === 'Escape') setRenombrando(null); }} />
                                                    <button type="button" aria-label="Guardar nombre" onClick={() => guardarNombre(g.corte)}><Check size={14} /></button>
                                                    <button type="button" aria-label="Cancelar" onClick={() => setRenombrando(null)}><X size={14} /></button>
                                                </span>
                                            ) : (
                                                <>
                                                    <b>{g.nombre}</b>
                                                    {g.corte && <button type="button" className="fc-lapiz" aria-label={`Cambiar el nombre de ${g.nombre}`} onClick={e => { e.stopPropagation(); setNombreNuevo(g.corte.nombre || g.nombre); setRenombrando(g.corte.id); }}><Pencil size={12} /></button>}
                                                    <span className={`fc-chip ${g.estado[0]}`}>{g.estado[1]}</span>
                                                </>
                                            )}
                                            <small>{g.fechas}{faena.cliente ? ` · ${faena.cliente}` : ''}</small>
                                        </div>
                                    </div>
                                    <Dato etq="Horas" v={`${fmtHoras(g.horas)} h`} sub={`${g.dias} día${g.dias === 1 ? '' : 's'}${g.dias > 0 && g.horas > 0 ? ` · ${fmtHoras(g.horas / g.dias)} h/día` : ''}`} />
                                    <Dato etq="Valor facturado" v={fmt(g.total)} cls="vd" />
                                    <Dato etq="Utilidad neta" v={fmt(g.util)} cls={g.util < 0 ? 'rj' : 'na'} />
                                </div>
                                {ab && <TablaIngresos items={g.items} horas={g.horas} total={g.total} onEditar={onEditar} onEliminar={onEliminar} />}
                            </div>
                        );
                    })}
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

function Dato({ etq, v, cls = '', sub }) {
    return <div className="fc-dato"><span>{etq}</span><b className={cls}>{v}</b>{sub && <small>{sub}</small>}</div>;
}

const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const diaSemana = (f) => { const [y, m, d] = dia10(f).split('-').map(Number); return DSEM[new Date(y, m - 1, d).getDay()] || ''; };

// Los ingresos de un corte, con editar y eliminar
function TablaIngresos({ items, horas, total, onEditar, onEliminar }) {
    if (!items.length) return <p className="fc-vacio fc-sinreg">Este corte no tiene ingresos todavía.</p>;
    return (
        <div className="fc-tabla">
            <div className="fc-tr fc-th"><span>Fecha</span><span>Descripción</span><span>Horas</span><span>Horómetro</span><span className="r">Total</span><span /></div>
            {items.map(i => {
                const esHoras = i.tipoTrabajo === 'Horas';
                return (
                    <div className="fc-tr" key={i.id}>
                        <span data-l="Fecha"><b>{fmtFecha(i.fecha)}</b> <small>{diaSemana(i.fecha)}</small></span>
                        <span data-l="Descripción">{i.descripcion}{!esHoras && <small> · {i.tipoTrabajo}</small>}</span>
                        <span data-l="Horas">{esHoras ? `${fmtHoras(i.cantidad)} h` : `${i.cantidad} ${i.tipoTrabajo}`}</span>
                        <span data-l="Horómetro" className="fc-horo">{esHoras && i.horometroInicio != null ? `${fmtHoro(i.horometroInicio)} → ${fmtHoro(i.horometroFin)}` : ''}</span>
                        <span data-l="Total" className="r vd">{fmt(i.total)}</span>
                        <span className="fc-acc">
                            {onEditar && <button type="button" aria-label="Editar ingreso" onClick={() => onEditar(i)}><Pencil size={14} /></button>}
                            {onEliminar && <button type="button" aria-label="Eliminar ingreso" onClick={() => onEliminar(i)}><Trash2 size={14} /></button>}
                        </span>
                    </div>
                );
            })}
            <div className="fc-tr fc-sub"><span><b>Subtotal</b></span><span /><span><b>{fmtHoras(horas)} h</b></span><span /><span className="r"><b>{fmt(total)}</b></span><span /></div>
        </div>
    );
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
