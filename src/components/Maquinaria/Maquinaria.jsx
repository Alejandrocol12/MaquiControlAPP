import { useState, useEffect } from 'react';
import { getMaquinas, createMaquina, updateMaquina, deleteMaquina, getIngresos, getGastos, createIngreso, createGasto, createCombustible, getCombustible, deleteIngreso, deleteGasto, deleteCombustible, createHora } from '../../api';
import { getOperadores } from '../../utils/localDB';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';

const TIPOS_TRABAJO = {
    Excavadora:   ['Horas', 'Hectáreas', 'M³'],
    Bulldozer:    ['Horas', 'Hectáreas'],
    Volqueta:     ['Horas', 'Viajes'],
    'Grúa':       ['Horas'],
    Compactador:  ['Horas', 'M²'],
};
const TODOS_TIPOS = [
    { key: 'Horas',     ico: '⏱️', uni: 'cant × valor/hora' },
    { key: 'Hectáreas', ico: '🌾', uni: 'cant × valor/Ha' },
    { key: 'Viajes',    ico: '🚛', uni: 'cant × valor/viaje' },
    { key: 'M³',        ico: '📦', uni: 'cant × valor/m³' },
    { key: 'M²',        ico: '📐', uni: 'cant × valor/m²' },
];

const fmt = (v) => '$' + (v || 0).toLocaleString('es-CO');
const estadoClass = (e) => e === 'Activa' ? 'ea' : e === 'En mantenimiento' ? 'em' : 'ef';

const FORM_VACIO = { nombre: '', tipo: '', placa: '', horometroActual: 0, estado: 'Activa', operadorNombre: '', valorHoraOperador: 0, valorHoraMaquina: 0 };

