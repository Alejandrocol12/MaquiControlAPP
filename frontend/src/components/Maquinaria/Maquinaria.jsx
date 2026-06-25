import { useState, useEffect } from 'react';
import {
    getMaquinas, createMaquina, updateMaquina, deleteMaquina,
    getIngresos, getGastos, createIngreso, createGasto, updateGasto,
    createCombustible, getCombustible, deleteIngreso, deleteGasto, deleteCombustible,
    createHora, getOperadoresAPI,
    getFaenaActiva, createFaena, cerrarFaena,
    crearEnlace, getEnlaces, revocarEnlace,
    leerFacturaIA,
} from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import MoneyInput from '../../utils/MoneyInput';
import {
    Tractor, Plus, Check, Pencil, Trash2, Settings, ClipboardList,
    TrendingUp, TrendingDown, Fuel, Clock, Leaf, Box, FileText, Paperclip, X,
    Briefcase, StopCircle, Search, AlertTriangle, Calendar, Share2, Copy, Trash, Sparkles, Loader,
} from 'lucide-react';
import { GiBulldozer } from 'react-icons/gi';
import { TbBackhoe } from 'react-icons/tb';
import { guardarFactura, eliminarFactura, abrirFactura } from '../../utils/facturaAPI';
import { useSortable } from '../../utils/useSortable';

const IcoMaquina = ({ tipo, size = 22 }) => {
    if (tipo === 'Excavadora') return <TbBackhoe size={size} />;
    if (tipo === 'Bulldozer')  return <GiBulldozer size={size} />;
    return <Tractor size={size} />;
};

const TIPOS_TRABAJO = {
    Excavadora: ['Horas', 'Hectáreas', 'M³'],
    Bulldozer:  ['Horas', 'Hectáreas'],
};
const TODOS_TIPOS = [
    { key: 'Horas',     ico: <Clock size={22} />, uni: 'cant × valor/hora' },
    { key: 'Hectáreas', ico: <Leaf size={22} />,  uni: 'cant × valor/Ha' },
    { key: 'M³',        ico: <Box size={22} />,   uni: 'cant × valor/m³' },
];

const fmt = (v) => '$' + (Number(v) || 0).toLocaleString('es-CO');
const estadoClass = (e) => e === 'Activa' ? 'ea' : e === 'En mantenimiento' ? 'em' : 'ef';
const hoy = () => new Date().toISOString().split('T')[0];

const FORM_VACIO = { nombre: '', tipo: '', placa: '', horometroActual: 0, estado: 'Activa', operadorNombre: '', valorHoraOperador: 0, valorHoraMaquina: 0 };

