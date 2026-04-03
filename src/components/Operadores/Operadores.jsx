import { useState, useEffect } from 'react';
import { getHoras, getSalarios, getMaquinas, deleteHora, deleteSalario } from '../../api';
import { getOperadores, addOperador, deleteOperador, getPeriodoActivo } from '../../utils/localDB';
import DetalleOperador from './DetalleOperador';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';

const fmt = (v) => '$' + (v || 0).toLocaleString('es-CO');
const FORM_VACIO = { nombre: '', cedula: '', telefono: '', email: '', observaciones: '' };

function Operadores() {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [operadores, setOperadores] = useState([]);
    const [maquinas, setMaquinas]     = useState([]);
    const [todasHoras, setTodasHoras] = useState([]);
    const [salarios, setSalarios]     = useState([]);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [form, setForm]               = useState(FORM_VACIO);
    const [opSel, setOpSel]             = useState(null);

    const cargar = () => {
        setOperadores(getOperadores());
        getMaquinas().then(r => setMaquinas(r.data)).catch(console.error);
        getHoras().then(r => setTodasHoras(r.data)).catch(console.error);
        getSalarios().then(r => setSalarios(r.data)).catch(console.error);
    };

    useEffect(() => { cargar(); }, []);

    const registrar = () => {
        if (!form.nombre) return toast('El nombre es obligatorio', 'e');
        addOperador(form);
        cargar();
        setMostrarForm(false);
        setForm(FORM_VACIO);
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
            ]).then(() => {
                deleteOperador(id);
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
        const periodoActivo = getPeriodoActivo(op.id);
        const horasPeriodo  = periodoActivo
            ? horasOp
                .filter(h => periodoActivo.desdeHoraId != null
                    ? h.id > periodoActivo.desdeHoraId
                    : h.fecha >= periodoActivo.fechaInicio)
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
                <button className="bp" onClick={() => setMostrarForm(!mostrarForm)}>➕ Nuevo Operador</button>
            </div>

            <div className="content"><div className="pad">

                {/* CARDS RESUMEN */}
                <div className="g3">
                    <div className="card gold">
                        <span className="ci">👷</span>
                        <div className="cl">Total operadores</div>
                        <div className="cv">{operadores.length}</div>
                        <div className="cs">{sinMaquina > 0 ? `${sinMaquina} sin máquina asignada` : 'todos asignados'}</div>
                    </div>
                    <div className="card blue">
                        <span className="ci">⏱️</span>
                        <div className="cl">Horas acumuladas</div>
                        <div className="cv">{totalHorasGlobal.toLocaleString('es-CO')}</div>
                        <div className="cs">entre todos los operadores</div>
                    </div>
                    <div className="card red">
                        <span className="ci">💸</span>
                        <div className="cl">Salarios pendientes</div>
                        <div className="cv">{pendientes}</div>
                        <div className="cs">{operadores.length - pendientes} al día</div>
                    </div>
                </div>

                {/* ALERTA operadores sin máquina */}
                {sinMaquina > 0 && (
                    <div className="ale">
                        <span style={{ fontSize: '18px' }}>⚠️</span>
                        <div>
                            <p>{sinMaquina} operador(es) sin máquina asignada</p>
                            <span className="ale-desc">Ve a Maquinaria → editar máquina → asignar operador</span>
                        </div>
                    </div>
                )}

                {/* FORM NUEVO */}
                {mostrarForm && (
                    <div className="fc">
                        <h3>👷 Registrar Operador</h3>
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
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" onClick={registrar}>✅ Registrar</button>
                            <button className="bs" onClick={() => setMostrarForm(false)}>Cancelar</button>
                        </div>
                    </div>
                )}

                {operadores.length === 0 && !mostrarForm && (
                    <div className="ale">
                        <span style={{ fontSize: '20px' }}>ℹ️</span>
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
                                {op.maq ? `🚜 ${op.maq.nombre}` : '⚠️ Sin máquina'}
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
                                <button className="icon-btn" title="Ver detalle" onClick={e => { e.stopPropagation(); setOpSel(op); }}>👁️</button>
                                <button className="icon-btn" title="Eliminar" onClick={e => { e.stopPropagation(); eliminar(op.id); }}>🗑️</button>
                            </div>
                        </div>
                    ))}

                    <div className="nueva" style={{ minHeight: '130px' }} onClick={() => setMostrarForm(true)}>
                        <span style={{ fontSize: '20px' }}>➕</span>
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>Nuevo Operador</span>
                    </div>
                </div>

                {/* TABLA RESUMEN SALARIOS */}
                {salarios.length > 0 && (
                    <>
                        <div className="st" style={{ marginTop: '20px' }}>Historial de Salarios</div>
                        <div className="tbl">
                            <div className="th"><strong>💼 Liquidaciones registradas</strong></div>
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
