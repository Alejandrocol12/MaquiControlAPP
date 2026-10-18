import { useState, useEffect, useMemo } from 'react';
import { Scissors, Clock, FileSpreadsheet, Check } from 'lucide-react';
import { getCortes } from '../../api';
import { useToast } from '../../utils/toast';
import { fmtHoras } from '../../utils/cortes';
import { gruposDeCortes, pdfReporteCorte } from '../../utils/reporteCorte';
import { xlsReporteCorte } from '../../utils/excelReportes';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const INCLUIR = [['ing', 'Ingresos'], ['gas', 'Gastos'], ['amb', 'Ambos']];

// Reporte por corte: se elige la máquina, el periodo y uno o varios cortes. Las columnas de ingresos
// son siempre las mismas (fecha, horas, descripción, horómetro inicio y fin, total) y el PDF lleva
// resumen arriba y subtotal en cada corte.
function ReporteCorte({ maquinas, ingresos, gastos, faenas }) {
    const toast = useToast();
    const [cortes, setCortes] = useState([]);
    const [maq, setMaq] = useState('');
    const [faenaId, setFaenaId] = useState('');
    const [incluir, setIncluir] = useState('amb');
    const [elegidos, setElegidos] = useState({});
    const [generando, setGenerando] = useState('');

    useEffect(() => { getCortes().then(r => setCortes(r.data || [])).catch(() => {}); }, []);
    useEffect(() => { if (!maq && maquinas.length) setMaq(maquinas[0].nombre); }, [maquinas, maq]);

    const periodos = useMemo(() => faenas.filter(f => f.maquinaNombre === maq && f.tipo !== 'gastos')
        .sort((a, b) => String(b.fechaInicio || '').localeCompare(String(a.fechaInicio || ''))), [faenas, maq]);
    useEffect(() => {
        if (!periodos.some(f => String(f.id) === String(faenaId))) setFaenaId(periodos[0] ? String(periodos[0].id) : '');
    }, [periodos, faenaId]);

    const faena = periodos.find(f => String(f.id) === String(faenaId)) || null;
    const grupos = useMemo(() => gruposDeCortes(faena, cortes, ingresos, gastos), [faena, cortes, ingresos, gastos]);

    // Al cambiar de periodo quedan elegidos todos sus cortes
    useEffect(() => {
        setElegidos(Object.fromEntries(grupos.map(g => [g.id, true])));
    }, [faenaId, grupos.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const lista = grupos.filter(g => elegidos[g.id]);
    const todos = grupos.length > 0 && lista.length === grupos.length;
    const verIng = incluir !== 'gas', verGas = incluir !== 'ing';
    const totHoras = lista.reduce((a, g) => a + g.horas, 0);
    const totIng = lista.reduce((a, g) => a + g.totalIng, 0);
    const totGas = lista.reduce((a, g) => a + g.totalGas, 0);

    const ejecutar = async (tipo) => {
        if (!lista.length || !faena) return;
        setGenerando(tipo);
        try {
            const datos = { maquina: maq, faena, grupos: lista, incluir };
            if (tipo === 'pdf') await pdfReporteCorte(datos); else await xlsReporteCorte(datos);
            toast(tipo === 'pdf' ? 'PDF generado' : 'Excel generado');
        } catch (e) { console.error(e); toast('No se pudo generar el reporte', 'e'); }
        setGenerando('');
    };

    return (
        <div className="rp-card rc-card">
            <div className="rp-top">
                <span className="rp-ico" style={{ background: '#c9790f' }}><Scissors size={19} /></span>
                <div className="rp-title"><h3>Reporte por corte</h3><p>Ingresos, gastos o ambos de uno o varios cortes de un periodo, con horas, horómetros, fechas y montos</p></div>
            </div>

            <div className="rp-controls">
                <select className="rp-select" aria-label="Máquina" value={maq} onChange={e => setMaq(e.target.value)}>
                    {maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                </select>
                <select className="rp-select" aria-label="Periodo" value={faenaId} onChange={e => setFaenaId(e.target.value)}>
                    {periodos.length === 0 && <option value="">Sin periodos</option>}
                    {periodos.map(f => <option key={f.id} value={f.id}>{`${f.nombreObra || 'Sin nombre'} (${f.estado === 'activa' ? 'activo' : 'cerrado'})`}</option>)}
                </select>
            </div>

            <div className="rc-seg" role="group" aria-label="Qué incluir">
                {INCLUIR.map(([k, l]) => <button key={k} type="button" className={incluir === k ? 'on' : ''} aria-pressed={incluir === k} onClick={() => setIncluir(k)}>{l}</button>)}
            </div>

            {grupos.length === 0 ? (
                <p className="rc-vacio">{faena ? 'Este periodo todavía no tiene ingresos ni gastos.' : 'Esta máquina no tiene periodos.'}</p>
            ) : (
                <>
                    <div className="rc-cab">
                        <span>Cortes del periodo</span>
                        <button type="button" className="rc-link" onClick={() => setElegidos(Object.fromEntries(grupos.map(g => [g.id, !todos])))}>{todos ? 'Quitar todos' : 'Elegir todos'}</button>
                    </div>
                    <div className="rc-lista">
                        {grupos.map(g => {
                            const on = !!elegidos[g.id];
                            return (
                                <button type="button" key={g.id} className={`rc-corte ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setElegidos(e => ({ ...e, [g.id]: !on }))}>
                                    <span className="rc-box">{on && <Check size={12} />}</span>
                                    <span className="rc-n"><b>{g.nombre}</b><small>{g.fechas} · {fmtHoras(g.horas)} h</small></span>
                                    <span className="rc-m">
                                        {verIng && <i className="pos">{fmt(g.totalIng)}</i>}
                                        {verGas && <i className="neg">{fmt(g.totalGas)}</i>}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            <div className="rp-metric">
                <span className="m1">{lista.length} corte{lista.length === 1 ? '' : 's'} · {fmtHoras(totHoras)} h</span>
                <span className={`m2 rp-num ${verIng && verGas ? (totIng - totGas >= 0 ? 'pos' : 'neg') : verGas ? 'neg' : 'pos'}`}>
                    {fmt(verIng && verGas ? totIng - totGas : verGas ? totGas : totIng)}
                </span>
            </div>
            <div className="rp-actions">
                <button className="rp-btn pri" disabled={!lista.length || !!generando} onClick={() => ejecutar('pdf')}>
                    {generando === 'pdf' ? <><Clock size={13} /> PDF...</> : <>↓ PDF</>}
                </button>
                <button className="rp-btn xls" disabled={!lista.length || !!generando} onClick={() => ejecutar('xls')}>
                    {generando === 'xls' ? <><Clock size={13} /> XLS...</> : <><FileSpreadsheet size={13} /> Excel</>}
                </button>
            </div>
        </div>
    );
}

export default ReporteCorte;