function Maquinaria({ vistaInicial = 'lista' }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [maquinas, setMaquinas] = useState([]);
    const [vista, setVista] = useState(vistaInicial);
    const [maqActual, setMaqActual] = useState(null);
    const [form, setForm] = useState(FORM_VACIO);
    const [operadoresAPI, setOperadoresAPI] = useState([]);

    useEffect(() => {
        cargar();
        getOperadoresAPI().then(r => setOperadoresAPI(r.data || [])).catch(() => {});
    }, []);

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

    if (vista === 'detalle' && maqActual) {
        return <DetalleMaquina
            maquina={maqActual}
            onVolver={() => { cargar(); setVista('lista'); }}
            onEditar={() => { setForm({ ...maqActual }); setVista('editar'); }}
            onActualizar={(m) => setMaqActual(m)}
        />;
    }

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
                    <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><Tractor size={18} /> Datos de la máquina</h3>
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
                            <select className="fsel" name="operadorNombre" value={form.operadorNombre} onChange={hc}>
                                <option value="">— Sin operador —</option>
                                {operadoresAPI.map(o => (
                                    <option key={o.id} value={o.nombre}>{o.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div><label className="fl">Valor hora operador ($)</label><MoneyInput className="fi" name="valorHoraOperador" value={form.valorHoraOperador} onChange={hc} placeholder="Ej: 15.000" /></div>
                    </div>
                    <div className="fg2">
                        <div>
                            <label className="fl">Valor hora máquina al cliente ($)</label>
                            <MoneyInput className="fi" name="valorHoraMaquina" value={form.valorHoraMaquina} onChange={hc} placeholder="Ej: 180.000" />
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
                        <Check size={14} style={{marginRight:'6px',verticalAlign:'middle'}} />{vista === 'nueva' ? 'Registrar Máquina' : 'Guardar Cambios'}
                    </button>
                    <button className="bs" onClick={() => setVista('lista')}>Cancelar</button>
                </div>
            </div></div>
        </div>
    );

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Maquinaria</h1><p>Máquinas registradas</p></div>
                <button className="bp" onClick={() => { setForm(FORM_VACIO); setVista('nueva'); }}><Plus size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> Nueva Máquina</button>
            </div>
            <div className="content"><div className="pad">
                <div className="gm">
                    {maquinas.map(m => (
                        <div className="mcard" key={m.id} onClick={() => abrirDetalle(m)}>
                            <div className="mch">
                                <div className="mci"><IcoMaquina tipo={m.tipo} size={22} /></div>
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
                                    <button className="bs" style={{ flex: 1, textAlign: 'center', fontSize: '12px' }} onClick={(e) => abrirEditar(m, e)}><Pencil size={13} style={{marginRight:'4px',verticalAlign:'middle'}} /> Editar</button>
                                    <button className="bs" style={{ fontSize: '12px' }} onClick={(e) => eliminar(m.id, e)}><Trash2 size={13} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="nueva" onClick={() => { setForm(FORM_VACIO); setVista('nueva'); }}>
                        <Plus size={22} />
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>Nueva Máquina</span>
                    </div>
                </div>
            </div></div>
        </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════
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
    const [operadoresAPI, setOperadoresAPI] = useState([]);

    // Faena
    const [faenaActiva, setFaenaActiva] = useState(null);
    const [formFaena, setFormFaena] = useState({ nombreObra: '', cliente: '', fechaInicio: hoy(), nota: '' });
    const [mostrarFormFaena, setMostrarFormFaena] = useState(false);

    // Compartir
    const [modalCompartir, setModalCompartir] = useState(false);
    const [enlaces, setEnlaces] = useState([]);
    const [nombreEnlace, setNombreEnlace] = useState('');
    const [cargandoEnlaces, setCargandoEnlaces] = useState(false);

    // Búsqueda en tablas
    const [buscarIng, setBuscarIng] = useState('');
    const [buscarGas, setBuscarGas] = useState('');
    const [buscarComb, setBuscarComb] = useState('');

    useEffect(() => {
        getOperadoresAPI().then(r => setOperadoresAPI(r.data || [])).catch(() => {});
    }, []);

    // Registro trabajo
    const [tipoTrabajo, setTipoTrabajo] = useState('Horas');
    useEffect(() => {
        if (tipoTrabajo === 'Horas') setValorUnitario(String(maq.valorHoraMaquina || ''));
        else setValorUnitario('');
    }, [tipoTrabajo]);
    const [cantidad, setCantidad] = useState('');
    const [valorUnitario, setValorUnitario] = useState(String(maq.valorHoraMaquina || ''));
    const [fechaTrabajo, setFechaTrabajo] = useState(hoy());
    const [descTrabajo, setDescTrabajo] = useState('');

    // Gastos
    const GASTO_VACIO = { descripcion: '', monto: '', categoria: 'Reparación', fecha: hoy() };
    const [gastoForm, setGastoForm] = useState(GASTO_VACIO);
    const [gastoFactura, setGastoFactura] = useState(null);
    const [facturasIds, setFacturasIds] = useState(new Set());
    const [editandoGastoId, setEditandoGastoId] = useState(null);
    const [cargandoIA, setCargandoIA] = useState(false);

    const editarGasto = (g) => {
        setGastoForm({ descripcion: g.descripcion, monto: String(g.monto || ''), categoria: g.categoria || 'Reparación', fecha: g.fecha });
        setEditandoGastoId(g.id);
        setGastoFactura(null);
    };
    const cancelarEditar = () => { setEditandoGastoId(null); setGastoForm(GASTO_VACIO); setGastoFactura(null); };

    const leerConIA = async (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;
        setGastoFactura(archivo);
        setCargandoIA(true);
        try {
            const fd = new FormData();
            fd.append('file', archivo);
            const { data } = await leerFacturaIA(fd);
            console.log('IA respuesta:', data);
            const desc  = data.descripcion ?? '';
            const monto = data.monto != null ? String(data.monto) : '';
            const cat   = data.categoria ?? 'Reparación';
            const fecha = data.fecha ?? hoy();
            setGastoForm({ descripcion: desc, monto, categoria: cat, fecha });
            if (desc || monto) {
                toast(`Formulario llenado con IA — revisa y guarda`, 's');
            } else {
                toast('IA no pudo leer el documento. Ingresa los datos manualmente.', 'e');
            }
        } catch (err) {
            console.error('IA error:', err);
            toast('No se pudo leer el documento', 'e');
        } finally {
            setCargandoIA(false);
            e.target.value = '';
        }
    };

    // Combustible
    const [galones, setGalones] = useState('');
    const [precioPorGalon, setPrecioPorGalon] = useState('');
    const [fechaComb, setFechaComb] = useState(hoy());
    const [horoComb, setHoroComb] = useState(maq.horometroActual || 0);

    useEffect(() => { cargarTodo(); }, []);

    const cargarFaena = () =>
        getFaenaActiva(maq.nombre)
            .then(r => setFaenaActiva(r.data))
            .catch(() => setFaenaActiva(null));

    const cargarDatos = () => {
        getIngresos().then(r => setIngresos(r.data.filter(i => i.maquinaNombre === maq.nombre))).catch(console.error);
        getGastos().then(r => {
            const filtrados = r.data.filter(g => g.maquinaNombre === maq.nombre);
            setGastos(filtrados);
            setFacturasIds(new Set(filtrados.filter(g => g.tieneFactura).map(g => String(g.id))));
        }).catch(console.error);
        getCombustible().then(r => setCombustibles(r.data.filter(c => c.maquinaNombre === maq.nombre))).catch(console.error);
    };

    const cargarTodo = () => { cargarDatos(); cargarFaena(); };

    const abrirCompartir = () => {
        setModalCompartir(true);
        setCargandoEnlaces(true);
        getEnlaces().then(r => {
            const propios = (r.data || []).filter(e => e.maquinaNombre === maq.nombre);
            setEnlaces(propios);
        }).catch(() => {}).finally(() => setCargandoEnlaces(false));
    };

    const crearNuevoEnlace = () => {
        crearEnlace({ maquinaId: maq.id, nombre: nombreEnlace || `Enlace de ${maq.nombre}` })
            .then(r => { setEnlaces(prev => [...prev, r.data]); setNombreEnlace(''); toast('Enlace creado'); })
            .catch(() => toast('Error al crear enlace', 'e'));
    };

    const revocar = (token) => {
        revocarEnlace(token)
            .then(() => { setEnlaces(prev => prev.filter(e => e.token !== token)); toast('Enlace revocado'); })
            .catch(() => toast('Error al revocar', 'e'));
    };

    const copiarLink = (token) => {
        const url = `${window.location.origin}${window.location.pathname}?token=${token}`;
        navigator.clipboard.writeText(url).then(() => toast('Enlace copiado'));
    };

    // Filtrar por faena activa
    const ingFaena  = faenaActiva ? ingresos.filter(i => String(i.faenaId) === String(faenaActiva.id)) : [];
    const gasFaena  = faenaActiva ? gastos.filter(g => String(g.faenaId) === String(faenaActiva.id)) : [];
    const combFaena = faenaActiva ? combustibles.filter(c => String(c.faenaId) === String(faenaActiva.id)) : [];

    // Horas trabajadas en la faena actual
    const horasFaena = ingFaena.filter(i => i.tipoTrabajo === 'Horas').reduce((a, i) => a + (Number(i.cantidad) || 0), 0);

    // Totales de la faena
    const totalIngresos = ingFaena.reduce((a, i) => a + (i.total || 0), 0);
    const totalGastos   = gasFaena.reduce((a, g) => a + (g.monto || 0), 0);

    const ingFiltrados  = ingFaena.filter(i =>
        !buscarIng || i.descripcion?.toLowerCase().includes(buscarIng.toLowerCase()) || i.tipoTrabajo?.toLowerCase().includes(buscarIng.toLowerCase())
    );
    const gasFiltrados  = gasFaena.filter(g =>
        !buscarGas || g.descripcion?.toLowerCase().includes(buscarGas.toLowerCase()) || g.categoria?.toLowerCase().includes(buscarGas.toLowerCase())
    );
    const combFiltrados = combFaena.filter(c =>
        !buscarComb || String(c.galones).includes(buscarComb) || c.fecha?.includes(buscarComb)
    );
    const { sorted: ingOrdenados,  Th: ThIng  } = useSortable(ingFiltrados,  'fecha', 'desc');
    const { sorted: gasOrdenados,  Th: ThGas  } = useSortable(gasFiltrados,  'fecha', 'desc');
    const { sorted: combOrdenados, Th: ThComb } = useSortable(combFiltrados, 'fecha', 'desc');

    const tiposPermitidos = TIPOS_TRABAJO[maq.tipo] || ['Horas'];
    const totalTrabajo = parseFloat(cantidad || 0) * parseFloat(valorUnitario || 0);
    const nuevoHoro = tipoTrabajo === 'Horas' ? (maq.horometroActual || 0) + parseFloat(cantidad || 0) : maq.horometroActual;
    const totalComb = parseFloat(galones || 0) * parseFloat(precioPorGalon || 0);

    const registrarTrabajo = () => {
        if (!cantidad || !valorUnitario) return toast('Completa cantidad y valor unitario', 'e');
        const payload = {
            maquinaNombre: maq.nombre, tipoTrabajo, cantidad: parseFloat(cantidad),
            valorUnitario: parseFloat(valorUnitario),
            total: parseFloat(cantidad) * parseFloat(valorUnitario),
            fecha: fechaTrabajo, descripcion: descTrabajo || `${tipoTrabajo} – ${maq.nombre}`
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
                    const operadorObjetivo = operadoresAPI.find(o => o.nombre === maq.operadorNombre);
                    promises.push(
                        createHora({
                            operador_id:     operadorObjetivo?.id || null,
                            operadorNombre:  maq.operadorNombre,
                            maquinaNombre:   maq.nombre,
                            fecha:           fechaTrabajo,
                            horas:           parseFloat(cantidad),
                            valorHora:       maq.valorHoraOperador || 0,
                            horometroInicio: maq.horometroActual || 0,
                            horometroFin:    nuevoHoro,
                        })
                    );
                }
            }
            return Promise.all(promises);
        }).then(() => {
            cargarTodo();
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
            cargarTodo();
            setGalones(''); setPrecioPorGalon('');
            toast('Carga de combustible registrada');
        }).catch(console.error);
    };

    const eliminarIngreso = async (id) => {
        if (await confirm('¿Eliminar este ingreso?')) deleteIngreso(id).then(cargarTodo).catch(console.error);
    };
    const eliminarGasto = async (id) => {
        if (await confirm('¿Eliminar este gasto?')) {
            await deleteGasto(id).catch(console.error);
            await eliminarFactura(id).catch(() => {});
            setFacturasIds(prev => { const s = new Set(prev); s.delete(String(id)); return s; });
            cargarTodo();
        }
    };
    const eliminarComb = async (id) => {
        if (await confirm('¿Eliminar esta carga?')) deleteCombustible(id).then(cargarTodo).catch(console.error);
    };

    const abrirFaena = async () => {
        if (!formFaena.nombreObra.trim()) return toast('Escribe el nombre de la obra', 'e');
        if (maq.estado !== 'Activa') {
            toast(`Máquina en estado "${maq.estado}" — actualiza el estado si ya está operativa`, 'w');
        }
        await createFaena({ ...formFaena, maquinaNombre: maq.nombre }).catch(console.error);
        toast('Periodo abierto — los registros quedan en cero');
        setMostrarFormFaena(false);
        setFormFaena({ nombreObra: '', cliente: '', fechaInicio: hoy(), nota: '' });
        cargarTodo();
    };

    const handleCerrarFaena = async () => {
        if (!faenaActiva) return;
        const ok = await confirm(
            `¿Rendir cuentas y cerrar el periodo "${faenaActiva.nombreObra}"?\n\nSe archivará el resumen financiero y los registros de esta máquina volverán a cero.`
        );
        if (!ok) return;
        await cerrarFaena(faenaActiva.id).catch(console.error);
        setFaenaActiva(null);
        toast('Periodo cerrado — registros en cero. Abre un nuevo periodo cuando la máquina salga.');
        cargarTodo();
    };

    const TABS = [
        <><ClipboardList size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Resumen</>,
        <><Settings size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Trabajo</>,
        <><TrendingUp size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Ingresos</>,
        <><TrendingDown size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Gastos</>,
        <><Fuel size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Combustible</>,
        <><Briefcase size={14} style={{marginRight:'5px',verticalAlign:'middle'}} />Periodo</>,
    ];

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>{maq.nombre}</h1><p>Detalle financiero y operativo</p></div>
                <div className="tb-r">
                    <button className="bs" onClick={onVolver}>← Volver</button>
                    <button className="bs" onClick={abrirCompartir}><Share2 size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> Compartir</button>
                    <button className="bp" onClick={onEditar}><Pencil size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> Editar</button>
                </div>
            </div>
            <div className="content"><div className="pad">

                {/* HEADER */}
                <div className="dh">
                    <div className="dhi"><IcoMaquina tipo={maq.tipo} size={28} /></div>
                    <div>
                        <h2>{maq.nombre}</h2>
                        <p>Placa: {maq.placa} · Operador: {maq.operadorNombre || '—'} · {fmt(maq.valorHoraOperador)}/hr operador · {fmt(maq.valorHoraMaquina || 0)}/hr máquina</p>
                    </div>
                    <div className="dhb">
                        <span className={`b ${maq.estado === 'Activa' ? 'ok' : maq.estado === 'En mantenimiento' ? 'pend' : 'falla'}`}>
                            <span className="ed" style={{ background: maq.estado === 'Activa' ? '#27ae60' : maq.estado === 'En mantenimiento' ? '#e8941a' : '#e74c3c' }}></span>
                            {maq.estado}
                        </span>
                        <span className="b comp" style={{display:'inline-flex',alignItems:'center',gap:'4px'}}>
                            <Clock size={12} /> {(maq.horometroActual || 0).toLocaleString('es-CO')} hrs horómetro
                        </span>
                        {faenaActiva
                            ? <span className="b ok" style={{display:'inline-flex',alignItems:'center',gap:'4px'}}>
                                <span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#27ae60',display:'inline-block'}}></span>
                                Periodo: {faenaActiva.nombreObra}
                              </span>
                            : <span className="b falla" style={{display:'inline-flex',alignItems:'center',gap:'4px'}}>
                                <Briefcase size={11} /> Sin periodo activo
                              </span>
                        }
                    </div>
                </div>

                {/* Sin faena: alerta */}
                {!faenaActiva && (
                    <div className="ale" style={{ background: '#fff3e0', borderColor: '#e67e22' }}>
                        <AlertTriangle size={18} color="#e67e22" />
                        <div>
                            <p>Esta máquina no tiene periodo activo</p>
                            <span className="ale-desc">Ve a la pestaña <strong>Periodo</strong> para abrir uno cuando la máquina salga a trabajar. Sin periodo activo los registros quedan en cero.</span>
                        </div>
                    </div>
                )}

                {/* TABS */}
                <div className="tabs">
                    {TABS.map((t, i) => <button key={i} className={`tab ${tab === i ? 'on' : ''}`} onClick={() => setTab(i)}>{t}</button>)}
                </div>

                {/* TAB 0 — RESUMEN */}
                {tab === 0 && (
                    <>
                        <div className="g4">
                            <div className="card green"><span className="ci"><TrendingUp size={22} /></span><div className="cl">Ingresos periodo</div><div className="cv">{fmt(totalIngresos)}</div><div className="cs">{faenaActiva ? faenaActiva.nombreObra : 'sin periodo activo'}</div></div>
                            <div className="card red"><span className="ci"><TrendingDown size={22} /></span><div className="cl">Gastos periodo</div><div className="cv">{fmt(totalGastos)}</div><div className="cs">acumulados</div></div>
                            <div className="card gold"><span className="ci"><TrendingUp size={22} /></span><div className="cl">Utilidad</div><div className="cv" style={{ color: totalIngresos - totalGastos >= 0 ? '#27ae60' : '#e74c3c' }}>{fmt(totalIngresos - totalGastos)}</div><div className="cs">ingresos − gastos</div></div>
                            <div className="card blue"><span className="ci"><Clock size={22} /></span><div className="cl">Horas periodo</div><div className="cv xl" style={{ color: '#2980b9' }}>{horasFaena.toLocaleString('es-CO')}</div><div className="cs">trabajadas en este periodo</div></div>
                        </div>
                        <div className="g2">
                            <div className="tbl">
                                <div className="th"><strong style={{display:'flex',alignItems:'center',gap:'5px'}}><TrendingUp size={14} /> Últimos Ingresos</strong></div>
                                <div className="tr hdr"><span>Fecha</span><span className="w2">Descripción</span><span>Total</span></div>
                                {ingOrdenados.slice(0, 5).map(i => <div className="tr" key={i.id}><span>{i.fecha}</span><span className="w2">{i.descripcion}</span><span className="pos">{fmt(i.total)}</span></div>)}
                                {ingOrdenados.length === 0 && <p className="vacio">Sin ingresos en este periodo</p>}
                            </div>
                            <div className="tbl">
                                <div className="th"><strong style={{display:'flex',alignItems:'center',gap:'5px'}}><TrendingDown size={14} /> Últimos Gastos</strong></div>
                                <div className="tr hdr"><span>Fecha</span><span className="w2">Descripción</span><span>Total</span></div>
                                {gasOrdenados.slice(0, 5).map(g => <div className="tr" key={g.id}><span>{g.fecha}</span><span className="w2">{g.descripcion}</span><span className="neg">{fmt(g.monto)}</span></div>)}
                                {gasOrdenados.length === 0 && <p className="vacio">Sin gastos en este periodo</p>}
                            </div>
                        </div>
                    </>
                )}

                {/* TAB 1 — REGISTRO TRABAJO */}
                {tab === 1 && (
                    <>
                        {!faenaActiva && (
                            <div className="ale" style={{ background: '#fff3e0', borderColor: '#e67e22' }}>
                                <AlertTriangle size={16} color="#e67e22" />
                                <div><p style={{margin:0}}>Sin periodo activo — el registro se guardará pero no quedará en ningún periodo</p></div>
                            </div>
                        )}
                        <div className="fc">
                            <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><Settings size={18} /> Registrar trabajo</h3>
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
                                <div><label className="fl">Valor unitario ($)</label><MoneyInput className="fi" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} placeholder="Ej: 120.000" /></div>
                            </div>
                            <div className="fg2">
                                <div><label className="fl">Fecha</label><input className="fi" type="date" value={fechaTrabajo} onChange={e => setFechaTrabajo(e.target.value)} /></div>
                                <div><label className="fl">Descripción (opcional)</label><input className="fi" value={descTrabajo} onChange={e => setDescTrabajo(e.target.value)} placeholder="Ej: Obra Av. 30" /></div>
                            </div>
                            <div className="rsum">
                                <h4 style={{display:'flex',alignItems:'center',gap:'6px'}}><ClipboardList size={16} /> Resumen antes de guardar</h4>
                                <div className="rr"><span>Tipo</span><span>{tipoTrabajo}</span></div>
                                <div className="rr"><span>Cantidad</span><span>{cantidad || 0} unidades</span></div>
                                <div className="rr"><span>Valor unitario</span><span>{fmt(parseFloat(valorUnitario || 0))}</span></div>
                                {tipoTrabajo === 'Horas' && <div className="rr"><span>Horómetro: antes → después</span><span style={{ color: '#2980b9' }}>{maq.horometroActual || 0} → {nuevoHoro} hrs</span></div>}
                                <div className="rr"><span>Total ingreso</span><span className="pos">{fmt(totalTrabajo)}</span></div>
                            </div>
                            <div className="rbox">
                                <div><div className="rl">Total calculado</div><div className="rv">{fmt(totalTrabajo)}</div><div className="rf">{cantidad || 0} × {fmt(parseFloat(valorUnitario || 0))} = {fmt(totalTrabajo)}</div></div>
                                <div style={{ textAlign: 'right' }}><div style={{ color: '#6b7a8d', fontSize: '11px' }}>Se agrega a</div><div style={{ color: '#f5a623', fontSize: '12px', fontWeight: '700', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'4px' }}><TrendingUp size={13} /> Ingresos + Horómetro</div></div>
                            </div>
                            <button className="bp" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={registrarTrabajo}>
                                <Check size={14} style={{marginRight:'6px',verticalAlign:'middle'}} /> Confirmar y Guardar
                            </button>
                        </div>
                        <div className="tbl">
                            <div className="th"><strong>Trabajos en este periodo</strong></div>
                            <div className="tr hdr">
                                <ThIng campo="fecha">Fecha</ThIng>
                                <ThIng campo="tipoTrabajo">Tipo</ThIng>
                                <ThIng campo="cantidad">Cantidad</ThIng>
                                <ThIng campo="total">Total</ThIng>
                                <span>Acc.</span>
                            </div>
                            {ingOrdenados.map(i => (
                                <div className="tr" key={i.id}>
                                    <span>{i.fecha}</span>
                                    <span><span className="b hrs">{i.tipoTrabajo}</span></span>
                                    <span>{i.cantidad}</span>
                                    <span className="pos">{fmt(i.total)}</span>
                                    <span><button className="icon-btn" onClick={() => eliminarIngreso(i.id)}><Trash2 size={14} /></button></span>
                                </div>
                            ))}
                            {ingOrdenados.length === 0 && <p className="vacio">Sin registros en este periodo</p>}
                        </div>
                    </>
                )}

                {/* TAB 2 — INGRESOS */}
                {tab === 2 && (
                    <div className="tbl">
                        <div className="th">
                            <strong style={{display:'flex',alignItems:'center',gap:'5px'}}><TrendingUp size={14} /> Ingresos — {faenaActiva ? faenaActiva.nombreObra : 'sin periodo'}</strong>
                            <div className="th-s"><Search size={14} /><input type="text" placeholder="Buscar..." value={buscarIng} onChange={e => setBuscarIng(e.target.value)} /></div>
                        </div>
                        <div className="tr hdr">
                            <ThIng campo="fecha">Fecha</ThIng>
                            <ThIng campo="descripcion" className="w2">Descripción</ThIng>
                            <ThIng campo="tipoTrabajo">Tipo</ThIng>
                            <ThIng campo="total">Total</ThIng>
                            <span>Acc.</span>
                        </div>
                        {ingOrdenados.map(i => (
                            <div className="tr" key={i.id}>
                                <span>{i.fecha}</span><span className="w2">{i.descripcion}</span>
                                <span><span className="b hrs">{i.tipoTrabajo}</span></span>
                                <span className="pos">{fmt(i.total)}</span>
                                <span><button className="icon-btn" onClick={() => eliminarIngreso(i.id)}><Trash2 size={14} /></button></span>
                            </div>
                        ))}
                        {ingOrdenados.length === 0 && <p className="vacio">Sin ingresos en este periodo</p>}
                    </div>
                )}

                {/* TAB 3 — GASTOS */}
                {tab === 3 && (
                    <>
                        <div className="fc">
                            <h3 style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}>
                                <span style={{display:'flex',alignItems:'center',gap:'8px'}}><TrendingDown size={18} /> {editandoGastoId ? 'Editar gasto' : 'Registrar gasto'}</span>
                                <label style={{cursor: cargandoIA ? 'wait' : 'pointer'}}>
                                    <span className={`bs${cargandoIA ? ' disabled' : ''}`} style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'6px 12px',fontSize:'12px',pointerEvents: cargandoIA ? 'none' : 'auto', background: cargandoIA ? '#f0f4f8' : undefined}}>
                                        {cargandoIA
                                            ? <><Loader size={12} style={{animation:'spin 1s linear infinite'}} /> Leyendo...</>
                                            : <><Sparkles size={12} color="#8e44ad" /> Leer con IA</>}
                                    </span>
                                    <input type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={leerConIA} disabled={cargandoIA} />
                                </label>
                            </h3>
                            <div className="fg2">
                                <div><label className="fl">Descripción *</label><input className="fi" value={gastoForm.descripcion} onChange={e => setGastoForm({ ...gastoForm, descripcion: e.target.value })} placeholder="Ej: Cambio de manguera" /></div>
                                <div>
                                    <label className="fl">Categoría</label>
                                    <select className="fsel" value={gastoForm.categoria} onChange={e => setGastoForm({ ...gastoForm, categoria: e.target.value })}>
                                        <option>Otros</option><option>Repuestos</option><option>Lubricantes</option><option>Combustible</option><option>Reparación</option>
                                    </select>
                                </div>
                            </div>
                            <div className="fg2">
                                <div><label className="fl">Monto ($) *</label><MoneyInput className="fi" value={gastoForm.monto} onChange={e => setGastoForm({ ...gastoForm, monto: e.target.value })} placeholder="Ej: 250.000" /></div>
                                <div><label className="fl">Fecha</label><input className="fi" type="date" value={gastoForm.fecha} onChange={e => setGastoForm({ ...gastoForm, fecha: e.target.value })} /></div>
                            </div>
                            <div>
                                <label className="fl">Factura (PDF)</label>
                                {editandoGastoId && facturasIds.has(String(editandoGastoId)) && !gastoFactura ? (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <div className="fi" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                            <FileText size={14} style={{ color: '#e74c3c', flexShrink: 0 }} />
                                            <span style={{ fontSize: '13px', flex: 1 }}>Factura adjunta</span>
                                            <button type="button" className="icon-btn" title="Ver factura" onClick={() => abrirFactura(editandoGastoId)}>
                                                <FileText size={13} style={{ color: '#e74c3c' }} />
                                            </button>
                                        </div>
                                        <label className="bs" style={{ cursor: 'pointer', padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                            <Paperclip size={13} /> Cambiar
                                            <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => setGastoFactura(e.target.files[0] || null)} />
                                        </label>
                                        <button className="bs" style={{ padding: '6px 10px', fontSize: '12px', color: '#e74c3c', whiteSpace: 'nowrap' }}
                                            onClick={async () => { await eliminarFactura(editandoGastoId).catch(() => {}); setFacturasIds(prev => { const s = new Set(prev); s.delete(String(editandoGastoId)); return s; }); }}>
                                            × Quitar
                                        </button>
                                    </div>
                                ) : (
                                    <label className="fi" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Paperclip size={14} style={{ color: gastoFactura ? '#2980b9' : '#9aa5b4', flexShrink: 0 }} />
                                        <span style={{ color: gastoFactura ? '#1a1a2e' : '#9aa5b4', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                            {gastoFactura ? gastoFactura.name : 'Adjuntar factura (opcional)'}
                                        </span>
                                        {gastoFactura && (
                                            <span style={{ color: '#e74c3c', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}
                                                onClick={e => { e.preventDefault(); setGastoFactura(null); }}>×</span>
                                        )}
                                        <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => setGastoFactura(e.target.files[0] || null)} />
                                    </label>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="bp" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={async () => {
                                    if (!gastoForm.descripcion || !gastoForm.monto) return toast('Completa descripción y monto', 'e');
                                    if (editandoGastoId) {
                                        const res = await updateGasto(editandoGastoId, { ...gastoForm, maquinaNombre: maq.nombre, monto: parseFloat(gastoForm.monto) }).catch(console.error);
                                        if (!res) return;
                                        if (gastoFactura) {
                                            await guardarFactura(editandoGastoId, gastoFactura).catch(console.error);
                                            setFacturasIds(prev => new Set([...prev, String(editandoGastoId)]));
                                        }
                                        cancelarEditar(); cargarTodo(); toast('Gasto actualizado');
                                    } else {
                                        const res = await createGasto({ ...gastoForm, maquinaNombre: maq.nombre, monto: parseFloat(gastoForm.monto) }).catch(console.error);
                                        if (!res) return;
                                        if (gastoFactura && res.data?.id) {
                                            await guardarFactura(res.data.id, gastoFactura).catch(console.error);
                                            setFacturasIds(prev => new Set([...prev, String(res.data.id)]));
                                        }
                                        setGastoForm(GASTO_VACIO); setGastoFactura(null); cargarTodo(); toast('Gasto registrado');
                                    }
                                }}>
                                    <Check size={14} style={{marginRight:'6px',verticalAlign:'middle'}} />
                                    {editandoGastoId ? 'Guardar cambios' : 'Registrar Gasto'}
                                </button>
                                {editandoGastoId && <button className="bs" onClick={cancelarEditar}>Cancelar</button>}
                            </div>
                        </div>
                        <div className="tbl">
                            <div className="th">
                                <strong style={{display:'flex',alignItems:'center',gap:'5px'}}><TrendingDown size={14} /> Gastos — {faenaActiva ? faenaActiva.nombreObra : 'sin periodo'}</strong>
                                <div className="th-s"><Search size={14} /><input type="text" placeholder="Buscar..." value={buscarGas} onChange={e => setBuscarGas(e.target.value)} /></div>
                            </div>
                            <div className="tr hdr">
                                <ThGas campo="fecha">Fecha</ThGas>
                                <ThGas campo="descripcion" className="w2">Descripción</ThGas>
                                <ThGas campo="categoria">Categoría</ThGas>
                                <ThGas campo="monto">Total</ThGas>
                                <span>Acc.</span>
                            </div>
                            {gasOrdenados.map(g => (
                                <div className="tr" key={g.id}>
                                    <span>{g.fecha}</span><span className="w2">{g.descripcion}</span>
                                    <span>{g.categoria}</span>
                                    <span className="neg">{fmt(g.monto)}</span>
                                    <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        {facturasIds.has(String(g.id)) && (
                                            <button className="icon-btn" title="Ver factura" onClick={() => abrirFactura(g.id)}>
                                                <FileText size={14} style={{ color: '#e74c3c' }} />
                                            </button>
                                        )}
                                        <label className="icon-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Paperclip size={14} style={{ color: facturasIds.has(String(g.id)) ? '#e67e22' : '#9aa5b4' }} />
                                            <input type="file" accept="application/pdf" style={{ display: 'none' }}
                                                onChange={async e => {
                                                    if (e.target.files[0]) {
                                                        await guardarFactura(g.id, e.target.files[0]).catch(console.error);
                                                        setFacturasIds(prev => new Set([...prev, String(g.id)]));
                                                        toast('Factura actualizada');
                                                    }
                                                }} />
                                        </label>
                                        {facturasIds.has(String(g.id)) && (
                                            <button className="icon-btn" onClick={async () => {
                                                await eliminarFactura(g.id).catch(() => {});
                                                setFacturasIds(prev => { const s = new Set(prev); s.delete(String(g.id)); return s; });
                                            }}><X size={14} style={{ color: '#9aa5b4' }} /></button>
                                        )}
                                        <button className="icon-btn" onClick={() => editarGasto(g)}><Pencil size={14} /></button>
                                        <button className="icon-btn" onClick={() => eliminarGasto(g.id)}><Trash2 size={14} /></button>
                                    </span>
                                </div>
                            ))}
                            {gasOrdenados.length === 0 && <p className="vacio">Sin gastos en este periodo</p>}
                        </div>
                    </>
                )}

                {/* TAB 4 — COMBUSTIBLE */}
                {tab === 4 && (
                    <>
                        <div className="fc">
                            <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><Fuel size={18} /> Registrar carga de combustible</h3>
                            <p className="fd">El gasto se crea automáticamente en Finanzas</p>
                            <div className="fg3">
                                <div><label className="fl">Galones</label><input className="fi" type="number" value={galones} onChange={e => setGalones(e.target.value)} placeholder="Ej: 50" /></div>
                                <div><label className="fl">Precio/galón ($)</label><MoneyInput className="fi" value={precioPorGalon} onChange={e => setPrecioPorGalon(e.target.value)} placeholder="Ej: 12.500" /></div>
                                <div><label className="fl">Horómetro al cargar</label><input className="fi" type="number" value={horoComb} onChange={e => setHoroComb(e.target.value)} /></div>
                            </div>
                            <div className="fg2">
                                <div><label className="fl">Fecha</label><input className="fi" type="date" value={fechaComb} onChange={e => setFechaComb(e.target.value)} /></div>
                            </div>
                            <div className="rbox">
                                <div><div className="rl">Total del gasto</div><div className="rv">{fmt(totalComb)}</div><div className="rf">{galones || 0} gal × {fmt(parseFloat(precioPorGalon || 0))}</div></div>
                                <div style={{ textAlign: 'right' }}><div style={{ color: '#6b7a8d', fontSize: '11px' }}>Se agrega a</div><div style={{ color: '#e74c3c', fontSize: '12px', fontWeight: '700', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'4px' }}><TrendingDown size={13} /> Gastos de esta máquina</div></div>
                            </div>
                            <button className="bp" style={{ width: '100%', justifyContent: 'center', padding: '12px', background: '#e67e22' }} onClick={registrarCombustible}>
                                <Fuel size={14} style={{marginRight:'6px',verticalAlign:'middle'}} /> Registrar Carga
                            </button>
                        </div>
                        <div className="tbl">
                            <div className="th">
                                <strong>Combustible — {faenaActiva ? faenaActiva.nombreObra : 'sin periodo'}</strong>
                                <div className="th-s"><Search size={14} /><input type="text" placeholder="Buscar..." value={buscarComb} onChange={e => setBuscarComb(e.target.value)} /></div>
                            </div>
                            <div className="tr hdr">
                                <ThComb campo="fecha">Fecha</ThComb>
                                <ThComb campo="galones">Galones</ThComb>
                                <ThComb campo="precioPorGalon">$/Galón</ThComb>
                                <span>Horómetro</span>
                                <ThComb campo="total">Total</ThComb>
                                <span>Acc.</span>
                            </div>
                            {combOrdenados.map(c => (
                                <div className="tr" key={c.id}>
                                    <span>{c.fecha}</span><span>{c.galones} gal</span>
                                    <span>{fmt(c.precioPorGalon)}</span>
                                    <span>{c.horometro || '—'}</span>
                                    <span className="neg">{fmt(c.total)}</span>
                                    <span><button className="icon-btn" onClick={() => eliminarComb(c.id)}><Trash2 size={14} /></button></span>
                                </div>
                            ))}
                            {combOrdenados.length === 0 && <p className="vacio">Sin cargas en este periodo</p>}
                        </div>
                    </>
                )}

                {/* TAB 5 — FAENA */}
                {tab === 5 && (
                    <div>
                        {faenaActiva ? (
                            <>
                                {/* Faena activa: info + resumen + cerrar */}
                                <div style={{ background: '#fff8e7', border: '1px solid #f5a623', borderRadius: '10px', padding: '16px', marginBottom: '14px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27ae60', display: 'inline-block' }}></span>
                                                <strong style={{ fontSize: '15px' }}>{faenaActiva.nombreObra}</strong>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6b7a8d', marginTop: '6px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                                                {faenaActiva.cliente && <span>Cliente: {faenaActiva.cliente}</span>}
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={11} /> Inicio: {faenaActiva.fechaInicio}
                                                </span>
                                            </div>
                                            {faenaActiva.nota && <p style={{ fontSize: '12px', color: '#6b7a8d', marginTop: '4px' }}>{faenaActiva.nota}</p>}
                                        </div>
                                        <span className="b ok">En campo</span>
                                    </div>

                                    {/* Resumen en tiempo real */}
                                    <div className="g4" style={{ marginTop: '14px' }}>
                                        <div style={{ background: '#f0faf4', border: '1px solid #a8d5b5', borderRadius: '8px', padding: '10px 14px' }}>
                                            <div style={{ fontSize: '11px', color: '#27ae60', fontWeight: '700' }}>Ingresos</div>
                                            <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", color: '#27ae60' }}>{fmt(totalIngresos)}</div>
                                        </div>
                                        <div style={{ background: '#fdf3f3', border: '1px solid #f5c6c6', borderRadius: '8px', padding: '10px 14px' }}>
                                            <div style={{ fontSize: '11px', color: '#e74c3c', fontWeight: '700' }}>Gastos</div>
                                            <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", color: '#e74c3c' }}>{fmt(totalGastos)}</div>
                                        </div>
                                        <div style={{ background: '#f0f4f8', border: '1px solid #c8d6e5', borderRadius: '8px', padding: '10px 14px' }}>
                                            <div style={{ fontSize: '11px', color: '#2980b9', fontWeight: '700' }}>Horas</div>
                                            <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", color: '#2980b9' }}>{horasFaena}</div>
                                        </div>
                                        <div style={{ background: '#fffbf0', border: '1px solid #f5e0a0', borderRadius: '8px', padding: '10px 14px' }}>
                                            <div style={{ fontSize: '11px', color: '#e67e22', fontWeight: '700' }}>Utilidad</div>
                                            <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", color: totalIngresos - totalGastos >= 0 ? '#27ae60' : '#e74c3c' }}>{fmt(totalIngresos - totalGastos)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="ale" style={{ background: '#fdf3f3', borderColor: '#e74c3c' }}>
                                    <StopCircle size={18} color="#e74c3c" />
                                    <div>
                                        <p>Rendir cuentas — cerrar periodo</p>
                                        <span className="ale-desc">Al confirmar, se archivará el resumen financiero y los registros de esta máquina volverán a cero. El periodo quedará guardado en el módulo <strong>Periodos</strong>.</span>
                                    </div>
                                </div>
                                <button className="bp" style={{ background: '#c0392b', width: '100%', justifyContent: 'center', padding: '13px', marginTop: '10px' }}
                                    onClick={handleCerrarFaena}>
                                    <StopCircle size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                                    Rendir cuentas / Cerrar periodo
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="ale" style={{ background: '#e8f0fe', borderColor: '#2980b9' }}>
                                    <Briefcase size={18} color="#2980b9" />
                                    <div>
                                        <p>No hay periodo activo para {maq.nombre}</p>
                                        <span className="ale-desc">Cuando la máquina salga a trabajar, abre un periodo. Todos los ingresos, gastos y horas quedarán registrados en ese periodo hasta que se rindan cuentas.</span>
                                    </div>
                                </div>

                                {!mostrarFormFaena ? (
                                    <button className="bp" style={{ width: '100%', justifyContent: 'center', padding: '13px', marginTop: '10px' }}
                                        onClick={() => setMostrarFormFaena(true)}>
                                        <Plus size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                                        Abrir nuevo periodo
                                    </button>
                                ) : (
                                    <div className="fc" style={{ marginTop: '10px' }}>
                                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Briefcase size={18} /> Abrir periodo para {maq.nombre}
                                        </h3>
                                        <div className="fg2">
                                            <div>
                                                <label className="fl">Nombre de la obra *</label>
                                                <input className="fi" value={formFaena.nombreObra}
                                                    onChange={e => setFormFaena({ ...formFaena, nombreObra: e.target.value })}
                                                    placeholder="Ej: Carretera Vía Caucasia" />
                                            </div>
                                            <div>
                                                <label className="fl">Cliente</label>
                                                <input className="fi" value={formFaena.cliente}
                                                    onChange={e => setFormFaena({ ...formFaena, cliente: e.target.value })}
                                                    placeholder="Ej: Municipio de..." />
                                            </div>
                                        </div>
                                        <div className="fg2">
                                            <div>
                                                <label className="fl">Fecha inicio</label>
                                                <input className="fi" type="date" value={formFaena.fechaInicio}
                                                    onChange={e => setFormFaena({ ...formFaena, fechaInicio: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="fl">Nota (opcional)</label>
                                                <input className="fi" value={formFaena.nota}
                                                    onChange={e => setFormFaena({ ...formFaena, nota: e.target.value })}
                                                    placeholder="Observaciones" />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button className="bp" onClick={abrirFaena}>
                                                <Check size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Abrir periodo
                                            </button>
                                            <button className="bs" onClick={() => setMostrarFormFaena(false)}>Cancelar</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

            </div></div>
        </div>

        {/* Modal Compartir */}
        {modalCompartir && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '80vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', color: '#1a2d42' }}>
                            <Share2 size={18} /> Compartir vista de solo lectura
                        </h3>
                        <button onClick={() => setModalCompartir(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa5b4' }}><X size={18} /></button>
                    </div>
                    <p style={{ color: '#6b7a8d', fontSize: '13px', marginBottom: '16px' }}>
                        Genera un enlace que muestra los datos de <strong>{maq.nombre}</strong> en modo solo lectura. Ideal para socios o contadores.
                    </p>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                        <input
                            className="fi"
                            style={{ flex: 1, margin: 0 }}
                            placeholder="Etiqueta (ej: Para el contador)"
                            value={nombreEnlace}
                            onChange={e => setNombreEnlace(e.target.value)}
                        />
                        <button className="bp" onClick={crearNuevoEnlace} style={{ whiteSpace: 'nowrap' }}>
                            <Plus size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Crear
                        </button>
                    </div>

                    {cargandoEnlaces ? (
                        <p style={{ color: '#9aa5b4', fontSize: '13px', textAlign: 'center' }}>Cargando…</p>
                    ) : enlaces.length === 0 ? (
                        <p style={{ color: '#c8d6e5', fontSize: '13px', textAlign: 'center' }}>Sin enlaces activos</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {enlaces.map(e => (
                                <div key={e.token} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: '600', fontSize: '13px', color: '#1a2d42' }}>{e.nombre}</div>
                                        <div style={{ fontSize: '11px', color: '#9aa5b4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {window.location.origin}/?token={e.token}
                                        </div>
                                    </div>
                                    <button className="bs" onClick={() => copiarLink(e.token)} title="Copiar enlace" style={{ padding: '6px 10px' }}>
                                        <Copy size={13} />
                                    </button>
                                    <button onClick={() => revocar(e.token)} title="Revocar" style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#e74c3c' }}>
                                        <Trash size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
        </>
    );
}

export default Maquinaria;
