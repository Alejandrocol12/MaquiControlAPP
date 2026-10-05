import { useState, useEffect } from 'react';
import { interpretarIA, createIngreso, createGasto, createHora, updateMaquina, getOperadoresAPI } from '../../api';
import { useToast } from '../../utils/toast';
import MoneyInput from '../../utils/MoneyInput';
import { Sparkles, Loader, Check, X, AlertTriangle, Clock, TrendingDown } from 'lucide-react';
import './RegistroRapido.css';

const EJEMPLOS = ['le metí 8 y media a la retro', '20 lucas de ACPM ayer', 'manguera nueva para el bull, 85 mil', 'antier 6 horas la grúa'];
const CATEGORIAS = ['Combustible', 'Lubricantes', 'Repuestos', 'Reparación', 'Otros'];
const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');

// Barra para registrar escribiendo como se habla ("8 y media a la retro", "20 lucas de ACPM").
// La IA solo interpreta; siempre se muestra lo que entendió para revisarlo antes de guardar.
function RegistroRapido({ maquinas, onGuardado }) {
    const toast = useToast();
    const [texto, setTexto] = useState('');
    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [borrador, setBorrador] = useState(null);
    const [operadores, setOperadores] = useState([]);

    useEffect(() => { getOperadoresAPI().then(r => setOperadores(r.data || [])).catch(() => {}); }, []);

    const entender = async (frase) => {
        const t = (frase ?? texto).trim();
        if (!t) return;
        setCargando(true);
        try {
            const { data } = await interpretarIA(t);
            const maq = maquinas.find(m => m.nombre === data.maquina);
            setBorrador({
                tipo: data.tipo === 'gasto' ? 'gasto' : 'horas',
                desconocido: data.tipo === 'desconocido',
                maquina: maq ? maq.nombre : '',
                horas: data.horas != null ? String(data.horas) : '',
                valorHora: maq ? String(maq.valorHoraMaquina || '') : '',
                monto: data.monto != null ? String(Math.round(data.monto)) : '',
                categoria: CATEGORIAS.includes(data.categoria) ? data.categoria : 'Otros',
                descripcion: data.descripcion || '',
                fecha: /^\d{4}-\d{2}-\d{2}$/.test(data.fecha || '') ? data.fecha : hoyISO(),
                nota: data.nota || null,
            });
        } catch (e) {
            toast(e.response?.data?.error || 'No pude entender la frase, intenta escribirla de otra forma', 'e');
        } finally {
            setCargando(false);
        }
    };

    const set = (campo, valor) => setBorrador(b => {
        const n = { ...b, [campo]: valor };
        if (campo === 'maquina') {
            const maq = maquinas.find(m => m.nombre === valor);
            if (maq && (!b.valorHora || b.valorHora === String(maquinas.find(m => m.nombre === b.maquina)?.valorHoraMaquina || ''))) {
                n.valorHora = String(maq.valorHoraMaquina || '');
            }
        }
        return n;
    });

    const faltantes = () => {
        if (!borrador) return [];
        const f = [];
        if (!borrador.maquina) f.push('máquina');
        if (borrador.tipo === 'horas') {
            if (!(parseFloat(borrador.horas) > 0)) f.push('horas');
            if (!(parseFloat(borrador.valorHora) > 0)) f.push('valor por hora');
        } else {
            if (!(parseFloat(borrador.monto) > 0)) f.push('monto');
        }
        return f;
    };

    const guardar = async () => {
        if (faltantes().length) return;
        const maq = maquinas.find(m => m.nombre === borrador.maquina);
        setGuardando(true);
        try {
            if (borrador.tipo === 'horas') {
                const horas = parseFloat(borrador.horas);
                const valorHora = parseFloat(borrador.valorHora);
                const inicio = maq.horometroActual || 0;
                const fin = Math.round((inicio + horas) * 10) / 10;
                const res = await createIngreso({
                    maquinaNombre: maq.nombre, tipoTrabajo: 'Horas', cantidad: horas,
                    valorUnitario: valorHora, total: horas * valorHora,
                    fecha: borrador.fecha, descripcion: borrador.descripcion || `Horas – ${maq.nombre}`,
                    horometroInicio: inicio, horometroFin: fin,
                });
                await updateMaquina(maq.id, { ...maq, horometroActual: fin });
                if (maq.operadorNombre) {
                    const op = operadores.find(o => o.nombre === maq.operadorNombre);
                    await createHora({
                        operador_id: op?.id || null,
                        operadorNombre: maq.operadorNombre,
                        maquinaNombre: maq.nombre,
                        fecha: borrador.fecha,
                        horas,
                        valorHora: maq.valorHoraOperador || 0,
                        horometroInicio: inicio,
                        horometroFin: fin,
                        ingresoId: res?.data?.id ?? null,
                    });
                }
                toast(`${String(horas).replace('.', ',')} h registradas a ${maq.nombre}`);
            } else {
                await createGasto({
                    maquinaNombre: maq.nombre, categoria: borrador.categoria,
                    monto: parseFloat(borrador.monto), fecha: borrador.fecha,
                    descripcion: borrador.descripcion || borrador.categoria,
                });
                toast(`Gasto de ${fmt(borrador.monto)} registrado a ${maq.nombre}`);
            }
            setBorrador(null);
            setTexto('');
            onGuardado?.();
        } catch {
            toast('No se pudo guardar. Intenta de nuevo', 'e');
        } finally {
            setGuardando(false);
        }
    };

    const falta = faltantes();

    return (
        <div className="rr-wrap">
            <form className="rr-bar" onSubmit={e => { e.preventDefault(); entender(); }}>
                <Sparkles size={18} className="rr-ico" />
                <input
                    id="rr-texto"
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    placeholder="Escribe lo que pasó: «le metí 8 y media a la retro»"
                    aria-label="Escribe lo que pasó en obra"
                    autoComplete="off"
                />
                <button type="submit" disabled={cargando || !texto.trim()}>
                    {cargando ? <Loader size={14} className="rr-spin" /> : 'Entender'}
                </button>
            </form>

            {!borrador && !cargando && (
                <div className="rr-ej">
                    {EJEMPLOS.map(e => (
                        <button key={e} type="button" onClick={() => { setTexto(e); entender(e); }}>{e}</button>
                    ))}
                </div>
            )}

            {borrador && (
                <div className="rr-card">
                    <div className="rr-card-head">
                        <span>Esto entendí. Revisa y guarda:</span>
                        <button type="button" className="rr-x" aria-label="Descartar" onClick={() => setBorrador(null)}><X size={15} /></button>
                    </div>
                    {(borrador.nota || borrador.desconocido) && (
                        <div className="rr-nota"><AlertTriangle size={14} />{borrador.nota || 'No estoy seguro de qué tipo de registro es. Escoge abajo.'}</div>
                    )}
                    <div className="rr-tipo" role="group" aria-label="Tipo de registro">
                        <button type="button" className={borrador.tipo === 'horas' ? 'on' : ''} onClick={() => set('tipo', 'horas')}><Clock size={14} /> Horas trabajadas</button>
                        <button type="button" className={borrador.tipo === 'gasto' ? 'on' : ''} onClick={() => set('tipo', 'gasto')}><TrendingDown size={14} /> Gasto</button>
                    </div>
                    <div className="rr-grid">
                        <label className="rr-f rr-wide">
                            <span>Máquina</span>
                            <select className={!borrador.maquina ? 'miss' : ''} value={borrador.maquina} onChange={e => set('maquina', e.target.value)}>
                                <option value="">Escoge la máquina...</option>
                                {maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                            </select>
                        </label>
                        {borrador.tipo === 'horas' ? (
                            <>
                                <label className="rr-f">
                                    <span>Horas</span>
                                    <input className={!(parseFloat(borrador.horas) > 0) ? 'miss' : ''} type="number" inputMode="decimal" step="0.5" value={borrador.horas} onChange={e => set('horas', e.target.value)} />
                                </label>
                                <label className="rr-f">
                                    <span>Valor por hora</span>
                                    <MoneyInput className={!(parseFloat(borrador.valorHora) > 0) ? 'miss' : ''} value={borrador.valorHora} onChange={e => set('valorHora', e.target.value)} />
                                </label>
                            </>
                        ) : (
                            <>
                                <label className="rr-f">
                                    <span>Monto</span>
                                    <MoneyInput className={!(parseFloat(borrador.monto) > 0) ? 'miss' : ''} value={borrador.monto} onChange={e => set('monto', e.target.value)} />
                                </label>
                                <label className="rr-f">
                                    <span>Categoría</span>
                                    <select value={borrador.categoria} onChange={e => set('categoria', e.target.value)}>
                                        {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </label>
                            </>
                        )}
                        <label className="rr-f">
                            <span>Fecha</span>
                            <input type="date" value={borrador.fecha} onChange={e => set('fecha', e.target.value)} />
                        </label>
                        <label className="rr-f">
                            <span>Descripción</span>
                            <input value={borrador.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Opcional" />
                        </label>
                    </div>
                    {borrador.tipo === 'horas' && parseFloat(borrador.horas) > 0 && parseFloat(borrador.valorHora) > 0 && (
                        <div className="rr-total">Ingreso: <b>{fmt(parseFloat(borrador.horas) * parseFloat(borrador.valorHora))}</b> · el horómetro sube {String(borrador.horas).replace('.', ',')} h</div>
                    )}
                    <div className="rr-acts">
                        {falta.length > 0 && <span className="rr-falta">Falta: {falta.join(', ')}</span>}
                        <button type="button" className="bs" onClick={() => setBorrador(null)}>Cancelar</button>
                        <button type="button" className="bp" disabled={guardando || falta.length > 0} onClick={guardar}>
                            <Check size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />{guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RegistroRapido;
