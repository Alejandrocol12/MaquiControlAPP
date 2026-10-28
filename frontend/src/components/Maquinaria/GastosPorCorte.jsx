import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronRight, Pencil, Check, X } from 'lucide-react';
import { getCortes, renombrarCorte } from '../../api';
import { useToast } from '../../utils/toast';
import { fmtFecha } from '../../utils/fmtFecha';
import { diaSiguiente, ordenarCortes, nombreCorte, enRango, hoyISO } from '../../utils/cortes';
import Monto from '../../utils/Monto';
import Deslizable from '../../utils/Deslizable';
import './FacturacionPorCorte.css';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const dia10 = (f) => String(f || '').slice(0, 10);
const pct = (n) => (Math.round(n * 10) / 10).toLocaleString('es-CO') + '%';
const monto = (g) => Number(g.monto) || 0;
const suma = (items) => items.reduce((a, g) => a + monto(g), 0);
const claseCat = { 'Reparación': 'info', 'Repuestos': 'gold', 'Combustible': 'orange', 'Mantenimiento': 'golddeep', 'Lubricantes': 'purple' };

// Pestaña Gastos del periodo: cabecera con lo gastado, y el desglose por corte (cada corte se despliega con
// sus gastos). Es el mismo diseño que el de Ingresos. Las acciones de cada fila vienen de quien lo usa.
export default function GastosPorCorte({ faena, gastos, ingresos, externos, sueltos, onRegistrar, renderAcciones, swipe }) {
    const toast = useToast();
    const [cortes, setCortes] = useState([]);
    const [abiertos, setAbiertos] = useState({});
    const [renombrando, setRenombrando] = useState(null);
    const [nombreNuevo, setNombreNuevo] = useState('');

    const cargar = useCallback(() => {
        getCortes().then(r => setCortes(ordenarCortes((r.data || []).filter(c => String(c.faenaId) === String(faena.id))))).catch(() => {});
    }, [faena.id]);
    useEffect(() => { cargar(); }, [cargar, gastos.length]);

    const totalGas = suma(gastos);
    const totalIng = ingresos.reduce((a, i) => a + (Number(i.total) || 0), 0);
    const cats = {};
    gastos.forEach(g => { const k = g.categoria || 'Sin categoría'; cats[k] = (cats[k] || 0) + monto(g); });
    const catTop = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];

    const ultimo = cortes[cortes.length - 1];
    const desde = ultimo ? diaSiguiente(ultimo.fechaFin) : dia10(faena.fechaInicio);
    const itemsCurso = gastos.filter(g => !cortes.some(c => enRango(g.fecha, c.fechaInicio, c.fechaFin)));
    const ordenar = (items) => [...items].sort((a, b) => dia10(b.fecha).localeCompare(dia10(a.fecha)));

    const grupos = [
        ...cortes.map((c, i) => {
            const items = gastos.filter(g => enRango(g.fecha, c.fechaInicio, c.fechaFin));
            const ing = ingresos.filter(x => enRango(x.fecha, c.fechaInicio, c.fechaFin)).reduce((a, x) => a + (Number(x.total) || 0), 0);
            return { key: `c${c.id}`, corte: c, nombre: nombreCorte(c, i + 1), estado: ['gris', 'CERRADO'], fechas: `${fmtFecha(c.fechaInicio)} al ${fmtFecha(c.fechaFin)}`, items: ordenar(items), total: suma(items), ing };
        }),
        {
            key: 'curso', curso: true, nombre: nombreCorte(null, cortes.length + 1), estado: ['amarillo', 'EN CURSO (ACTIVO)'], fechas: `${fmtFecha(desde)} al ${fmtFecha(hoyISO())}`,
            items: ordenar(itemsCurso), total: suma(itemsCurso),
            ing: ingresos.filter(x => !cortes.some(c => enRango(x.fecha, c.fechaInicio, c.fechaFin))).reduce((a, x) => a + (Number(x.total) || 0), 0),
        },
    ];
    if (externos && externos.items.length) {
        grupos.push({ key: 'externo', nombre: `Gastos externos · ${externos.nombre}`, estado: ['azul', 'EXTERNO'], fechas: 'Fuera del trabajo en campo', items: ordenar(externos.items), total: suma(externos.items), ing: null });
    }
    if (sueltos && sueltos.length) {
        grupos.push({ key: 'sin', nombre: 'Sin periodo asignado', estado: ['gris', 'SIN PERIODO'], fechas: '', items: ordenar(sueltos), total: suma(sueltos), ing: null });
    }

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
            <section className="fc-hero gas">
                <div className="fc-hero-main">
                    <span className="fc-eyebrow">Control de gastos de operación</span>
                    <b className="fc-hero-total">{fmt(totalGas)}</b>
                    <span className="fc-hero-sub">Acumulado total de gastos en el proyecto <b>{faena.nombreObra}</b></span>
                </div>
                <div className="fc-hero-datos">
                    <div><span>Gastos registrados</span><b className="am">{gastos.length}</b></div>
                    <div className="solo-pc"><span>Gasto promedio</span><b>{gastos.length ? fmt(totalGas / gastos.length) : '—'}</b></div>
                    <div><span>% de los ingresos</span><b className="rj">{totalIng > 0 ? pct((totalGas / totalIng) * 100) : '—'}</b></div>
                    <div className="solo-pc"><span>Categoría principal</span><b>{catTop ? `${catTop[0]} · ${fmt(catTop[1])}` : '—'}</b></div>
                </div>
            </section>

            <section className="fc-desglose">
                <header>
                    <div>
                        <h3>Desglose de Gastos por Corte</h3>
                        <p>Gastos de cada corte y del corte activo</p>
                    </div>
                    <button type="button" className="fc-btn-liq gas" onClick={onRegistrar}><Plus size={16} aria-hidden="true" /> Registrar gasto</button>
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
                                            {g.fechas && <small>{g.fechas}</small>}
                                        </div>
                                    </div>
                                    <div className="fc-dato"><span>Gastos</span><b>{g.items.length}</b></div>
                                    <div className="fc-dato"><span>Total gastado</span><b className="rj"><Monto v={g.total} /></b></div>
                                    <div className="fc-dato"><span>% de los ingresos</span><b>{g.ing > 0 ? pct((g.total / g.ing) * 100) : '—'}</b></div>
                                </div>
                                {ab && (g.items.length === 0
                                    ? <p className="fc-vacio fc-sinreg">Este corte no tiene gastos.</p>
                                    : (
                                        <div className="fc-tabla">
                                            <div className="fc-tr gas fc-th"><span>Fecha</span><span>Descripción</span><span>Pagó</span><span>Categoría</span><span className="r">Total</span><span /></div>
                                            {g.items.map(x => (
                                                <Deslizable className="fc-tr gas" key={x.id} acciones={swipe ? swipe(x) || [] : []}>
                                                    <span data-l="Fecha"><b>{fmtFecha(x.fecha)}</b></span>
                                                    <span data-l="Descripción">{x.descripcion}
                                                        {(x.proveedor || x.numeroFactura) && <small> · {[x.proveedor, x.numeroFactura].filter(Boolean).join(' · ')}</small>}</span>
                                                    <span data-l="Pagó">{x.pagadoPor || '—'}</span>
                                                    <span data-l="Categoría"><span className={`mq-catpill mq-cat-${claseCat[x.categoria] || 'neutral'}`}><i></i>{x.categoria}</span></span>
                                                    <span data-l="Total" className="r rj">{fmt(x.monto)}</span>
                                                    <span className="fc-acc">{renderAcciones(x)}</span>
                                                </Deslizable>
                                            ))}
                                            <div className="fc-tr gas fc-sub"><span><b>Subtotal</b></span><span /><span /><span /><span className="r"><b>{fmt(g.total)}</b></span><span /></div>
                                        </div>
                                    ))}
                            </div>
                        );
                    })}
                </div>

                <footer><span>Total gastos acumulados del periodo:</span><b>{fmt(totalGas)}</b></footer>
            </section>
        </>
    );
}
