import { useState, useEffect, useMemo } from 'react';
import { getCortes } from '../../api';
import { fmtHoras } from '../../utils/cortes';
import { gruposDeCortes, pdfReporteCorte } from '../../utils/reporteCorte';
import { xlsReporteCorte } from '../../utils/excelReportes';
import { Chips, MaquinaPeriodo, VistaPrevia } from './ReporteUI';

const INCLUIR = [{ value: 'ing', label: 'Ingresos' }, { value: 'gas', label: 'Gastos' }, { value: 'amb', label: 'Ambos' }];

// Reporte por corte: se elige la máquina, el periodo y uno o varios cortes. Las columnas de ingresos
// son siempre las mismas (fecha, horas, descripción, horómetro inicio y fin, total) y el PDF lleva
// resumen arriba y subtotal en cada corte. La máquina y el periodo los comparte con los demás reportes.
function ReporteCorte({ maquinas, ingresos, gastos, faenas, maq, onMaq, periodoId, onPeriodo, generando, ejecutar, error }) {
    const [cortes, setCortes] = useState([]);
    const [incluir, setIncluir] = useState('amb');
    const [elegidos, setElegidos] = useState({});

    useEffect(() => { getCortes().then(r => setCortes(r.data || [])).catch(() => {}); }, []);

    const periodos = useMemo(() => faenas.filter(f => f.maquinaNombre === maq && f.tipo !== 'gastos')
        .sort((a, b) => String(b.fechaInicio || '').localeCompare(String(a.fechaInicio || ''))), [faenas, maq]);
    // Este reporte siempre es de un periodo concreto: si no hay uno elegido toma el más reciente
    const faena = periodos.find(f => String(f.id) === String(periodoId)) || periodos[0] || null;
    const faenaId = faena ? String(faena.id) : '';
    const grupos = useMemo(() => gruposDeCortes(faena, cortes, ingresos, gastos), [faena, cortes, ingresos, gastos]);

    // Al cambiar de periodo quedan elegidos todos sus cortes
    useEffect(() => {
        setElegidos(Object.fromEntries(grupos.map(g => [g.id, true])));
    }, [faenaId, grupos.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const lista = grupos.filter(g => elegidos[g.id]);
    const verIng = incluir !== 'gas', verGas = incluir !== 'ing';
    const totHoras = lista.reduce((a, g) => a + g.horas, 0);
    const totIng = lista.reduce((a, g) => a + g.totalIng, 0);
    const totGas = lista.reduce((a, g) => a + g.totalGas, 0);
    const valor = verIng && verGas ? totIng - totGas : verGas ? totGas : totIng;
    const tono = verIng && verGas ? (valor >= 0 ? 'pos' : 'neg') : verGas ? 'neg' : 'pos';

    const generar = (tipo) => ejecutar(tipo, async () => {
        const datos = { maquina: maq, faena, grupos: lista, incluir };
        if (tipo === 'pdf') await pdfReporteCorte(datos); else await xlsReporteCorte(datos);
    });

    const vacio = !faena ? 'Esta máquina no tiene periodos.'
        : grupos.length === 0 ? 'Este periodo todavía no tiene ingresos ni gastos.'
        : 'Elige al menos un corte.';

    return (
        <>
            <div className="rv-params">
                <MaquinaPeriodo maquinas={maquinas} maq={maq} onMaq={onMaq} periodos={periodos}
                    periodo={faenaId} onPeriodo={onPeriodo} conTodos={false} />
                {grupos.length > 0 && (
                    <Chips etiqueta="Cortes" multiple valor={elegidos}
                        opciones={grupos.map(g => ({ value: g.id, label: g.nombre, title: `${g.fechas} · ${fmtHoras(g.horas)} h` }))}
                        onChange={id => setElegidos(e => ({ ...e, [id]: !e[id] }))} />
                )}
                <Chips etiqueta="Contenido" opciones={INCLUIR} valor={incluir} onChange={setIncluir} />
            </div>
            <VistaPrevia total={valor} tono={tono} sinDatos={!lista.length} mensajeVacio={vacio}
                detalle={`${lista.length} corte${lista.length === 1 ? '' : 's'} · ${fmtHoras(totHoras)} h`}
                generando={generando} error={error} onPdf={() => generar('pdf')} onXls={() => generar('xls')} />
        </>
    );
}

export default ReporteCorte;
