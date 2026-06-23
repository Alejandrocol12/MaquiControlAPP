import { useState, useEffect } from 'react';
import { usePaginacion, Paginacion } from '../../utils/Paginacion';
import { useSortable } from '../../utils/useSortable';
import { useDateRange, DateRangePicker } from '../../utils/useDateRange';
import { getMaquinas, getCombustible, createCombustible, deleteCombustible } from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import { Fuel, Droplets, ClipboardList, Plus, Trash2, Tractor, TrendingDown, Search } from 'lucide-react';
import { GiBulldozer } from 'react-icons/gi';
import { TbBackhoe } from 'react-icons/tb';
import MoneyInput from '../../utils/MoneyInput';

const IcoMaquina = ({ tipo, size = 22 }) => {
    if (tipo === 'Excavadora') return <TbBackhoe size={size} />;
    if (tipo === 'Bulldozer')  return <GiBulldozer size={size} />;
    return <Tractor size={size} />;
};

const fmt = (v) => '$' + (v || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().split('T')[0];

function Combustible() {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [maquinas, setMaquinas]       = useState([]);
    const [registros, setRegistros]     = useState([]);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [buscar, setBuscar] = useState('');
    const [form, setForm] = useState({ maquinaNombre: '', galones: '', precioPorGalon: '', horometro: '', fecha: hoy() });

    useEffect(() => { cargar(); }, []);

    const cargar = () => {
        getMaquinas().then(r => setMaquinas(r.data)).catch(console.error);
        getCombustible().then(r => setRegistros(r.data)).catch(console.error);
    };

    const registrar = () => {
        if (!form.maquinaNombre || !form.galones || !form.precioPorGalon) return toast('Completa máquina, galones y precio', 'e');
        createCombustible({
            maquinaNombre: form.maquinaNombre,
            galones: parseFloat(form.galones),
            precioPorGalon: parseFloat(form.precioPorGalon),
            horometro: parseFloat(form.horometro || 0),
            fecha: form.fecha,
        }).then(() => { cargar(); setMostrarForm(false); setForm({ maquinaNombre: '', galones: '', precioPorGalon: '', horometro: '', fecha: hoy() }); })
          .catch(console.error);
    };

    const eliminar = async (id) => {
        if (await confirm('¿Eliminar esta carga de combustible?')) deleteCombustible(id).then(cargar).catch(console.error);
    };

    const porTexto = registros.filter(r => !buscar || r.maquinaNombre?.toLowerCase().includes(buscar.toLowerCase()));
    const { filtrado: porRango, desde, setDesde, hasta, setHasta } = useDateRange(porTexto, 'fecha');
    const { sorted: registrosFiltrados, Th } = useSortable(porRango, 'fecha', 'desc');
    const pagComb = usePaginacion(registrosFiltrados);

    const totalGasto   = registros.reduce((a, r) => a + (r.total || r.galones * r.precioPorGalon || 0), 0);
    const totalGalones = registros.reduce((a, r) => a + (r.galones || 0), 0);
    const totalCargas  = registros.length;
    const total = (r) => r.total || (r.galones * r.precioPorGalon) || 0;

    // Agrupar por máquina
    // #5: gal/hora basado en rango de horómetro registrado en cargas, no en horómetro total de la máquina
    const porMaquina = maquinas.map(m => {
        const regs = registros.filter(r => r.maquinaNombre === m.nombre);
        const galones = regs.reduce((a, r) => a + (r.galones || 0), 0);
        const gasto   = regs.reduce((a, r) => a + total(r), 0);
        const conHoro = regs.filter(r => r.horometro > 0).map(r => r.horometro);
        const horasRango = conHoro.length >= 2
            ? Math.max(...conHoro) - Math.min(...conHoro)
            : (m.horometroActual || 1);
        const galPorHora = galones > 0 && horasRango > 0 ? (galones / horasRango).toFixed(2) : '—';
        return { ...m, galones, gasto, galPorHora, cargas: regs };
    }).filter(m => m.galones > 0 || maquinas.length <= 5);

    const maxGalones = Math.max(...porMaquina.map(m => m.galones), 1);

    return (
        <>{ConfirmUI}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Combustible</h1><p>Resumen de consumo general</p></div>
                <button className="bp" onClick={() => setMostrarForm(!mostrarForm)}><Plus size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> Registrar Carga</button>
            </div>

            <div className="content"><div className="pad">

                {/* CARDS */}
                <div className="g3">
                    <div className="card orange"><span className="ci"><Fuel size={22} /></span><div className="cl">Gasto total</div><div className="cv">{fmt(totalGasto)}</div><div className="cs">acumulado</div></div>
                    <div className="card blue"><span className="ci"><Droplets size={22} /></span><div className="cl">Galones total</div><div className="cv">{totalGalones.toLocaleString('es-CO')}</div><div className="cs">acumulados</div></div>
                    <div className="card gold"><span className="ci"><ClipboardList size={22} /></span><div className="cl">Cargas total</div><div className="cv">{totalCargas}</div><div className="cs">registros</div></div>
                </div>

                {/* FORM */}
                {mostrarForm && (
                    <div className="fc">
                        <h3 style={{display:'flex',alignItems:'center',gap:'8px'}}><Fuel size={18} /> Registrar carga de combustible</h3>
                        <p className="fd">El gasto se crea automáticamente en Finanzas → Gastos</p>
                        <div className="fg2">
                            <div>
                                <label className="fl">Máquina *</label>
                                <select className="fsel" value={form.maquinaNombre} onChange={e => setForm({ ...form, maquinaNombre: e.target.value })}>
                                    <option value="">Selecciona...</option>
                                    {maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                                </select>
                            </div>
                            <div><label className="fl">Fecha</label><input className="fi" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div>
                        </div>
                        <div className="fg3">
                            <div><label className="fl">Galones *</label><input className="fi" type="number" value={form.galones} onChange={e => setForm({ ...form, galones: e.target.value })} placeholder="Ej: 50" /></div>
                            <div><label className="fl">Precio/galón ($) *</label><MoneyInput className="fi" value={form.precioPorGalon} onChange={e => setForm({ ...form, precioPorGalon: e.target.value })} placeholder="Ej: 12.500" /></div>
                            <div><label className="fl">Horómetro al cargar</label><input className="fi" type="number" value={form.horometro} onChange={e => setForm({ ...form, horometro: e.target.value })} /></div>
                        </div>
                        {form.galones && form.precioPorGalon && (
                            <div className="rbox">
                                <div><div className="rl">Total del gasto</div><div className="rv">{fmt(parseFloat(form.galones) * parseFloat(form.precioPorGalon))}</div><div className="rf">{form.galones} gal × {fmt(parseFloat(form.precioPorGalon))}</div></div>
                                <div style={{ textAlign: 'right' }}><div style={{ color: '#6b7a8d', fontSize: '11px' }}>Se agrega a</div><div style={{ color: '#e74c3c', fontSize: '12px', fontWeight: '700', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'4px' }}><TrendingDown size={13} /> Gastos</div></div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="bp" style={{ background: '#e67e22' }} onClick={registrar}><Fuel size={14} style={{marginRight:'5px',verticalAlign:'middle'}} /> Registrar Carga</button>
                            <button className="bs" onClick={() => setMostrarForm(false)}>Cancelar</button>
                        </div>
                    </div>
                )}

                {/* POR MÁQUINA */}
                {porMaquina.map(m => (
                    <div className="mcomb" key={m.id}>
                        <div className="mcomb-h">
                            <div className="mcomb-ico"><IcoMaquina tipo={m.tipo} size={22} /></div>
                            <strong style={{ fontSize: '13px', color: 'var(--text, #1a2d42)' }}>{m.nombre}</strong>
                        </div>
                        <div className="mcomb-st">
                            <div><div className="csv">{m.galones.toLocaleString('es-CO')}</div><div className="csl">galones</div></div>
                            <div><div className="csv">{fmt(m.gasto)}</div><div className="csl">gastado</div></div>
                            <div><div className="csv">{m.galPorHora}</div><div className="csl">gal/hora</div></div>
                        </div>
                        <div className="cbar">
                            <div className={`cfill ${m.galones / maxGalones > 0.9 ? 'ov' : ''}`} style={{ width: `${Math.min((m.galones / maxGalones) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                ))}

                {/* HISTORIAL */}
                <div className="st" style={{ marginTop: '20px' }}>Historial de cargas</div>
                <div className="tbl">
                    <div className="th">
                        <strong>Todas las cargas</strong>
                        <div className="th-s"><Search size={14} /><input type="text" placeholder="Buscar máquina..." value={buscar} onChange={e => setBuscar(e.target.value)} /></div>
                        <DateRangePicker desde={desde} setDesde={setDesde} hasta={hasta} setHasta={setHasta} />
                    </div>
                    <div className="tr hdr">
                        <Th campo="fecha">Fecha</Th>
                        <Th campo="maquinaNombre" className="w2">Máquina</Th>
                        <Th campo="galones">Galones</Th>
                        <Th campo="precioPorGalon">$/Galón</Th>
                        <span>Horómetro</span>
                        <span>Total</span>
                        <span>Acc.</span>
                    </div>
                    {registros.length === 0 && <p className="vacio">Sin cargas registradas</p>}
                    {pagComb.paginados.map(r => (
                        <div className="tr" key={r.id}>
                            <span>{r.fecha}</span>
                            <span className="w2">{r.maquinaNombre}</span>
                            <span>{r.galones} gal</span>
                            <span>{fmt(r.precioPorGalon)}</span>
                            <span>{r.horometro || '—'}</span>
                            <span className="neg">{fmt(total(r))}</span>
                            <span><button className="icon-btn" onClick={() => eliminar(r.id)}><Trash2 size={14} /></button></span>
                        </div>
                    ))}
                    <Paginacion pagina={pagComb.pagina} total={pagComb.total} ir={pagComb.ir} totalItems={registrosFiltrados.length} porPagina={25} />
                </div>

            </div></div>
        </div>
        </>
    );
}

export default Combustible;
