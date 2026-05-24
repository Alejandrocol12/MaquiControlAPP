import { useState, useEffect } from 'react';
import { getHoras, getSalarios, getMaquinas, deleteHora, deleteSalario, createOperadorAPI, deleteOperadorAPI, createUsuario, getOperadoresAPI, getPeriodoActivoAPI, getUsuarios } from '../../api';
import DetalleOperador from './DetalleOperador';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import { HardHat, Clock, TrendingDown, AlertTriangle, Plus, Check, Eye, Trash2, Tractor, Briefcase, Info } from 'lucide-react';
import { GiBulldozer } from 'react-icons/gi';
import { TbBackhoe } from 'react-icons/tb';

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

        if (!nombre) return toast('El nombre es obligatorio', 'e');
        if (form.crearAcceso && !email) return toast('El correo es obligatorio para crear acceso', 'e');
        if (form.crearAcceso && form.password.length < 6) return toast('La clave del operador debe tener al menos 6 caracteres', 'e');

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
        const horasOp    = todasHoras.filter(h => h.operadorNombre === op.nombre);
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
            : totalHoras;

        const salarioBruto  = horasPeriodo * valorHora;
        const anticipos     = periodoActivo?.anticipos || 0;
        const salarioNeto   = salarioBruto - anticipos;

        const salOp         = salarios.filter(s => s.operadorNombre === op.nombre);
        const hayPendiente  = salOp.some(s => s.estado === 'Pendiente');

        const iniciales     = op.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        return { ...op, maq, totalHoras, horasPeriodo, valorHora, salarioBruto, anticipos, salarioNeto, hayPendiente, iniciales };
    });

    // Stats globales
    const totalHorasGlobal = ops.reduce((a, o) => a + o.totalHoras, 0);
    const pendientes       = ops.filter(o => o.hayPendiente).length;
    const sinMaquina       = ops.filter(o => !o.maq).length;

    if (opSel) return <DetalleOperador operador={opSel} onVolver={() => { cargar(); setOpSel(null); }} />;

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Operadores</h1><p>Personal registrado y su estado operativo</p></div>
                <button className="bp" onClick={() => setMostrarForm(!mostrarForm)}><Plus size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> Nuevo Operador</button>
            </div>

            <div className="content"><div className="pad">

                {/* CARDS RESUMEN */}
                <div className="g3">
                    <div className="card gold">
                        <span className="ci"><HardHat size={22} /></span>
                        <div className="cl">Total operadores</div>
                        <div className="cv">{operadores.length}</div>
                        <div className="cs">{sinMaquina > 0 ? `${sinMaquina} sin máquina asignada` : 'todos asignados'}</div>
                    </div>
                    <div className="card blue">
                        <span className="ci"><Clock size={22} /></span>
                        <div className="cl">Horas acumuladas</div>
                        <div className="cv">{totalHorasGlobal.toLocaleString('es-CO')}</div>
                        <div className="cs">entre todos los operadores</div>
                    </div>
                    <div className="card red">
                        <span className="ci"><TrendingDown size={22} /></span>
                        <div className="cl">Salarios pendientes</div>
                        <div className="cv">{pendientes}</div>
                        <div className="cs">{operadores.length - pendientes} al día</div>
                    </div>
                </div>

                {/* ALERTA operadores sin máquina */}
                {sinMaquina > 0 && (
                    <div className="ale">
                        <AlertTriangle size={18} />
                        <div>
                            <p>{sinMaquina} operador(es) sin máquina asignada</p>
                            <span className="ale-desc">Ve a Maquinaria → editar máquina → asignar operador</span>
                        </div>
                    </div>
                )}

                {/* FORM NUEVO */}
                {mostrarForm && (
                    <div className="fc">
                        <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><HardHat size={18} /> Registrar Operador</h3>
                        <p className="fd">Solo datos personales — la máquina y valor/hora se asignan desde el módulo Maquinaria</p>
                        <div className="fg2">
                            <div><label className="fl">Nombre completo *</label>
                                <input className="fi" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Carlos Pérez" />
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
                                    <input className="fi" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="operador@mail.com" />
                                </div>
                                <div>
                                    <label className="fl">Contrasena inicial *</label>
                                    <input className="fi" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimo 6 caracteres" />
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={registrar} disabled={registrando}><Check size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> {registrando ? 'Registrando...' : 'Registrar'}</button>
                            <button className="bs" onClick={() => setMostrarForm(false)}>Cancelar</button>
                        </div>
                    </div>
                )}

                {operadores.length === 0 && !mostrarForm && (
                    <div className="ale">
                        <Info size={20} />
                        <div><p>No hay operadores registrados</p><span className="ale-desc">Haz clic en "Nuevo Operador" para agregar uno</span></div>
                    </div>
                )}

                {/* GRID OPERADORES */}
                <div className="og">
                    {ops.map(op => (
                        <div className="oc" key={op.id} onClick={() => setOpSel(op)} style={{ cursor: 'pointer' }}>
                            <div className="oav">{op.iniciales}</div>
                            <div className="onm">{op.nombre}</div>

                            {/* Máquina asignada */}
                            <div className="omq">
                                {op.maq ? <><IcoMaquina tipo={op.maq.tipo} size={12} /><span style={{marginLeft:'4px'}}>{op.maq.nombre}</span></> : <><AlertTriangle size={12} style={{verticalAlign:'middle',marginRight:'4px'}} />Sin máquina</>}
                                {op.valorHora > 0 && ` · ${fmt(op.valorHora)}/hr`}
                            </div>

                            {/* Horas período actual */}
                            <div className="ohr">{op.horasPeriodo.toLocaleString('es-CO')}</div>
                            <div className="ohl">horas en período · {fmt(op.salarioBruto)} bruto</div>

                            {/* Anticipos si hay */}
                            {op.anticipos > 0 && (
                                <div style={{ fontSize: '11px', color: '#e74c3c', marginTop: '2px' }}>
                                    {fmt(op.anticipos)} anticipos → neto {fmt(op.salarioNeto)}
                                </div>
                            )}

                            {/* Estado */}
                            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <span className={`b ${op.hayPendiente ? 'pend' : 'ok'}`}>
                                    {op.hayPendiente ? 'Salario pendiente' : 'Al día'}
                                </span>
                                <button className="icon-btn" title="Ver detalle" onClick={e => { e.stopPropagation(); setOpSel(op); }}><Eye size={14} /></button>
                                <button className="icon-btn" title="Eliminar" onClick={e => { e.stopPropagation(); eliminar(op.id); }}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}

                    <div className="nueva" style={{ minHeight: '130px' }} onClick={() => setMostrarForm(true)}>
                        <Plus size={20} />
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>Nuevo Operador</span>
                    </div>
                </div>

                {/* TABLA RESUMEN SALARIOS */}
                {salarios.length > 0 && (
                    <>
                        <div className="st" style={{ marginTop: '20px' }}>Historial de Salarios</div>
                        <div className="tbl">
                            <div className="th"><strong style={{display:'flex',alignItems:'center',gap:'5px'}}><Briefcase size={14} /> Liquidaciones registradas</strong></div>
                            <div className="tr hdr">
                                <span className="w2">Operador</span>
                                <span>Máquina</span>
                                <span>Horas</span>
                                <span>Bruto</span>
                                <span>Descuentos</span>
                                <span>Neto</span>
                                <span>Estado</span>
                            </div>
                            {salarios.map(s => (
                                <div className="tr" key={s.id}>
                                    <span className="w2">{s.operadorNombre}</span>
                                    <span>{s.maquinaNombre}</span>
                                    <span>{s.horasTrabajadas} hrs</span>
                                    <span className="pos">{fmt(s.totalBruto)}</span>
                                    <span className="neg">{fmt(s.descuentos || 0)}</span>
                                    <span className="pos" style={{ fontWeight: '700' }}>{fmt(s.totalNeto)}</span>
                                    <span><span className={`b ${s.estado === 'Pagado' ? 'ok' : 'pend'}`}>{s.estado}</span></span>
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

export default Operadores;
