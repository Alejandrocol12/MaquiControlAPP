import { useState, useEffect } from 'react';
import { Fuel, X, Check, Sparkles, Loader, Paperclip, FileText, AlertTriangle } from 'lucide-react';
import { getCortes } from '../../api';
import MoneyInput from '../../utils/MoneyInput';
import { ErrorCampo } from '../../utils/useErrores';
import { QuienPago } from '../Gastos/QuienPago';
import DestinoGasto, { esDeGastos } from '../Gastos/DestinoGasto';
import './GastoModal.css';

const CATEGORIAS = [
    ['Combustible', 'Combustible ACPM (Diesel)'],
    ['Reparación', 'Reparación'],
    ['Repuestos', 'Repuestos y desgaste'],
    ['Lubricantes', 'Lubricantes y filtros'],
    ['Mantenimiento', 'Mantenimiento'],
    ['Viáticos', 'Viáticos'],
    ['Otros', 'Otros'],
];
const OTRA = '__otra';
const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');

// Modal para registrar o editar un gasto de operación. El gasto se imputa al corte según su fecha
// y el periodo elegido; aquí se avisa a cuál va.
export default function GastoModal({
    editando, form, setForm, errores, cargandoIA, onLeerIA, pagadores, onCrearPagador, onAdministrarPagadores,
    faenas, maquina, faenaActiva, destino, onDestino, onAbrirDestino,
    factura, setFactura, tieneFacturaGuardada, onQuitarFacturaGuardada, onVerFactura, onGuardar, onCerrar,
}) {
    const [cortes, setCortes] = useState([]);
    const [otra, setOtra] = useState(() => !!form.categoria && !CATEGORIAS.some(([v]) => v === form.categoria));
    useEffect(() => {
        if (!faenaActiva) return;
        getCortes().then(r => setCortes((r.data || []).filter(c => String(c.faenaId) === String(faenaActiva.id)))).catch(() => {});
    }, [faenaActiva]);

    const destinoFaena = faenas.find(f => String(f.id) === String(destino));
    let imputa;
    if (destino === 'sin') imputa = 'Este gasto no se imputará a ningún periodo.';
    else if (destinoFaena && esDeGastos(destinoFaena)) imputa = `Se imputará a los gastos externos: ${destinoFaena.nombreObra || 'sin nombre'}.`;
    else if (destinoFaena && faenaActiva && destinoFaena.id !== faenaActiva.id) imputa = `Se imputará al periodo ${destinoFaena.nombreObra || 'sin nombre'}.`;
    else if (faenaActiva) imputa = `Se imputará al Corte en Curso (#${cortes.length + 1}).`;
    else imputa = 'No hay un periodo abierto: el gasto quedará sin periodo.';

    const categoriaSel = otra ? OTRA : (form.categoria || '');
    const cambiarCategoria = (v) => {
        if (v === OTRA) { setOtra(true); setForm({ ...form, categoria: '' }); }
        else { setOtra(false); setForm({ ...form, categoria: v }); }
    };
    const monto = parseFloat(form.monto) || 0;

    return (
        <div className="gm-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="gm-modal" role="dialog" aria-modal="true" aria-labelledby="gm-titulo">
                <header className="gm-cab">
                    <span className="gm-ico" aria-hidden="true"><Fuel size={20} /></span>
                    <div>
                        <h3 id="gm-titulo">{editando ? 'Editar Gasto de Operación' : 'Registrar Gasto de Operación'}</h3>
                        <p>{imputa}</p>
                    </div>
                    <button type="button" className="gm-x" aria-label="Cerrar" onClick={onCerrar}><X size={18} /></button>
                </header>

                <div className="gm-cuerpo">
                    <label className={`gm-ia ${cargandoIA ? 'cargando' : ''}`}>
                        <span aria-hidden="true">{cargandoIA ? <Loader size={16} className="gm-giro" /> : <Sparkles size={16} />}</span>
                        <span><b>{cargandoIA ? 'Leyendo con IA…' : 'Leer factura con IA'}</b>
                            <small>Sube la foto o el PDF y el formulario se llena solo.</small></span>
                        <input type="file" accept="image/*,application/pdf" onChange={onLeerIA} disabled={cargandoIA} />
                    </label>

                    <div className="gm-campo">
                        <label htmlFor="gm-cat">Categoría del gasto</label>
                        <select id="gm-cat" className="gm-in" value={categoriaSel} onChange={e => cambiarCategoria(e.target.value)}>
                            {!otra && !form.categoria && <option value="">Elige una categoría</option>}
                            {CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            <option value={OTRA}>Otra categoría…</option>
                        </select>
                        {otra && <input className="gm-in" aria-label="Nombre de la categoría" maxLength={60} placeholder="Escribe la categoría"
                            value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />}
                    </div>

                    <div className="gm-campo">
                        <label htmlFor="gm-monto">Monto total ($ COP) *</label>
                        <MoneyInput className={`gm-in gm-monto ${errores.errores.gsMonto ? 'err' : ''}`} name="gsMonto" value={form.monto}
                            onChange={e => { setForm({ ...form, monto: e.target.value }); errores.limpiar('gsMonto'); }} placeholder="Ej: 250.000" />
                        {monto > 0 && <small className="gm-hint">Valor formateado: {fmt(monto)}</small>}
                        <ErrorCampo msg={errores.errores.gsMonto} />
                    </div>

                    <div className="gm-campo">
                        <label htmlFor="gm-desc">Descripción del concepto *</label>
                        <input id="gm-desc" className={`gm-in ${errores.errores.gsDesc ? 'err' : ''}`} value={form.descripcion} placeholder="Ej: Suministro de 90 galones de ACPM o cambio de filtro primario"
                            onChange={e => { setForm({ ...form, descripcion: e.target.value }); errores.limpiar('gsDesc'); }} />
                        <ErrorCampo msg={errores.errores.gsDesc} />
                    </div>

                    <div className="gm-fila">
                        <div className="gm-campo">
                            <label htmlFor="gm-prov">Proveedor</label>
                            <input id="gm-prov" className="gm-in" maxLength={120} value={form.proveedor || ''} placeholder="Ej: Distribuidora Petróleo del Valle"
                                onChange={e => setForm({ ...form, proveedor: e.target.value })} />
                        </div>
                        <div className="gm-campo">
                            <label htmlFor="gm-fac">Factura o remisión #</label>
                            <input id="gm-fac" className="gm-in" maxLength={60} value={form.numeroFactura || ''} placeholder="Ej: FAC-9120"
                                onChange={e => setForm({ ...form, numeroFactura: e.target.value })} />
                        </div>
                    </div>

                    <div className="gm-fila">
                        <div className="gm-campo">
                            <label htmlFor="gm-fecha">Fecha</label>
                            <input id="gm-fecha" className="gm-in" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                        </div>
                        <div className="gm-campo">
                            <QuienPago id="gm-quien" value={form.pagadoPor || ''} onChange={v => setForm({ ...form, pagadoPor: v })} pagadores={pagadores}
                                onCrear={onCrearPagador} onAdministrar={onAdministrarPagadores} selectClass="gm-in" inputClass="gm-in" labelClass="gm-lab" />
                        </div>
                    </div>

                    <div className="gm-campo">
                        <DestinoGasto id="gm-destino" faenas={faenas} maquina={maquina} value={destino} onChange={onDestino} onAbrir={onAbrirDestino}
                            selectClass="gm-in" inputClass="gm-in" labelClass="gm-lab" />
                    </div>

                    <div className="gm-campo">
                        <span className="gm-lab">Factura en PDF (opcional)</span>
                        {tieneFacturaGuardada && !factura ? (
                            <div className="gm-adjunto">
                                <FileText size={15} aria-hidden="true" /><span>Factura adjunta</span>
                                <button type="button" onClick={onVerFactura}>Ver</button>
                                <label>Cambiar<input type="file" accept="application/pdf" onChange={e => setFactura(e.target.files[0] || null)} /></label>
                                <button type="button" className="rj" onClick={onQuitarFacturaGuardada}>Quitar</button>
                            </div>
                        ) : (
                            <label className="gm-adjunto vacio">
                                <Paperclip size={15} aria-hidden="true" />
                                <span>{factura ? factura.name : 'Adjuntar factura'}</span>
                                {factura && <button type="button" className="rj" onClick={e => { e.preventDefault(); setFactura(null); }}>Quitar</button>}
                                <input type="file" accept="application/pdf" onChange={e => setFactura(e.target.files[0] || null)} />
                            </label>
                        )}
                    </div>

                    {!faenaActiva && !destinoFaena && destino !== 'sin' && (
                        <p className="gm-aviso"><AlertTriangle size={14} aria-hidden="true" /> No hay un periodo de trabajo abierto.</p>
                    )}
                </div>

                <footer className="gm-pie">
                    <button type="button" className="gm-cancelar" onClick={onCerrar}>Cancelar</button>
                    <button type="button" className="gm-guardar" onClick={onGuardar}>
                        <Check size={16} aria-hidden="true" /> {editando ? 'Guardar cambios' : 'Registrar gasto'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
