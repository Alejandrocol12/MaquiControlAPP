import { useState, useEffect } from 'react';
import { getMaquinas, getMantenimientos, createMantenimiento, updateMantenimiento, deleteMantenimiento, createGasto, deleteGasto, getGastos } from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import { Wrench, Clock, TrendingDown, Plus, Check, Pencil, Trash2, Search, AlertCircle } from 'lucide-react';
import MoneyInput from '../../utils/MoneyInput';

const fmt = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().split('T')[0];
const FORM_VACIO = { maquinaNombre: '', tipo: '', descripcion: '', costo: '', horometro: '', fecha: hoy(), estado: 'Pendiente' };

function Mantenimientos() {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [maquinas, setMaquinas]           = useState([]);
    const [mantenimientos, setMantenimientos] = useState([]);
    const [mostrarForm, setMostrarForm]     = useState(false);
    const [editandoId, setEditandoId]       = useState(null);
    const [form, setForm]                   = useState(FORM_VACIO);
    const [buscar, setBuscar]               = useState('');

    useEffect(() => { cargar(); }, []);

    const cargar = () => {
        getMaquinas().then(r => setMaquinas(r.data)).catch(console.error);
        getMantenimientos().then(r => setMantenimientos(r.data)).catch(console.error);
    };

    const abrirNuevo = () => { setEditandoId(null); setForm(FORM_VACIO); setMostrarForm(true); };
    const abrirEditar = (m) => { setEditandoId(m.id); setForm({ ...m }); setMostrarForm(true); };
    const hc = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const guardar = () => {
        if (!form.maquinaNombre) return toast('Selecciona una máquina', 'e');
        if (!form.tipo) return toast('Selecciona el tipo de mantenimiento', 'e');
        const costo = Number(form.costo) || 0;
        if (editandoId) {
            updateMantenimiento(editandoId, form)
                .then(() => getGastos())
                .then(r => {
                    const gastoExistente = r.data.find(g => g.refMantenimientoId === editandoId);
                    const gastoData = {
                        maquinaNombre: form.maquinaNombre,
                        descripcion: `Mantenimiento ${form.tipo}${form.descripcion ? ' — ' + form.descripcion : ''}`,
                        categoria: 'Mantenimiento',
                        monto: costo,
                        fecha: form.fecha,
                        refMantenimientoId: editandoId,
                    };
                    if (gastoExistente) return createGasto(gastoData).then(() => deleteGasto(gastoExistente.id));
                    if (costo > 0 && form.maquinaNombre) return createGasto(gastoData);
                })
                .then(() => { cargar(); setMostrarForm(false); setEditandoId(null); setForm(FORM_VACIO); toast('Mantenimiento actualizado'); })
                .catch(console.error);
        } else {
            createMantenimiento(form)
                .then(r => {
                    const nuevoId = r.data?.id;
                    if (costo > 0 && form.maquinaNombre) {
                        return createGasto({
                            maquinaNombre: form.maquinaNombre,
                            descripcion: `Mantenimiento ${form.tipo}${form.descripcion ? ' — ' + form.descripcion : ''}`,
                            categoria: 'Mantenimiento',
                            monto: costo,
                            fecha: form.fecha,
                            refMantenimientoId: nuevoId,
                        });
                    }
                })
                .then(() => { cargar(); setMostrarForm(false); setForm(FORM_VACIO); toast('Mantenimiento registrado'); })
                .catch(console.error);
        }
    };

    const eliminar = async (id) => {
        if (!await confirm('¿Eliminar este mantenimiento?')) return;
        try {
            const gastosRes = await getGastos();
            const gastoVinculado = gastosRes.data.find(g => g.refMantenimientoId === id);
            await deleteMantenimiento(id);
            if (gastoVinculado) await deleteGasto(gastoVinculado.id);
            cargar();
        } catch (e) { console.error(e); }
    };

    const lista = mantenimientos.filter(m =>
        !buscar || m.maquinaNombre?.toLowerCase().includes(buscar.toLowerCase()) || m.tipo?.toLowerCase().includes(buscar.toLowerCase())
    );

    const pendientes = mantenimientos.filter(m => m.estado === 'Pendiente');
    const totalCosto = mantenimientos.reduce((a, m) => a + (Number(m.costo) || 0), 0);

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Mantenimientos</h1><p>Historial y alertas de mantenimiento</p></div>
                <button className="bp" onClick={abrirNuevo}><Plus size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> Registrar</button>
            </div>

            <div className="content"><div className="pad">

                {/* CARDS */}
                <div className="g3">
                    <div className="card gold"><span className="ci"><Wrench size={22} /></span><div className="cl">Total registros</div><div className="cv">{mantenimientos.length}</div><div className="cs">historial completo</div></div>
                    <div className="card red"><span className="ci"><Clock size={22} /></span><div className="cl">Pendientes</div><div className="cv">{pendientes.length}</div><div className="cs">requieren atención</div></div>
                    <div className="card blue"><span className="ci"><TrendingDown size={22} /></span><div className="cl">Costo total</div><div className="cv">{fmt(totalCosto)}</div><div className="cs">acumulado</div></div>
                </div>

                {/* ALERTAS — mantenimientos pendientes */}
                {pendientes.map(m => (
                    <div key={m.id} className="ale red">
                        <AlertCircle size={18} color="#e74c3c" />
                        <div>
                            <p>{m.maquinaNombre} — {m.tipo}</p>
                            <span className="ale-desc">{m.fecha} · Pendiente revisión</span>
                        </div>
                    </div>
                ))}

                {/* FORM */}
                {mostrarForm && (
                    <div className="fc">
                        <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><Wrench size={18} /> {editandoId ? 'Editar' : 'Registrar'} Mantenimiento</h3>
                        <div className="fg2">
                            <div>
                                <label className="fl">Máquina *</label>
                                <select className="fsel" name="maquinaNombre" value={form.maquinaNombre} onChange={hc}>
                                    <option value="">Selecciona...</option>
                                    {maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="fl">Tipo *</label>
                                <select className="fsel" name="tipo" value={form.tipo} onChange={hc}>
                                    <option value="">Selecciona...</option>
                                    <option>Preventivo</option><option>Correctivo</option>
                                    <option>Cambio aceite</option><option>Revisión general</option><option>Otro</option>
                                </select>
                            </div>
                        </div>
                        <div className="fg3">
                            <div><label className="fl">Costo ($)</label><MoneyInput className="fi" name="costo" value={form.costo} onChange={hc} /></div>
                            <div><label className="fl">Horómetro (hrs)</label><input className="fi" type="number" name="horometro" value={form.horometro} onChange={hc} /></div>
                            <div><label className="fl">Fecha</label><input className="fi" type="date" name="fecha" value={form.fecha} onChange={hc} /></div>
                        </div>
                        <div className="fg2">
                            <div>
                                <label className="fl">Estado</label>
                                <select className="fsel" name="estado" value={form.estado} onChange={hc}>
                                    <option>Pendiente</option><option>En proceso</option><option>Completado</option>
                                </select>
                            </div>
                            <div><label className="fl">Descripción</label><input className="fi" name="descripcion" value={form.descripcion} onChange={hc} placeholder="Detalle del mantenimiento" /></div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={guardar}><Check size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> {editandoId ? 'Actualizar' : 'Registrar'}</button>
                            <button className="bs" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* TABLA */}
                <div className="tbl">
                    <div className="th">
                        <strong>Historial completo</strong>
                        <div className="th-s"><Search size={14} /><input type="text" placeholder="Buscar..." value={buscar} onChange={e => setBuscar(e.target.value)} /></div>
                        <a onClick={abrirNuevo}>+ Registrar</a>
                    </div>
                    <div className="tr hdr"><span>Fecha</span><span className="w2">Máquina</span><span>Tipo</span><span className="w2">Descripción</span><span>Costo</span><span>Estado</span><span>Acc.</span></div>
                    {lista.length === 0 && <p className="vacio">Sin registros</p>}
                    {lista.map(m => (
                        <div className="tr" key={m.id}>
                            <span>{m.fecha}</span>
                            <span className="w2">{m.maquinaNombre}</span>
                            <span>{m.tipo}</span>
                            <span className="w2">{m.descripcion || '—'}</span>
                            <span className="neg">{fmt(m.costo)}</span>
                            <span>
                                <span className={`b ${m.estado === 'Completado' ? 'comp' : m.estado === 'En proceso' ? 'pend' : 'falla'}`}>
                                    {m.estado}
                                </span>
                            </span>
                            <span style={{ display: 'flex', gap: '4px' }}>
                                <button className="icon-btn" onClick={() => abrirEditar(m)}><Pencil size={14} /></button>
                                <button className="icon-btn" onClick={() => eliminar(m.id)}><Trash2 size={14} /></button>
                            </span>
                        </div>
                    ))}
                </div>

            </div></div>
        </div>
        </>
    );
}

export default Mantenimientos;