function Maquinaria({ vistaInicial = 'lista' }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [maquinas, setMaquinas] = useState([]);
    const [vista, setVista] = useState(vistaInicial); // lista | nueva | editar | detalle
    const [maqActual, setMaqActual] = useState(null);
    const [form, setForm] = useState(FORM_VACIO);
    const operadoresLocal = getOperadores();

    useEffect(() => { cargar(); }, []);

    const cargar = () => getMaquinas().then(r => setMaquinas(r.data)).catch(console.error);

    const abrirEditar = (m, e) => { e.stopPropagation(); setForm({ ...m }); setMaqActual(m); setVista('editar'); };
    const abrirDetalle = (m) => { setMaqActual(m); setVista('detalle'); };
    const hc = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const guardar = () => {
        const op = vista === 'nueva' ? createMaquina(form) : updateMaquina(maqActual.id, form);
        op.then(() => { cargar(); setVista('lista'); setForm(FORM_VACIO); }).catch(console.error);
    };

    const eliminar = async (id, e) => {
        e.stopPropagation();
        if (await confirm('¿Eliminar esta máquina? Esta acción no se puede deshacer.'))
            deleteMaquina(id).then(() => { cargar(); toast('Máquina eliminada'); }).catch(console.error);
    };

    // ── VISTA DETALLE ──────────────────────────────────────────
    if (vista === 'detalle' && maqActual) {
        return <DetalleMaquina
            maquina={maqActual}
            onVolver={() => { cargar(); setVista('lista'); }}
            onEditar={() => { setForm({ ...maqActual }); setVista('editar'); }}
            onActualizar={(m) => setMaqActual(m)}
        />;
    }

    // ── FORMULARIO NUEVA / EDITAR ──────────────────────────────
    if (vista === 'nueva' || vista === 'editar') return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div>
                    <h1>{vista === 'nueva' ? 'Nueva Máquina' : 'Editar Máquina'}</h1>
                    <p>{vista === 'editar' ? `Modificando: ${maqActual?.nombre}` : 'Registra una nueva máquina'}</p>
                </div>
                <button className="bs" onClick={() => setVista('lista')}>← Volver</button>
            </div>
            <div className="content"><div className="pad">
                <div className="fc">
                    <h3>🚜 Datos de la máquina</h3>
                    <p className="fd">Todos los campos marcados son obligatorios</p>
                    <div className="fg2">
                        <div><label className="fl">Nombre *</label><input className="fi" name="nombre" value={form.nombre} onChange={hc} placeholder="Ej: Excavadora CAT 320" /></div>
                        <div><label className="fl">Tipo *</label>
                            <select className="fsel" name="tipo" value={form.tipo} onChange={hc}>
                                <option value="">Selecciona...</option>
                                {Object.keys(TIPOS_TRABAJO).map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="fg2">
                        <div><label className="fl">Placa *</label><input className="fi" name="placa" value={form.placa} onChange={hc} placeholder="Ej: EXC-001" /></div>
                        <div><label className="fl">Horómetro (hrs)</label><input className="fi" type="number" name="horometroActual" value={form.horometroActual} onChange={hc} /></div>
                    </div>
                    <div className="fg2">
                        <div>
                            <label className="fl">Operador asignado</label>
                            <input className="fi" name="operadorNombre" value={form.operadorNombre} onChange={hc} placeholder="Selecciona o escribe..." list="lista-ops" />
                            <datalist id="lista-ops">
                                {operadoresLocal.map(o => <option key={o.id} value={o.nombre} />)}
                            </datalist>
                        </div>
                        <div><label className="fl">Valor hora operador ($)</label><input className="fi" type="number" name="valorHoraOperador" value={form.valorHoraOperador} onChange={hc} placeholder="Ej: 15000" /></div>
                    </div>
                    <div className="fg2">
                        <div>
                            <label className="fl">Valor hora máquina al cliente ($)</label>
                            <input className="fi" type="number" name="valorHoraMaquina" value={form.valorHoraMaquina} onChange={hc} placeholder="Ej: 180000" />
                            <span style={{ fontSize: '11px', color: '#6b7a8d' }}>Lo que cobra la máquina por hora trabajada</span>
                        </div>
                        <div>
                            <label className="fl">Estado</label>
                            <select className="fsel" name="estado" value={form.estado} onChange={hc}>
                                <option>Activa</option><option>En mantenimiento</option><option>Inactiva</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="bp" style={{ flex: 1, justifyContent: 'center', padding: '13px' }} onClick={guardar}>
                        ✅ {vista === 'nueva' ? 'Registrar Máquina' : 'Guardar Cambios'}
                    </button>
                    <button className="bs" onClick={() => setVista('lista')}>Cancelar</button>
                </div>
            </div></div>
        </div>
    );

    // ── LISTA ──────────────────────────────────────────────────
    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Maquinaria</h1><p>Máquinas registradas</p></div>
                <button className="bp" onClick={() => { setForm(FORM_VACIO); setVista('nueva'); }}>➕ Nueva Máquina</button>
            </div>
            <div className="content"><div className="pad">
                <div className="gm">
                    {maquinas.map(m => (
                        <div className="mcard" key={m.id} onClick={() => abrirDetalle(m)}>
                            <div className="mch">
                                <div className="mci">🚜</div>
                                <div>
                                    <div className="mcn">{m.nombre}</div>
                                    <div className="mct">{m.tipo} · {m.placa}</div>
                                </div>
                            </div>
                            <div className="mcb">
                                <div className="mcs"><span>Estado</span>
                                    <span className={estadoClass(m.estado)}><span className="ed"></span>{m.estado}</span>
                                </div>
                                <div className="mcs"><span>Operador</span><span>{m.operadorNombre || '—'}</span></div>
                                <div className="mcs"><span>Horómetro</span><span>{(m.horometroActual || 0).toLocaleString('es-CO')} hrs</span></div>
                                <div className="mcs"><span>Valor/hora operador</span><span>{fmt(m.valorHoraOperador)}</span></div>
                                {m.valorHoraMaquina > 0 && <div className="mcs"><span>Valor/hora máquina</span><span style={{ color: '#27ae60', fontWeight: '600' }}>{fmt(m.valorHoraMaquina)}</span></div>}
                                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                                    <button className="bs" style={{ flex: 1, textAlign: 'center', fontSize: '12px' }} onClick={(e) => abrirEditar(m, e)}>✏️ Editar</button>
                                    <button className="bs" style={{ fontSize: '12px' }} onClick={(e) => eliminar(m.id, e)}>🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="nueva" onClick={() => { setForm(FORM_VACIO); setVista('nueva'); }}>
                        <span style={{ fontSize: '22px' }}>➕</span>
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>Nueva Máquina</span>
                    </div>
                </div>
            </div></div>
        </div>
        </>
    );
}

// ══════════════════════════════════════════════════════════════
// DETALLE MÁQUINA
// ══════════════════════════════════════════════════════════════
function DetalleMaquina({ maquina, onVolver, onEditar, onActualizar }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [tab, setTab] = useState(0);
    const [ingresos, setIngresos] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [combustibles, setCombustibles] = useState([]);
    const [maq, setMaq] = useState(maquina);

    // Registro trabajo
    const [tipoTrabajo, setTipoTrabajo] = useState('Horas');
    const [cantidad, setCantidad] = useState('');
    const [valorUnitario, setValorUnitario] = useState('');
    const [fechaTrabajo, setFechaTrabajo] = useState(new Date().toISOString().split('T')[0]);
    const [descTrabajo, setDescTrabajo] = useState('');

    // Gastos
    const [gastoForm, setGastoForm] = useState({ descripcion: '', monto: '', categoria: 'Reparación', fecha: new Date().toISOString().split('T')[0] });

    // Combustible
    const [galones, setGalones] = useState('');
    const [precioPorGalon, setPrecioPorGalon] = useState('');
    const [fechaComb, setFechaComb] = useState(new Date().toISOString().split('T')[0]);
    const [horoComb, setHoroComb] = useState(maq.horometroActual || 0);

    useEffect(() => { cargarDatos(); }, []);

    const cargarDatos = () => {
        getIngresos().then(r => setIngresos(r.data.filter(i => i.maquinaNombre === maq.nombre))).catch(console.error);
        getGastos().then(r => setGastos(r.data.filter(g => g.maquinaNombre === maq.nombre))).catch(console.error);
        getCombustible().then(r => setCombustibles(r.data.filter(c => c.maquinaNombre === maq.nombre))).catch(console.error);
    };

    const totalIngresos = ingresos.reduce((a, i) => a + (i.total || 0), 0);
    const totalGastos = gastos.reduce((a, g) => a + (g.monto || 0), 0);
    const tiposPermitidos = TIPOS_TRABAJO[maq.tipo] || ['Horas'];

    const totalTrabajo = parseFloat(cantidad || 0) * parseFloat(valorUnitario || 0);
    const nuevoHoro = tipoTrabajo === 'Horas' ? (maq.horometroActual || 0) + parseFloat(cantidad || 0) : maq.horometroActual;
    const totalComb = parseFloat(galones || 0) * parseFloat(precioPorGalon || 0);

    const registrarTrabajo = () => {
        if (!cantidad || !valorUnitario) return toast('Completa cantidad y valor unitario', 'e');
        const payload = {
            maquinaNombre: maq.nombre, tipoTrabajo, cantidad: parseFloat(cantidad),
            valorUnitario: parseFloat(valorUnitario), fecha: fechaTrabajo, descripcion: descTrabajo || `${tipoTrabajo} – ${maq.nombre}`
        };
        createIngreso(payload).then(() => {
            const promises = [];
            if (tipoTrabajo === 'Horas') {
                const maqActualizada = { ...maq, horometroActual: nuevoHoro };
                promises.push(
                    updateMaquina(maq.id, maqActualizada).then(() => {
                        setMaq(maqActualizada);
                        onActualizar(maqActualizada);
                    })
                );
                if (maq.operadorNombre) {
                    promises.push(
                        createHora({
                            operadorNombre:  maq.operadorNombre,
                            maquinaNombre:   maq.nombre,
                            fecha:           fechaTrabajo,
                            horas:           parseFloat(cantidad),
                            valorHora:       maq.valorHoraOperador || 0,
                            horometroInicio: maq.horometroActual || 0,
                            horometroFin:    nuevoHoro,
                        })
                    );
                    promises.push(
                        createGasto({
                            maquinaNombre: maq.nombre,
                            descripcion:   `Salario ${maq.operadorNombre} — ${cantidad} hrs`,
                            categoria:     'Salarios',
                            monto:         parseFloat(cantidad) * (maq.valorHoraOperador || 0),
                            fecha:         fechaTrabajo,
                        })
                    );
                }
            }
            return Promise.all(promises);
        }).then(() => {
            cargarDatos();
            setCantidad(''); setValorUnitario(''); setDescTrabajo('');
            toast('Trabajo registrado');
        }).catch(console.error);
    };

    const registrarCombustible = () => {
        if (!galones || !precioPorGalon) return toast('Completa galones y precio', 'e');
        createCombustible({
            maquinaNombre: maq.nombre, galones: parseFloat(galones),
            precioPorGalon: parseFloat(precioPorGalon), horometro: parseFloat(horoComb), fecha: fechaComb
        }).then(() => {
            cargarDatos();
            setGalones(''); setPrecioPorGalon('');
            toast('Carga de combustible registrada');
        }).catch(console.error);
    };

    const eliminarIngreso = async (id) => { if (await confirm('¿Eliminar este ingreso?')) deleteIngreso(id).then(cargarDatos).catch(console.error); };
    const eliminarGasto   = async (id) => { if (await confirm('¿Eliminar este gasto?'))   deleteGasto(id).then(cargarDatos).catch(console.error); };
    const eliminarComb    = async (id) => { if (await confirm('¿Eliminar esta carga?'))    deleteCombustible(id).then(cargarDatos).catch(console.error); };

    const TABS = ['📋 Resumen', '⚙️ Registro Trabajo', '💰 Ingresos', '💸 Gastos', '⛽ Combustible'];

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>{maq.nombre}</h1><p>Detalle financiero y operativo</p></div>
                <div className="tb-r">
                    <button className="bs" onClick={onVolver}>← Volver</button>
                    <button className="bp" onClick={onEditar}>✏️ Editar</button>
                </div>
            </div>
            <div className="content"><div className="pad">

                {/* HEADER OSCURO */}
                <div className="dh">
                    <div className="dhi">🚜</div>
                    <div>
                        <h2>{maq.nombre}</h2>
                        <p>Placa: {maq.placa} · Operador: {maq.operadorNombre || '—'} · Operador: {fmt(maq.valorHoraOperador)}/hr · Máquina: {fmt(maq.valorHoraMaquina || 0)}/hr</p>
                    </div>
                    <div className="dhb">
                        <span className={`b ${maq.estado === 'Activa' ? 'ok' : maq.estado === 'En mantenimiento' ? 'pend' : 'falla'}`}>
                            <span className={`ed`} style={{ background: maq.estado === 'Activa' ? '#27ae60' : maq.estado === 'En mantenimiento' ? '#e8941a' : '#e74c3c' }}></span>
                            {maq.estado}
                        </span>
                        <span className="b comp">⏱ {(maq.horometroActual || 0).toLocaleString('es-CO')} hrs</span>
                    </div>
                </div>

                {/* TABS */}
                <div className="tabs">
                    {TABS.map((t, i) => <button key={i} className={`tab ${tab === i ? 'on' : ''}`} onClick={() => setTab(i)}>{t}</button>)}
                </div>

                {/* TAB 0 — RESUMEN */}
                {tab === 0 && (
                    <>
                        <div className="g4">
                            <div className="card green"><span className="ci">💰</span><div className="cl">Ingresos</div><div className="cv">{fmt(totalIngresos)}</div><div className="cs">total generado</div></div>
                            <div className="card red"><span className="ci">💸</span><div className="cl">Gastos</div><div className="cv">{fmt(totalGastos)}</div><div className="cs">total gastado</div></div>
                            <div className="card gold"><span className="ci">📈</span><div className="cl">Utilidad</div><div className="cv" style={{ color: totalIngresos - totalGastos >= 0 ? '#27ae60' : '#e74c3c' }}>{fmt(totalIngresos - totalGastos)}</div><div className="cs">ingresos − gastos</div></div>
                            <div className="card blue"><span className="ci">⏱️</span><div className="cl">Horas</div><div className="cv xl" style={{ color: '#2980b9' }}>{(maq.horometroActual || 0).toLocaleString('es-CO')}</div><div className="cs">horómetro actual</div></div>
                        </div>
                        <div className="g2">
                            <div className="tbl">
                                <div className="th"><strong>💰 Últimos Ingresos</strong></div>
                                <div className="tr hdr"><span>Fecha</span><span className="w2">Descripción</span><span>Total</span></div>
                                {ingresos.slice(0, 5).map(i => <div className="tr" key={i.id}><span>{i.fecha}</span><span className="w2">{i.descripcion}</span><span className="pos">{fmt(i.total)}</span></div>)}
                                {ingresos.length === 0 && <p className="vacio">Sin ingresos</p>}
                            </div>
                            <div className="tbl">
                                <div className="th"><strong>💸 Últimos Gastos</strong></div>
                                <div className="tr hdr"><span>Fecha</span><span className="w2">Descripción</span><span>Total</span></div>
                                {gastos.slice(0, 5).map(g => <div className="tr" key={g.id}><span>{g.fecha}</span><span className="w2">{g.descripcion}</span><span className="neg">{fmt(g.monto)}</span></div>)}
                                {gastos.length === 0 && <p className="vacio">Sin gastos</p>}
                            </div>
                        </div>
                    </>
                )}

                {/* TAB 1 — REGISTRO TRABAJO */}
                {tab === 1 && (
                    <>
                        <div className="fc">
                            <h3>⚙️ Registrar trabajo</h3>
                            <p className="fd">{maq.nombre} — selecciona cómo se midió el trabajo</p>
                            <div className="tg">
                                {TODOS_TIPOS.map(t => {
                                    const activo = tiposPermitidos.includes(t.key);
                                    return (
                                        <div key={t.key} className={`tc ${!activo ? 'dis' : tipoTrabajo === t.key ? 'sel' : ''}`}
                                            onClick={() => activo && setTipoTrabajo(t.key)}>
                                            <div className="tico">{t.ico}</div>
                                            <div className="tnom">{t.key}</div>
                                            <div className="tuni">{activo ? t.uni : 'No aplica'}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="fg2">
                                <div><label className="fl">Cantidad ({tipoTrabajo})</label><input className="fi" type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="Ej: 8" /></div>
                                <div><label className="fl">Valor unitario ($)</label><input className="fi" type="number" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} placeholder="Ej: 120000" /></div>
                            </div>
                            <div className="fg2">
                                <div><label className="fl">Fecha</label><input className="fi" type="date" value={fechaTrabajo} onChange={e => setFechaTrabajo(e.target.value)} /></div>
                                <div><label className="fl">Descripción (opcional)</label><input className="fi" value={descTrabajo} onChange={e => setDescTrabajo(e.target.value)} placeholder="Ej: Obra Av. 30" /></div>
                            </div>
                            <div className="rsum">
                                <h4>📋 Resumen antes de guardar</h4>
                                <div className="rr"><span>Tipo</span><span>{tipoTrabajo}</span></div>
                                <div className="rr"><span>Cantidad</span><span>{cantidad || 0} unidades</span></div>
                                <div className="rr"><span>Valor unitario</span><span>{fmt(parseFloat(valorUnitario || 0))}</span></div>
                                {tipoTrabajo === 'Horas' && <div className="rr"><span>Horómetro: antes → después</span><span style={{ color: '#2980b9' }}>{maq.horometroActual || 0} → {nuevoHoro} hrs</span></div>}
                                <div className="rr"><span>Total ingreso</span><span className="pos">{fmt(totalTrabajo)}</span></div>
                            </div>
                            <div className="rbox">
                                <div><div className="rl">Total calculado</div><div className="rv">{fmt(totalTrabajo)}</div><div className="rf">{cantidad || 0} × {fmt(parseFloat(valorUnitario || 0))} = {fmt(totalTrabajo)}</div></div>
                                <div style={{ textAlign: 'right' }}><div style={{ color: '#6b7a8d', fontSize: '11px' }}>Se agrega a</div><div style={{ color: '#f5a623', fontSize: '12px', fontWeight: '700' }}>💰 Ingresos + Horómetro</div></div>
                            </div>
                            <button className="bp" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={registrarTrabajo}>
                                ✅ Confirmar y Guardar
                            </button>
                        </div>
                        <div className="tbl">
                            <div className="th"><strong>Historial de trabajos</strong></div>
                            <div className="tr hdr"><span>Fecha</span><span>Tipo</span><span>Cantidad</span><span>Total</span><span>Acc.</span></div>
                            {ingresos.map(i => (
                                <div className="tr" key={i.id}>
                                    <span>{i.fecha}</span>
                                    <span><span className="b hrs">{i.tipoTrabajo}</span></span>
                                    <span>{i.cantidad}</span>
                                    <span className="pos">{fmt(i.total)}</span>
                                    <span><button className="icon-btn" onClick={() => eliminarIngreso(i.id)}>🗑️</button></span>
                                </div>
                            ))}
                            {ingresos.length === 0 && <p className="vacio">Sin registros</p>}
                        </div>
                    </>
                )}

                {/* TAB 2 — INGRESOS */}
                {tab === 2 && (
                    <div className="tbl">
                        <div className="th"><strong>💰 Ingresos — {maq.nombre}</strong></div>
                        <div className="tr hdr"><span>Fecha</span><span className="w2">Descripción</span><span>Tipo</span><span>Total</span><span>Acc.</span></div>
                        {ingresos.map(i => (
                            <div className="tr" key={i.id}>
                                <span>{i.fecha}</span><span className="w2">{i.descripcion}</span>
                                <span><span className="b hrs">{i.tipoTrabajo}</span></span>
                                <span className="pos">{fmt(i.total)}</span>
                                <span><button className="icon-btn" onClick={() => eliminarIngreso(i.id)}>🗑️</button></span>
                            </div>
                        ))}
                        {ingresos.length === 0 && <p className="vacio">Sin ingresos para esta máquina</p>}
                    </div>
                )}

                {/* TAB 3 — GASTOS */}
                {tab === 3 && (
                    <>
                        <div className="fc">
                            <h3>💸 Registrar gasto</h3>
                            <p className="fd">El gasto queda asociado a {maq.nombre}</p>
                            <div className="fg2">
                                <div><label className="fl">Descripción *</label><input className="fi" value={gastoForm.descripcion} onChange={e => setGastoForm({ ...gastoForm, descripcion: e.target.value })} placeholder="Ej: Cambio de manguera" /></div>
                                <div>
                                    <label className="fl">Categoría</label>
                                    <select className="fsel" value={gastoForm.categoria} onChange={e => setGastoForm({ ...gastoForm, categoria: e.target.value })}>
                                        <option>Reparación</option><option>Repuestos</option><option>Lubricantes</option><option>Combustible</option><option>Otros</option>
                                    </select>
                                </div>
                            </div>
                            <div className="fg2">
                                <div><label className="fl">Monto ($) *</label><input className="fi" type="number" value={gastoForm.monto} onChange={e => setGastoForm({ ...gastoForm, monto: e.target.value })} placeholder="Ej: 250000" /></div>
                                <div><label className="fl">Fecha</label><input className="fi" type="date" value={gastoForm.fecha} onChange={e => setGastoForm({ ...gastoForm, fecha: e.target.value })} /></div>
                            </div>
                            <button className="bp" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={() => {
                                if (!gastoForm.descripcion || !gastoForm.monto) return toast('Completa descripción y monto', 'e');
                                createGasto({ ...gastoForm, maquinaNombre: maq.nombre, monto: parseFloat(gastoForm.monto) })
                                    .then(() => { cargarDatos(); setGastoForm({ descripcion: '', monto: '', categoria: 'Reparación', fecha: new Date().toISOString().split('T')[0] }); toast('Gasto registrado'); })
                                    .catch(console.error);
                            }}>✅ Registrar Gasto</button>
                        </div>
                        <div className="tbl">
                            <div className="th"><strong>💸 Gastos — {maq.nombre}</strong></div>
                            <div className="tr hdr"><span>Fecha</span><span className="w2">Descripción</span><span>Categoría</span><span>Total</span><span>Acc.</span></div>
                            {gastos.map(g => (
                                <div className="tr" key={g.id}>
                                    <span>{g.fecha}</span><span className="w2">{g.descripcion}</span>
                                    <span>{g.categoria}</span>
                                    <span className="neg">{fmt(g.monto)}</span>
                                    <span><button className="icon-btn" onClick={() => eliminarGasto(g.id)}>🗑️</button></span>
                                </div>
                            ))}
                            {gastos.length === 0 && <p className="vacio">Sin gastos para esta máquina</p>}
                        </div>
                    </>
                )}

                {/* TAB 4 — COMBUSTIBLE */}
                {tab === 4 && (
                    <>
                        <div className="fc">
                            <h3>⛽ Registrar carga de combustible</h3>
                            <p className="fd">El gasto se crea automáticamente en Finanzas</p>
                            <div className="fg3">
                                <div><label className="fl">Galones</label><input className="fi" type="number" value={galones} onChange={e => setGalones(e.target.value)} placeholder="Ej: 50" /></div>
                                <div><label className="fl">Precio/galón ($)</label><input className="fi" type="number" value={precioPorGalon} onChange={e => setPrecioPorGalon(e.target.value)} placeholder="Ej: 12500" /></div>
                                <div><label className="fl">Horómetro al cargar</label><input className="fi" type="number" value={horoComb} onChange={e => setHoroComb(e.target.value)} /></div>
                            </div>
                            <div className="fg2">
                                <div><label className="fl">Fecha</label><input className="fi" type="date" value={fechaComb} onChange={e => setFechaComb(e.target.value)} /></div>
                            </div>
                            <div className="rbox">
                                <div><div className="rl">Total del gasto</div><div className="rv">{fmt(totalComb)}</div><div className="rf">{galones || 0} gal × {fmt(parseFloat(precioPorGalon || 0))}</div></div>
                                <div style={{ textAlign: 'right' }}><div style={{ color: '#6b7a8d', fontSize: '11px' }}>Se agrega a</div><div style={{ color: '#e74c3c', fontSize: '12px', fontWeight: '700' }}>💸 Gastos de esta máquina</div></div>
                            </div>
                            <button className="bp" style={{ width: '100%', justifyContent: 'center', padding: '12px', background: '#e67e22' }} onClick={registrarCombustible}>
                                ⛽ Registrar Carga
                            </button>
                        </div>
                        <div className="tbl">
                            <div className="th"><strong>Cargas — {maq.nombre}</strong></div>
                            <div className="tr hdr"><span>Fecha</span><span>Galones</span><span>$/Galón</span><span>Horómetro</span><span>Total</span><span>Acc.</span></div>
                            {combustibles.map(c => (
                                <div className="tr" key={c.id}>
                                    <span>{c.fecha}</span><span>{c.galones} gal</span>
                                    <span>{fmt(c.precioPorGalon)}</span>
                                    <span>{c.horometro}</span>
                                    <span className="neg">{fmt(c.total)}</span>
                                    <span><button className="icon-btn" onClick={() => eliminarComb(c.id)}>🗑️</button></span>
                                </div>
                            ))}
                            {combustibles.length === 0 && <p className="vacio">Sin cargas registradas</p>}
                        </div>
                    </>
                )}

            </div></div>
        </div>
        </>
    );
}

export default Maquinaria;
