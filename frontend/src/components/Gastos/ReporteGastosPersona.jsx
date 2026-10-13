import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, FileSpreadsheet, Clock } from 'lucide-react';
import { getGastos, getMaquinas } from '../../api';
import { useToast } from '../../utils/toast';
import FiltroChips from '../../utils/FiltroChips';
import { xlsGastosPorPersona } from '../../utils/excelReportes';
import { pdfGastosPersona, filtrarGastos, agruparPor, totalDe, quienPago, SIN_ASIGNAR } from '../../utils/gastosPersona';
import { usePagadores, AdministrarPagadores } from './QuienPago';
import './Gastos.css';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Rango de fechas de cada atajo
function rangoDe(clave) {
    const hoy = new Date();
    const y = hoy.getFullYear(), m = hoy.getMonth();
    if (clave === 'mes') return [iso(new Date(y, m, 1)), iso(hoy)];
    if (clave === 'ultimo') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    if (clave === 'd30') return [iso(new Date(y, m, hoy.getDate() - 29)), iso(hoy)];
    if (clave === 'anio') return [iso(new Date(y, 0, 1)), iso(hoy)];
    return ['', ''];
}

// Reporte de gastos por persona: todas las personas, algunas, o un reporte por cada una.
// Sirve igual dentro de Reportes y dentro de Gastos.
function ReporteGastosPersona({ titulo = 'Gastos por persona' }) {
    const toast = useToast();
    const { pagadores, recargar } = usePagadores();
    const [gastos, setGastos] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [rango, setRango] = useState('mes');
    const [[desde, hasta], setFechas] = useState(rangoDe('mes'));
    const [persona, setPersona] = useState('');
    const [maquina, setMaquina] = useState('');
    const [categoria, setCategoria] = useState('');
    const [generando, setGenerando] = useState('');
    const [admin, setAdmin] = useState(false);

    const cargar = useCallback(async () => {
        try {
            const [g, m] = await Promise.all([getGastos(), getMaquinas()]);
            setGastos(g.data || []); setMaquinas(m.data || []);
        } catch (e) { console.error(e); }
        setCargando(false);
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const elegirRango = (k) => { setRango(k); if (k !== 'rango') setFechas(rangoDe(k)); };

    const nombres = useMemo(() => {
        const base = pagadores.map(p => p.nombre);
        gastos.forEach(g => { const q = quienPago(g); if (q !== SIN_ASIGNAR && !base.includes(q)) base.push(q); });
        if (gastos.some(g => quienPago(g) === SIN_ASIGNAR)) base.push(SIN_ASIGNAR);
        return base;
    }, [pagadores, gastos]);
    const categorias = useMemo(() => [...new Set(gastos.map(g => g.categoria).filter(Boolean))].sort(), [gastos]);

    const opciones = { desde, hasta, maquina, categoria, persona, personas: persona ? [persona] : [] };
    const lista = useMemo(() => filtrarGastos(gastos, opciones), [gastos, desde, hasta, maquina, categoria, persona]); // eslint-disable-line react-hooks/exhaustive-deps
    const grupos = useMemo(() => agruparPor(lista, quienPago), [lista]);
    const total = totalDe(lista);
    const fechasMal = desde && hasta && desde > hasta;

    const ejecutar = async (tipo) => {
        if (!lista.length || fechasMal) return;
        setGenerando(tipo);
        try {
            if (tipo === 'pdf') {
                await pdfGastosPersona(lista, opciones);
                toast('PDF generado');
            } else {
                await xlsGastosPorPersona(grupos, opciones);
                toast('Excel generado');
            }
        } catch (e) { console.error(e); toast('No se pudo generar el reporte', 'e'); }
        setGenerando('');
    };

    return (
        <div className="gp">
            {admin && <AdministrarPagadores pagadores={pagadores} gastos={gastos} onCambio={async () => { await recargar(); await cargar(); }} onCerrar={() => setAdmin(false)} />}
            <div className="gp-head">
                <b><Users size={16} /> {titulo}</b>
                <button type="button" className="qp-link" onClick={() => setAdmin(true)}>Administrar personas</button>
            </div>
            <p className="gp-sub">Quién pagó cada gasto. Elige las fechas, las personas y cómo quieres el reporte.</p>

            <div className="gp-sec">
                <span className="gp-lab">Fechas</span>
                <FiltroChips valor={rango} onChange={elegirRango} opciones={[
                    { key: 'mes', label: 'Este mes' }, { key: 'ultimo', label: 'Mes anterior' }, { key: 'd30', label: 'Últimos 30 días' },
                    { key: 'anio', label: 'Este año' }, { key: 'todo', label: 'Todo' }, { key: 'rango', label: 'Personalizado' },
                ]}>
                    {rango === 'rango' && (
                        <div className="gp-fechas">
                            <input type="date" className="fi" aria-label="Desde" value={desde} max={hasta || undefined} onChange={e => setFechas([e.target.value, hasta])} />
                            <span>→</span>
                            <input type="date" className="fi" aria-label="Hasta" value={hasta} min={desde || undefined} onChange={e => setFechas([desde, e.target.value])} />
                        </div>
                    )}
                </FiltroChips>
                {fechasMal && <p className="qp-error" role="alert">La fecha "desde" no puede ser después de "hasta".</p>}
            </div>

            <div className="gp-sec">
                <span className="gp-lab">¿De quién?</span>
                <div className="gp-personas" role="group" aria-label="Persona">
                    <button type="button" className={`fchip ${persona === '' ? 'on' : ''}`} aria-pressed={persona === ''} onClick={() => setPersona('')}>Todas las personas</button>
                    {nombres.map(n => (
                        <button type="button" key={n} className={`fchip ${persona === n ? 'on' : ''}`} aria-pressed={persona === n} onClick={() => setPersona(n)}>{n}</button>
                    ))}
                </div>
                <span className="gp-hint">{persona ? `Un reporte solo con los gastos de ${persona}.` : 'Un reporte con los gastos de todas, cada una con su subtotal.'}</span>
            </div>

            <div className="gp-sec gp-dos">
                <div><label className="fl" htmlFor="gp-maq">Máquina</label>
                    <select id="gp-maq" className="fsel" value={maquina} onChange={e => setMaquina(e.target.value)}>
                        <option value="">Todas</option>{maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                    </select></div>
                <div><label className="fl" htmlFor="gp-cat">Categoría</label>
                    <select id="gp-cat" className="fsel" value={categoria} onChange={e => setCategoria(e.target.value)}>
                        <option value="">Todas</option>{categorias.map(c => <option key={c}>{c}</option>)}
                    </select></div>
            </div>

            <div className="gp-res">
                {cargando ? <span>Cargando…</span> : lista.length === 0
                    ? <span>No hay gastos con esas opciones.</span>
                    : <>
                        <div className="gp-tot"><span>{lista.length} gasto{lista.length === 1 ? '' : 's'} · {grupos.length} persona{grupos.length === 1 ? '' : 's'}</span><b>{fmt(total)}</b></div>
                        {grupos.slice(0, 8).map(g => (
                            <div className="gp-barra" key={g.clave}>
                                <span className="gp-n">{g.clave}</span>
                                <div className="gp-tr"><i style={{ width: `${total ? g.total / total * 100 : 0}%` }} /></div>
                                <b>{fmt(g.total)}</b>
                            </div>
                        ))}
                        {grupos.length > 8 && <span className="gp-hint">y {grupos.length - 8} personas más</span>}
                    </>}
            </div>

            <div className="gp-acts">
                <button className="bp" disabled={!lista.length || fechasMal || !!generando} onClick={() => ejecutar('pdf')}>
                    {generando === 'pdf' ? <><Clock size={13} /> PDF…</> : <>↓ PDF</>}
                </button>
                <button className="bs" disabled={!lista.length || fechasMal || !!generando} onClick={() => ejecutar('xls')}>
                    {generando === 'xls' ? <><Clock size={13} /> Excel…</> : <><FileSpreadsheet size={13} /> Excel</>}
                </button>
            </div>
        </div>
    );
}

export default ReporteGastosPersona;
