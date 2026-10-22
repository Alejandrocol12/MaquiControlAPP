import { useState, useEffect } from 'react';
import { getHoras, getSalarios, getMaquinas, deleteHora, deleteSalario, createOperadorAPI, deleteOperadorAPI, createUsuario, getOperadoresAPI, getPeriodoActivoAPI, getUsuarios } from '../../api';
import { useSortable } from '../../utils/useSortable';
import DetalleOperador from './DetalleOperador';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import { useErrores, ErrorCampo } from '../../utils/useErrores';
import { HardHat, Clock, TrendingDown, AlertTriangle, Plus, Check, Eye, Trash2, Tractor, Briefcase, Info, Search, X, List, LayoutGrid } from 'lucide-react';
import Monto from '../../utils/Monto';
import { GiBulldozer } from 'react-icons/gi';
import { TbBackhoe } from 'react-icons/tb';
import './Operadores.css';
import './OperadoresModerno.css';

const TIPO_COLOR = { 'Excavadora': '#2980b9', 'Bulldozer': '#e67e22', 'Volqueta': '#8e44ad', 'Grúa': '#c0392b' };
const tipoColor = (tipo) => TIPO_COLOR[tipo] || '#27ae60';

const IcoMaquina = ({ tipo, size = 12 }) => {
    if (tipo === 'Excavadora') return <TbBackhoe size={size} />;
    if (tipo === 'Bulldozer')  return <GiBulldozer size={size} />;
    return <Tractor size={size} />;
};

const fmt = (v) => '$' + (v || 0).toLocaleString('es-CO');
const FORM_VACIO = {
    nombre: '',
    cedula: '',
    telefono: '',
    email: '',
    observaciones: '',
    crearAcceso: false,
    password: '',
};

