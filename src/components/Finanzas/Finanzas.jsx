import { useState, useEffect } from 'react';
import {
    getMaquinas,
    getIngresos, createIngreso, updateIngreso, deleteIngreso,
    getGastos, createGasto, updateGasto, deleteGasto,
    getSalarios, createSalario, updateSalario, deleteSalario,
    getPagos, createPago, updatePago, deletePago,
} from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';

const fmt = (v) => '$' + (v || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().split('T')[0];

const FORM_ING  = { descripcion: '', tipoTrabajo: 'Horas', cantidad: 0, valorUnitario: 0, fecha: hoy(), maquinaNombre: '' };
const FORM_GAS  = { descripcion: '', categoria: '', monto: 0, fecha: hoy(), maquinaNombre: '' };
const FORM_SAL  = { operadorNombre: '', maquinaNombre: '', horasTrabajadas: 0, valorHora: 0, anticipos: 0, estado: 'Pendiente', fecha: hoy() };
const FORM_PAG  = { cliente: '', maquinaNombre: '', descripcion: '', valorTotal: 0, valorPagado: 0, fecha: hoy() };

function Finanzas({ tabInicial = 'ingresos' }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [tab, setTab]           = useState(tabInicial);
    const [maquinas, setMaquinas] = useState([]);
    const [ingresos, setIngresos] = useState([]);
    const [gastos, setGastos]     = useState([]);
    const [salarios, setSalarios] = useState([]);
    const [pagos, setPagos]       = useState([]);

    const [mostrarForm, setMostrarForm] = useState(false);
    const [editandoId, setEditandoId]   = useState(null);

    const [formIng, setFormIng] = useState(FORM_ING);
    const [formGas, setFormGas] = useState(FORM_GAS);
    const [formSal, setFormSal] = useState(FORM_SAL);
    const [formPag, setFormPag] = useState(FORM_PAG);

    useEffect(() => { cargarTodo(); }, []);
    useEffect(() => { setTab(tabInicial); }, [tabInicial]);

    const cargarTodo = () => {
        getMaquinas().then(r => setMaquinas(r.data)).catch(console.error);
        getIngresos().then(r => setIngresos(r.data)).catch(console.error);
        getGastos().then(r => setGastos(r.data)).catch(console.error);
        getSalarios().then(r => setSalarios(r.data)).catch(console.error);
        getPagos().then(r => setPagos(r.data)).catch(console.error);
    };

    const abrirNuevo = () => {
        setEditandoId(null);
        setFormIng(FORM_ING); setFormGas(FORM_GAS); setFormSal(FORM_SAL); setFormPag(FORM_PAG);
        setMostrarForm(true);
    };

    const abrirEditar = (item) => {
        setEditandoId(item.id);
        if (tab === 'ingresos') setFormIng({ ...item });
        if (tab === 'gastos')   setFormGas({ ...item });
        if (tab === 'salarios') setFormSal({ ...item });
        if (tab === 'pagos')    setFormPag({ ...item });
        setMostrarForm(true);
    };

    const guardar = () => {
        const esEditar = editandoId !== null;
        let op;
        if (tab === 'ingresos') op = esEditar ? updateIngreso(editandoId, formIng) : createIngreso(formIng);
        if (tab === 'gastos')   op = esEditar ? updateGasto(editandoId, formGas)   : createGasto(formGas);
        if (tab === 'salarios') op = esEditar ? updateSalario(editandoId, formSal) : createSalario(formSal);
        if (tab === 'pagos')    op = esEditar ? updatePago(editandoId, formPag)    : createPago(formPag);
        op.then(() => { cargarTodo(); setMostrarForm(false); setEditandoId(null); toast(editandoId ? 'Registro actualizado' : 'Registro guardado'); }).catch(console.error);
    };

    const eliminar = async (tabNombre, id) => {
        if (!await confirm('¿Eliminar este registro?')) return;
        const ops = { ingresos: deleteIngreso, gastos: deleteGasto, salarios: deleteSalario, pagos: deletePago };
        ops[tabNombre](id).then(cargarTodo).catch(console.error);
    };

    const totalIngresos  = ingresos.reduce((a, i) => a + (i.total || 0), 0);
    const totalGastos    = gastos.reduce((a, g) => a + (g.monto || 0), 0);
    const utilidad       = totalIngresos - totalGastos;
    const totalPorCobrar = pagos.reduce((a, p) => a + (p.saldoPendiente || 0), 0);
    const totalCobrado   = pagos.reduce((a, p) => a + (p.valorPagado || 0), 0);

    const nomsMaquinas = maquinas.map(m => m.nombre);

    const TABS = [
        { key: 'ingresos', label: '💰 Ingresos' },
        { key: 'gastos',   label: '💸 Gastos' },
        { key: 'salarios', label: '👷 Salarios' },
        { key: 'pagos',    label: '💳 Pagos Clientes' },
    ];

    // ── Helpers para selects de máquina/operador
    const SelectMaquina = ({ value, onChange }) => (
        <select className="fsel" value={value} onChange={onChange}>
            <option value="">Selecciona una máquina...</option>
            {nomsMaquinas.map(n => <option key={n}>{n}</option>)}
        </select>
    );
    const SelectOperador = ({ value, onChange }) => {
        const ops = [...new Set(maquinas.filter(m => m.operadorNombre).map(m => m.operadorNombre))];
        return (
            <select className="fsel" value={value} onChange={onChange}>
                <option value="">Selecciona un operador...</option>
                {ops.map(n => <option key={n}>{n}</option>)}
            </select>
        );
    };

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Finanzas</h1><p>Ingresos, gastos, salarios y pagos</p></div>
                <div className="tb-r">
                    <button className="bp" onClick={abrirNuevo}>➕ Nuevo</button>
                </div>
            </div>

            <div className="content"><div className="pad">

                {/* RESUMEN */}
                <div className="g3">
                    <div className="card green"><span className="ci">💰</span><div className="cl">Ingresos</div><div className="cv">{fmt(totalIngresos)}</div><div className="cs">total acumulado</div></div>
                    <div className="card red"><span className="ci">💸</span><div className="cl">Gastos</div><div className="cv">{fmt(totalGastos)}</div><div className="cs">total acumulado</div></div>
                    <div className="card gold"><span className="ci">📈</span><div className="cl">Utilidad</div><div className="cv" style={{ color: utilidad >= 0 ? '#27ae60' : '#e74c3c' }}>{fmt(utilidad)}</div><div className="cs">ingresos − gastos</div></div>
                </div>

                {/* TABS */}
                <div className="tabs">
                    {TABS.map(t => (
                        <button key={t.key} className={`tab ${tab === t.key ? 'on' : ''}`}
                            onClick={() => { setTab(t.key); setMostrarForm(false); setEditandoId(null); }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── FORM INGRESOS ── */}
                {mostrarForm && tab === 'ingresos' && (
                    <div className="fc">
                        <h3>💰 {editandoId ? 'Editar' : 'Registrar'} Ingreso</h3>
                        <div className="fg2">
                            <div><label className="fl">Máquina *</label><SelectMaquina value={formIng.maquinaNombre} onChange={e => setFormIng({ ...formIng, maquinaNombre: e.target.value })} /></div>
                            <div><label className="fl">Tipo de trabajo</label>
                                <select className="fsel" value={formIng.tipoTrabajo} onChange={e => setFormIng({ ...formIng, tipoTrabajo: e.target.value })}>
                                    <option>Horas</option><option>Hectáreas</option><option>M³</option><option>Viajes</option><option>M²</option>
                                </select>
                            </div>
                        </div>
                        <div className="fg3">
                            <div><label className="fl">Cantidad</label><input className="fi" type="number" value={formIng.cantidad} onChange={e => setFormIng({ ...formIng, cantidad: e.target.value })} /></div>
                            <div><label className="fl">Valor unitario ($)</label><input className="fi" type="number" value={formIng.valorUnitario} onChange={e => setFormIng({ ...formIng, valorUnitario: e.target.value })} /></div>
                            <div><label className="fl">Fecha</label><input className="fi" type="date" value={formIng.fecha} onChange={e => setFormIng({ ...formIng, fecha: e.target.value })} /></div>
                        </div>
                        <div><label className="fl">Descripción</label><input className="fi" value={formIng.descripcion} onChange={e => setFormIng({ ...formIng, descripcion: e.target.value })} placeholder="Ej: Obra Av. 30" /></div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={guardar}>✅ {editandoId ? 'Actualizar' : 'Guardar'}</button>
                            <button className="bs" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* ── FORM GASTOS ── */}
                {mostrarForm && tab === 'gastos' && (
                    <div className="fc">
                        <h3>💸 {editandoId ? 'Editar' : 'Registrar'} Gasto</h3>
                        <div className="fg2">
                            <div><label className="fl">Máquina *</label><SelectMaquina value={formGas.maquinaNombre} onChange={e => setFormGas({ ...formGas, maquinaNombre: e.target.value })} /></div>
                            <div><label className="fl">Categoría</label>
                                <select className="fsel" value={formGas.categoria} onChange={e => setFormGas({ ...formGas, categoria: e.target.value })}>
                                    <option value="">Selecciona...</option>
                                    <option>Combustible</option><option>Mantenimiento</option><option>Repuestos</option><option>Otros</option>
                                </select>
                            </div>
                        </div>
                        <div className="fg2">
                            <div><label className="fl">Monto ($)</label><input className="fi" type="number" value={formGas.monto} onChange={e => setFormGas({ ...formGas, monto: e.target.value })} /></div>
                            <div><label className="fl">Fecha</label><input className="fi" type="date" value={formGas.fecha} onChange={e => setFormGas({ ...formGas, fecha: e.target.value })} /></div>
                        </div>
                        <div><label className="fl">Descripción</label><input className="fi" value={formGas.descripcion} onChange={e => setFormGas({ ...formGas, descripcion: e.target.value })} placeholder="Ej: Mantenimiento preventivo" /></div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={guardar}>✅ {editandoId ? 'Actualizar' : 'Guardar'}</button>
                            <button className="bs" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* ── FORM SALARIOS ── */}
                {mostrarForm && tab === 'salarios' && (
                    <div className="fc">
                        <h3>👷 {editandoId ? 'Editar' : 'Registrar'} Salario</h3>
                        <div className="fg2">
                            <div><label className="fl">Operador *</label><SelectOperador value={formSal.operadorNombre} onChange={e => {
                                const op = maquinas.find(m => m.operadorNombre === e.target.value);
                                setFormSal({ ...formSal, operadorNombre: e.target.value, maquinaNombre: op?.nombre || formSal.maquinaNombre, valorHora: op?.valorHoraOperador || formSal.valorHora });
                            }} /></div>
                            <div><label className="fl">Máquina</label><SelectMaquina value={formSal.maquinaNombre} onChange={e => setFormSal({ ...formSal, maquinaNombre: e.target.value })} /></div>
                        </div>
                        <div className="fg3">
                            <div><label className="fl">Horas trabajadas</label><input className="fi" type="number" value={formSal.horasTrabajadas} onChange={e => setFormSal({ ...formSal, horasTrabajadas: e.target.value })} /></div>
                            <div><label className="fl">Valor por hora ($)</label><input className="fi" type="number" value={formSal.valorHora} onChange={e => setFormSal({ ...formSal, valorHora: e.target.value })} /></div>
                            <div><label className="fl">Anticipos ($)</label><input className="fi" type="number" value={formSal.anticipos} onChange={e => setFormSal({ ...formSal, anticipos: e.target.value })} /></div>
                        </div>
                        <div className="fg2">
                            <div><label className="fl">Estado</label>
                                <select className="fsel" value={formSal.estado} onChange={e => setFormSal({ ...formSal, estado: e.target.value })}>
                                    <option>Pendiente</option><option>Pagado</option>
                                </select>
                            </div>
                            <div><label className="fl">Fecha</label><input className="fi" type="date" value={formSal.fecha} onChange={e => setFormSal({ ...formSal, fecha: e.target.value })} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={guardar}>✅ {editandoId ? 'Actualizar' : 'Guardar'}</button>
                            <button className="bs" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* ── FORM PAGOS ── */}
                {mostrarForm && tab === 'pagos' && (
                    <div className="fc">
                        <h3>💳 {editandoId ? 'Editar' : 'Registrar'} Pago de Cliente</h3>
                        <div className="fg2">
                            <div><label className="fl">Cliente *</label><input className="fi" value={formPag.cliente} onChange={e => setFormPag({ ...formPag, cliente: e.target.value })} placeholder="Nombre del cliente" /></div>
                            <div><label className="fl">Máquina *</label><SelectMaquina value={formPag.maquinaNombre} onChange={e => setFormPag({ ...formPag, maquinaNombre: e.target.value })} /></div>
                        </div>
                        <div><label className="fl">Descripción</label><input className="fi" value={formPag.descripcion} onChange={e => setFormPag({ ...formPag, descripcion: e.target.value })} placeholder="Ej: Obra Avenida 30" /></div>
                        <div className="fg3">
                            <div><label className="fl">Valor total ($)</label><input className="fi" type="number" value={formPag.valorTotal} onChange={e => setFormPag({ ...formPag, valorTotal: e.target.value })} /></div>
                            <div><label className="fl">Valor pagado ($)</label><input className="fi" type="number" value={formPag.valorPagado} onChange={e => setFormPag({ ...formPag, valorPagado: e.target.value })} /></div>
                            <div><label className="fl">Fecha</label><input className="fi" type="date" value={formPag.fecha} onChange={e => setFormPag({ ...formPag, fecha: e.target.value })} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={guardar}>✅ {editandoId ? 'Actualizar' : 'Guardar'}</button>
                            <button className="bs" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* ── TABLA INGRESOS ── */}
                {tab === 'ingresos' && (
                    <div className="tbl">
                        <div className="th"><strong>💰 Ingresos</strong><a onClick={abrirNuevo}>+ Agregar</a></div>
                        <div className="tr hdr"><span>Fecha</span><span className="w2">Descripción</span><span>Máquina</span><span>Tipo</span><span>Total</span><span>Acc.</span></div>
                        {ingresos.length === 0 && <p className="vacio">Sin registros</p>}
                        {ingresos.map(i => (
                            <div className="tr" key={i.id}>
                                <span>{i.fecha}</span><span className="w2">{i.descripcion}</span><span>{i.maquinaNombre}</span>
                                <span><span className="b hrs">{i.tipoTrabajo}</span></span>
                                <span className="pos">{fmt(i.total)}</span>
                                <span style={{ display: 'flex', gap: '4px' }}>
                                    <button className="icon-btn" onClick={() => abrirEditar(i)}>✏️</button>
                                    <button className="icon-btn" onClick={() => eliminar('ingresos', i.id)}>🗑️</button>
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── TABLA GASTOS ── */}
                {tab === 'gastos' && (
                    <div className="tbl">
                        <div className="th"><strong>💸 Gastos</strong><a onClick={abrirNuevo}>+ Agregar</a></div>
                        <div className="tr hdr"><span>Fecha</span><span className="w2">Descripción</span><span>Categoría</span><span>Máquina</span><span>Monto</span><span>Acc.</span></div>
                        {gastos.length === 0 && <p className="vacio">Sin registros</p>}
                        {gastos.map(g => (
                            <div className="tr" key={g.id}>
                                <span>{g.fecha}</span><span className="w2">{g.descripcion}</span><span>{g.categoria}</span><span>{g.maquinaNombre}</span>
                                <span className="neg">{fmt(g.monto)}</span>
                                <span style={{ display: 'flex', gap: '4px' }}>
                                    <button className="icon-btn" onClick={() => abrirEditar(g)}>✏️</button>
                                    <button className="icon-btn" onClick={() => eliminar('gastos', g.id)}>🗑️</button>
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── TABLA SALARIOS ── */}
                {tab === 'salarios' && (
                    <div className="tbl">
                        <div className="th"><strong>👷 Salarios</strong><a onClick={abrirNuevo}>+ Registrar Pago</a></div>
                        <div className="tr hdr"><span className="w2">Operador</span><span>Horas</span><span>$/Hora</span><span>Bruto</span><span>Anticipos</span><span>Neto</span><span>Estado</span><span>Acc.</span></div>
                        {salarios.length === 0 && <p className="vacio">Sin registros</p>}
                        {salarios.map(s => (
                            <div className="tr" key={s.id}>
                                <span className="w2">{s.operadorNombre}</span><span>{s.horasTrabajadas} hrs</span>
                                <span>{fmt(s.valorHora)}</span><span className="pos">{fmt(s.totalBruto)}</span>
                                <span className="neg">-{fmt(s.anticipos)}</span><span className="pos">{fmt(s.totalNeto)}</span>
                                <span><span className={`b ${s.estado === 'Pagado' ? 'ok' : 'pend'}`}>{s.estado}</span></span>
                                <span style={{ display: 'flex', gap: '4px' }}>
                                    <button className="icon-btn" onClick={() => abrirEditar(s)}>✏️</button>
                                    <button className="icon-btn" onClick={() => eliminar('salarios', s.id)}>🗑️</button>
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── TABLA PAGOS ── */}
                {tab === 'pagos' && (
                    <>
                        <div className="g2" style={{ marginBottom: '14px' }}>
                            <div className="dbox"><div style={{ fontSize: '12px', fontWeight: '700', color: '#e74c3c' }}>💸 Por cobrar</div><div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '24px', fontWeight: '800', color: '#e74c3c' }}>{fmt(totalPorCobrar)}</div></div>
                            <div className="cbox"><div style={{ fontSize: '12px', fontWeight: '700', color: '#27ae60' }}>✅ Cobrado</div><div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '24px', fontWeight: '800', color: '#27ae60' }}>{fmt(totalCobrado)}</div></div>
                        </div>
                        <div className="tbl">
                            <div className="th"><strong>💳 Pagos de Clientes</strong><a onClick={abrirNuevo}>+ Nuevo</a></div>
                            <div className="tr hdr"><span>Fecha</span><span className="w2">Cliente</span><span>Máquina</span><span>Total</span><span>Pagado</span><span>Saldo</span><span>Estado</span><span>Acc.</span></div>
                            {pagos.length === 0 && <p className="vacio">Sin registros</p>}
                            {pagos.map(p => (
                                <div className="tr" key={p.id}>
                                    <span>{p.fecha}</span><span className="w2">{p.cliente}</span><span>{p.maquinaNombre}</span>
                                    <span>{fmt(p.valorTotal)}</span><span className="pos">{fmt(p.valorPagado)}</span><span className="neg">{fmt(p.saldoPendiente)}</span>
                                    <span><span className={`b ${p.estado === 'Pagado' ? 'pag' : p.estado === 'Parcial' ? 'par' : 'deu'}`}>{p.estado}</span></span>
                                    <span style={{ display: 'flex', gap: '4px' }}>
                                        <button className="icon-btn" onClick={() => abrirEditar(p)}>✏️</button>
                                        <button className="icon-btn" onClick={() => eliminar('pagos', p.id)}>🗑️</button>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

            </div></div>
        </div>
        </>
    );
}

export default Finanzas;