function Operadores() {
    const toast = useToast();
    const errOp = useErrores();
    const { confirm, ConfirmUI } = useConfirm();
    const [operadores, setOperadores] = useState([]);
    const [maquinas, setMaquinas]     = useState([]);
    const [todasHoras, setTodasHoras] = useState([]);
    const [salarios, setSalarios]     = useState([]);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [form, setForm]               = useState(FORM_VACIO);
    const [registrando, setRegistrando] = useState(false);
    const [opSel, setOpSel]             = useState(null);
    const [periodosActivos, setPeriodosActivos] = useState({});
    const [buscar, setBuscar]           = useState('');
    const [opTab, setOpTab]             = useState(0);
    const [vista, setVista]             = useState('tarjetas');
    const [filtro, setFiltro]           = useState('todos');
    const [orden, setOrden]             = useState('saldo');

    const cargar = async () => {
        try {
            const [opsRes, maqRes, horasRes, salariosRes] = await Promise.all([
                getOperadoresAPI(),
                getMaquinas(),
                getHoras(),
                getSalarios(),
            ]);

            const operadoresApi = opsRes.data || [];
            setOperadores(operadoresApi);
            setMaquinas(maqRes.data);
            setTodasHoras(horasRes.data);
            setSalarios(salariosRes.data);

            const periodosEntries = await Promise.all(
                operadoresApi.map(async (op) => {
                    try {
                        const { data } = await getPeriodoActivoAPI(op.id);
                        return [op.id, data || null];
                    } catch {
                        return [op.id, null];
                    }
                })
            );
            setPeriodosActivos(Object.fromEntries(periodosEntries));
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { cargar(); }, []);

    const registrar = async () => {
        if (registrando) return;

        const nombre = form.nombre.trim();
        const email = form.email.trim().toLowerCase();
        const cedula = form.cedula.trim();
        const telefono = form.telefono.trim();
        const observaciones = form.observaciones.trim();

        if (!errOp.validar([
            { campo: 'opNombre', ok: !!nombre, msg: 'Escribe el nombre del operador' },
            { campo: 'opEmail', ok: !form.crearAcceso || !!email, msg: 'Para crearle acceso necesita un correo' },
            { campo: 'opPass', ok: !form.crearAcceso || form.password.length >= 6, msg: 'La clave debe tener al menos 6 caracteres' },
        ])) return;

        try {
            setRegistrando(true);

            if (form.crearAcceso) {
                const { data: usuarios } = await getUsuarios();
                const correoExiste = (usuarios || []).some((user) => String(user.email || '').toLowerCase() === email);
                if (correoExiste) {
                    toast('Ese correo ya tiene una cuenta. Usa otro correo o registra el operador sin acceso.', 'e');
                    return;
                }
            }

            const payloadOperador = {
                nombre,
                cedula,
                telefono,
                email,
                observaciones,
            };
            const { data: operadorApi } = await createOperadorAPI(payloadOperador);

            if (form.crearAcceso) {
                try {
                    await createUsuario({
                        nombre,
                        empresa: 'MaquiControl Operaciones',
                        email,
                        password: form.password,
                        rol: 'operador',
                        operadorId: operadorApi.id,
                    });
                } catch (accesoErr) {
                    await cargar();
                    setMostrarForm(false);
                    setForm(FORM_VACIO);
                    toast(`Operador registrado, pero no se pudo crear el acceso: ${accesoErr.response?.data?.error || 'revisa el correo y la clave'}`, 'e');
                    return;
                }
            }

            cargar();
            setMostrarForm(false);
            setForm(FORM_VACIO);
            toast(form.crearAcceso ? 'Operador y acceso creados' : 'Operador registrado');
        } catch (err) {
            toast(err.response?.data?.error || 'No se pudo registrar el operador', 'e');
        } finally {
            setRegistrando(false);
        }
    };

    const eliminar = (id) => {
        confirm('¿Eliminar este operador y todos sus datos (horas, salarios, períodos)?').then(ok => {
            if (!ok) return;
            const op = operadores.find(o => o.id === id);
            if (!op) return;
            // Borrar horas y salarios del backend por nombre del operador
            const horasOp = todasHoras.filter(h => h.operadorNombre === op.nombre);
            const salsOp  = salarios.filter(s => s.operadorNombre === op.nombre);
            Promise.all([
                ...horasOp.map(h => deleteHora(h.id)),
                ...salsOp.map(s => deleteSalario(s.id)),
                deleteOperadorAPI(id).catch(() => null),
            ]).then(() => {
                cargar();
                toast(`Operador ${op.nombre} eliminado`);
            }).catch(console.error);
        });
    };

    // Enriquecer cada operador con datos de la API
    const ops = operadores.map(op => {
        const maq        = maquinas.find(m => m.operadorNombre === op.nombre);
        const horasOp    = todasHoras.filter(h =>  (h.operadorNombre || '').toLowerCase() === (op.nombre || '').toLowerCase());
        const totalHoras = horasOp.reduce((a, h) => a + (h.horas || 0), 0);
        const valorHora  = maq?.valorHoraOperador || 0;

        // Horas del período activo
        const periodoActivo = periodosActivos[op.id] || null;
        const horasPeriodo  = periodoActivo
            ? horasOp
                .filter(h => (periodoActivo.desde_hora_id != null || periodoActivo.desdeHoraId != null)
                    ? Number(h.id) > Number(periodoActivo.desde_hora_id ?? periodoActivo.desdeHoraId)
                    : h.fecha >= (periodoActivo.fecha_inicio ?? periodoActivo.fechaInicio))
                .reduce((a, h) => a + (h.horas || 0), 0)
            : 0;

        const salarioBruto  = horasPeriodo * valorHora;
        const anticipos     = periodoActivo?.anticipos || 0;
        const salarioNeto   = salarioBruto - anticipos;

        const salOp         = salarios.filter(s => s.operadorNombre === op.nombre);
        const hayPendiente  = salOp.some(s => s.estado === 'Pendiente');

        const iniciales     = op.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        return { ...op, maq, totalHoras, horasPeriodo, valorHora, salarioBruto, anticipos, salarioNeto, hayPendiente, iniciales };
    });

    // Stats globales
    const totalHorasGlobal = ops.reduce((a, o) => a + o.horasPeriodo, 0);
    const pendientes       = ops.filter(o => o.hayPendiente).length;
    const sinMaquina       = ops.filter(o => !o.maq).length;
    const nominaNeta       = ops.reduce((a, o) => a + o.salarioNeto, 0);
    const nominaPendiente  = ops.filter(o => o.hayPendiente).reduce((a, o) => a + o.salarioNeto, 0);
    const maxHorasPeriodo  = Math.max(1, ...ops.map(o => o.horasPeriodo));

    const q = buscar.toLowerCase();
    const porPagar = (o) => (o.hayPendiente ? Math.max(0, o.salarioNeto) : 0);
    const opsFiltrados = ops
        .filter(o => !q || o.nombre.toLowerCase().includes(q) || (o.cedula || '').includes(q))
        .filter(o => filtro === 'todos' || (filtro === 'saldo' ? o.hayPendiente : !o.hayPendiente))
        .sort((a, b) => orden === 'nombre' ? a.nombre.localeCompare(b.nombre, 'es')
            : orden === 'horas' ? b.horasPeriodo - a.horasPeriodo
            : porPagar(b) - porPagar(a) || a.nombre.localeCompare(b.nombre, 'es'));

    const { sorted: salOrdenados, Th: ThSal } = useSortable(salarios, 'operadorNombre', 'asc');

    const abrirFicha = (op, tab = 0) => { setOpTab(tab); setOpSel(op); };

    if (opSel) return <DetalleOperador operador={opSel} tabInicial={opTab} onVolver={() => { cargar(); setOpSel(null); }} />;

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Operadores</h1><p>Personal registrado y su estado operativo</p></div>
                <button className="bp" onClick={() => setMostrarForm(!mostrarForm)}><Plus size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> Nuevo Operador</button>
            </div>

            <div className="content"><div className="pad op-zona">

                {/* HERO KPIs */}
                <div className="op-hero">
                    <div className="op-kpi gold">
                        <div className="op-kpi-top"><span className="op-kpi-label">Personal</span><span className="op-kpi-ico"><HardHat size={14} /></span></div>
                        <div className="op-kpi-val">{operadores.length}</div>
                        <div className="op-kpi-sub">{sinMaquina > 0 ? `${sinMaquina} sin máquina asignada` : 'todos asignados'}</div>
                    </div>
                    <div className="op-kpi info">
                        <div className="op-kpi-top"><span className="op-kpi-label">Horas del periodo</span><span className="op-kpi-ico"><Clock size={14} /></span></div>
                        <div className="op-kpi-val op-num">{totalHorasGlobal.toLocaleString('es-CO')}</div>
                        <div className="op-kpi-sub">en periodos activos</div>
                    </div>
                    <div className="op-kpi bad">
                        <div className="op-kpi-top"><span className="op-kpi-label">Nómina pendiente</span><span className="op-kpi-ico"><TrendingDown size={14} /></span></div>
                        <div className="op-kpi-val op-num"><Monto v={nominaPendiente} /></div>
                        <div className="op-kpi-sub">{pendientes} operador{pendientes !== 1 ? 'es' : ''} por liquidar</div>
                    </div>
                    <div className="op-kpi profit">
                        <div className="op-kpi-top"><span className="op-kpi-label">Nómina neta del periodo</span><span className="op-kpi-ico"><HardHat size={14} /></span></div>
                        <div className="op-kpi-val op-num"><Monto v={nominaNeta} /></div>
                        <div className="op-kpi-sub">bruto − anticipos, los {operadores.length} operadores</div>
                    </div>
                </div>

                {/* ALERTA operadores sin máquina */}
                {sinMaquina > 0 && (
                    <div className="ale" style={{ marginBottom: '20px' }}>
                        <AlertTriangle size={18} />
                        <div>
                            <p>{sinMaquina} operador{sinMaquina !== 1 ? 'es' : ''} sin máquina asignada</p>
                            <span className="ale-desc">Ve a Maquinaria → editar máquina → asignar operador</span>
                        </div>
                    </div>
                )}

                {/* FORM NUEVO */}
                {mostrarForm && (
                    <div className="opm-fondo" onMouseDown={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
                    <div className="opm-modal" role="dialog" aria-modal="true" aria-labelledby="opm-titulo">
                        <header className="opm-cab">
                            <span className="opm-ico" aria-hidden="true"><HardHat size={20} /></span>
                            <div>
                                <h3 id="opm-titulo">Registrar operador</h3>
                                <p>Solo datos personales: la máquina y el valor por hora se asignan desde Maquinaria</p>
                            </div>
                            <button type="button" className="opm-x" aria-label="Cerrar" onClick={() => setMostrarForm(false)}><X size={18} /></button>
                        </header>
                        <div className="opm-cuerpo">
                        <div className="fg2">
                            <div><label className="fl">Nombre completo *</label>
                                <input className={errOp.clase('fi', 'opNombre')} {...errOp.props('opNombre')} value={form.nombre} onChange={e => { setForm({ ...form, nombre: e.target.value }); errOp.limpiar('opNombre'); }} placeholder="Ej: Carlos Pérez" />
                                <ErrorCampo msg={errOp.errores.opNombre} />
                            </div>
                            <div><label className="fl">Cédula</label>
                                <input className="fi" value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} placeholder="Ej: 1234567890" />
                            </div>
                        </div>
                        <div className="fg2">
                            <div><label className="fl">Teléfono</label>
                                <input className="fi" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="Ej: 3001234567" />
                            </div>
                            <div><label className="fl">Correo electrónico</label>
                                <input className="fi" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Ej: carlos@mail.com" />
                            </div>
                        </div>
                        <div><label className="fl">Observaciones</label>
                            <input className="fi" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} placeholder="Ej: Licencia C2, experiencia en excavadoras" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <input
                                id="crear-acceso-operador"
                                type="checkbox"
                                checked={form.crearAcceso}
                                onChange={e => setForm({ ...form, crearAcceso: e.target.checked })}
                            />
                            <label htmlFor="crear-acceso-operador" style={{ fontSize: '13px', fontWeight: '600', color: '#1a2d42' }}>
                                Crear acceso al portal del operador
                            </label>
                        </div>
                        {form.crearAcceso && (
                            <div className="fg2">
                                <div>
                                    <label className="fl">Correo de acceso *</label>
                                    <input className={errOp.clase('fi', 'opEmail')} {...errOp.props('opEmail')} type="email" value={form.email} onChange={e => { setForm({ ...form, email: e.target.value }); errOp.limpiar('opEmail'); }} placeholder="operador@mail.com" />
                                    <ErrorCampo msg={errOp.errores.opEmail} />
                                </div>
                                <div>
                                    <label className="fl">Contrasena inicial *</label>
                                    <input className={errOp.clase('fi', 'opPass')} {...errOp.props('opPass')} type="password" value={form.password} onChange={e => { setForm({ ...form, password: e.target.value }); errOp.limpiar('opPass'); }} placeholder="Mínimo 6 caracteres" />
                                    <ErrorCampo msg={errOp.errores.opPass} />
                                </div>
                            </div>
                        )}
                        </div>
                        <footer className="opm-pie">
                            <button type="button" className="opm-cancelar" onClick={() => setMostrarForm(false)}>Cancelar</button>
                            <button type="button" className="opm-guardar" onClick={registrar} disabled={registrando}><Check size={16} aria-hidden="true" /> {registrando ? 'Registrando…' : 'Registrar operador'}</button>
                        </footer>
                    </div>
                    </div>
                )}

                {operadores.length === 0 && !mostrarForm && (
                    <div className="ale">
                        <Info size={20} />
                        <div><p>No hay operadores registrados</p><span className="ale-desc">Haz clic en "Nuevo Operador" para agregar uno</span></div>
                    </div>
                )}

                {/* ROSTER DE OPERADORES */}
                {operadores.length > 0 && (
                    <section className="opm-roster">
                        <header className="opm-rh">
                            <div className="opm-rh-t">
                                <h2>Roster de operadores</h2>
                                <span className="opm-n">{operadores.length}</span>
                                <div className="opm-vista" role="group" aria-label="Vista">
                                    <button type="button" className={vista === 'lista' ? 'on' : ''} aria-pressed={vista === 'lista'} aria-label="Ver como lista" onClick={() => setVista('lista')}><List size={16} /></button>
                                    <button type="button" className={vista === 'tarjetas' ? 'on' : ''} aria-pressed={vista === 'tarjetas'} aria-label="Ver como tarjetas" onClick={() => setVista('tarjetas')}><LayoutGrid size={16} /></button>
                                </div>
                            </div>
                            <div className="opm-rh-f">
                                <div className="opm-seg" role="group" aria-label="Filtrar por saldo">
                                    {[['todos', 'Todos'], ['saldo', 'Con saldo'], ['dia', 'Al día']].map(([k, l]) => (
                                        <button key={k} type="button" className={filtro === k ? 'on' : ''} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l}</button>
                                    ))}
                                </div>
                                <select className="opm-sel" aria-label="Ordenar" value={orden} onChange={e => setOrden(e.target.value)}>
                                    <option value="saldo">Mayor saldo pendiente</option>
                                    <option value="horas">Más horas</option>
                                    <option value="nombre">Nombre</option>
                                </select>
                                <div className="op-search"><Search size={14} color="#93a2b3" /><input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre o cédula" aria-label="Buscar operador" /></div>
                            </div>
                        </header>

                        {vista === 'tarjetas' && (opsFiltrados.length === 0
                            ? <p className="vacio">Sin resultados con esos filtros</p>
                            : (
                                <div className="opm-grid">
                                    {opsFiltrados.map(op => (
                                        <article className={`opm-card ${op.hayPendiente ? 'pend' : ''}`} key={op.id}>
                                            <div className="opm-card-top">
                                                <div className={`op-avatar ${!op.maq ? 'dim' : ''}`}>{op.iniciales}</div>
                                                <div className="opm-card-id">
                                                    <b>{op.nombre}</b>
                                                    <small>{op.cedula ? `C.C. ${op.cedula}` : 'Sin cédula'}</small>
                                                </div>
                                                <span className={`op-pill ${!op.maq ? 'none' : op.hayPendiente ? 'pend' : 'ok'}`}>{!op.maq ? 'Sin asignar' : op.hayPendiente ? 'Con saldo' : 'Al día'}</span>
                                            </div>
                                            <div className="opm-maq">
                                                {op.maq
                                                    ? <><span className="opm-maq-n"><IcoMaquina tipo={op.maq.tipo} size={15} /> {op.maq.nombre}</span><span className="opm-maq-v">{fmt(op.valorHora)}/hr</span></>
                                                    : <span className="op-unassigned"><AlertTriangle size={11} />Sin máquina asignada</span>}
                                            </div>
                                            <div className="opm-stats">
                                                <div><span>Horas</span><b>{op.maq ? `${op.horasPeriodo.toLocaleString('es-CO')} h` : '—'}</b></div>
                                                <div><span>Ganado</span><b className="vd"><Monto v={op.salarioBruto} /></b></div>
                                                <div className={porPagar(op) > 0 ? 'deuda' : ''}><span>Por pagar</span><b className={porPagar(op) > 0 ? 'rj' : ''}><Monto v={porPagar(op)} /></b></div>
                                            </div>
                                            <div className="opm-card-pie">
                                                <button type="button" className="opm-del" aria-label={`Eliminar a ${op.nombre}`} onClick={() => eliminar(op.id)}><Trash2 size={15} /></button>
                                                <span className="opm-acc">
                                                    {porPagar(op) > 0 && <button type="button" className="opm-pagar" onClick={() => abrirFicha(op, 3)}>$ Pagar</button>}
                                                    <button type="button" className="opm-ficha" onClick={() => abrirFicha(op)}>Ficha</button>
                                                </span>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ))}
                    </section>
                )}
                {operadores.length > 0 && vista === 'lista' && (
                    <div className="op-panel op-scrollx">
                        <div className="op-scroll-inner" style={{ minWidth: 760 }}>
                            <div className="op-ros-head"><span>Operador</span><span>Máquina asignada</span><span>Horas del periodo</span><span>Bruto → Anticipos → Neto</span><span>Estado</span></div>
                            {opsFiltrados.map(op => (
                                <div className={`op-ros-row ${!op.maq ? 'empty' : ''}`} key={op.id} onClick={() => abrirFicha(op)}>
                                    <div className="op-who">
                                        <div className={`op-avatar ${!op.maq ? 'dim' : ''}`}>{op.iniciales}</div>
                                        <div><div className="op-who-name">{op.nombre}</div><div className="op-who-sub">{op.cedula ? `C.C. ${op.cedula}` : 'Sin cédula'}</div></div>
                                    </div>
                                    <div className="op-maq">
                                        <span className="op-flabel">Máquina asignada</span>
                                        {op.maq ? (
                                            <>
                                                <span className="op-maq-ico" style={{ background: tipoColor(op.maq.tipo) }}><IcoMaquina tipo={op.maq.tipo} size={13} /></span>
                                                <div className="op-maq-info"><div className="t">{op.maq.nombre}</div><div className="r">{fmt(op.valorHora)}/hr</div></div>
                                            </>
                                        ) : (
                                            <span className="op-unassigned"><AlertTriangle size={11} />Sin asignar</span>
                                        )}
                                    </div>
                                    <div className="op-hrs">
                                        <span className="op-flabel">Horas del periodo</span>
                                        <div className="hv">{op.maq ? `${op.horasPeriodo.toLocaleString('es-CO')} hrs` : '— hrs'}</div>
                                        <div className="op-util-track"><div className="op-util-fill" style={{ width: `${Math.round((op.horasPeriodo / maxHorasPeriodo) * 100)}%` }}></div></div>
                                    </div>
                                    <div>
                                        <span className="op-flabel">Bruto → Anticipos → Neto</span>
                                        {op.maq && (op.salarioBruto > 0 || op.anticipos > 0) ? (
                                            <div className="op-pay">
                                                <span className="g">{fmt(op.salarioBruto)}</span>
                                                <span className="arrow">→</span>
                                                <span className="m">−{fmt(op.anticipos)}</span>
                                                <span className="arrow">→</span>
                                                <span className="n">{fmt(op.salarioNeto)}</span>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '11.5px', color: '#93a2b3' }}>Sin actividad este periodo</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                        <span className={`op-pill ${!op.maq ? 'none' : op.hayPendiente ? 'pend' : 'ok'}`}><i></i>{!op.maq ? 'Sin asignar' : op.hayPendiente ? 'Pendiente' : 'Al día'}</span>
                                        <div className="op-actions" onClick={e => e.stopPropagation()}>
                                            <button className="op-iconbtn" title="Ver detalle" onClick={() => abrirFicha(op)}><Eye size={14} /></button>
                                            <button className="op-iconbtn" title="Eliminar" onClick={() => eliminar(op.id)}><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {opsFiltrados.length === 0 && <p className="vacio">Sin resultados para "{buscar}"</p>}
                        </div>
                    </div>
                )}

                {/* HISTORIAL DE LIQUIDACIONES */}
                {salarios.length > 0 && (
                    <div>
                        <div className="op-panel-head" style={{ padding: '0 0 10px', border: 'none' }}>
                            <h2 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><Briefcase size={15} />Historial de liquidaciones</h2>
                        </div>
                        <div className="op-panel op-scrollx">
                            <div className="op-scroll-inner" style={{ minWidth: 640 }}>
                                <div className="op-lrow-head">
                                    <ThSal campo="operadorNombre">Operador</ThSal>
                                    <ThSal campo="maquinaNombre">Máquina</ThSal>
                                    <ThSal campo="horasTrabajadas">Horas</ThSal>
                                    <ThSal campo="totalBruto">Bruto</ThSal>
                                    <ThSal campo="descuentos">Anticipos</ThSal>
                                    <ThSal campo="totalNeto">Neto</ThSal>
                                    <ThSal campo="estado">Estado</ThSal>
                                </div>
                                {salOrdenados.map(s => (
                                    <div className="op-lrow" key={s.id}>
                                        <span style={{ fontWeight: 600, color: '#1a2d42' }}>{s.operadorNombre}</span>
                                        <span style={{ color: '#6b7a8d' }}><span className="op-flabel">Máquina</span>{s.maquinaNombre}</span>
                                        <span className="op-money op-num"><span className="op-flabel">Horas</span>{s.horasTrabajadas} hrs</span>
                                        <span className="op-money op-num"><span className="op-flabel">Bruto</span>{fmt(s.totalBruto)}</span>
                                        <span className="op-money op-num neg"><span className="op-flabel">Anticipos</span>−{fmt(s.descuentos || 0)}</span>
                                        <span className="op-money op-num pos"><span className="op-flabel">Neto</span>{fmt(s.totalNeto)}</span>
                                        <span><span className={`op-pill ${s.estado === 'Pagado' ? 'ok' : 'pend'}`}><i></i>{s.estado}</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div></div>
        </div>
        </>
    );
}

export default Operadores;
