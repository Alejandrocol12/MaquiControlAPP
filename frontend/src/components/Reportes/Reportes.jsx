import { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import { useToast } from '../../utils/toast';
import {
    getMaquinas, getIngresos, getGastos, getSalarios,
    getHoras, getMantenimientos, getCombustible, getFaenas
} from '../../api';
import { Loader } from 'lucide-react';
import {
    xlsMensual, xlsMaquina, xlsGastosPorPeriodo, xlsIngresosPorPeriodo, xlsPeriodoMaquina,
} from '../../utils/excelReportes';
import { esSueldoOperador } from '../../utils/nomina';
import ReporteCorte from './ReporteCorte';
import { Campo, MaquinaPeriodo, VistaPrevia } from './ReporteUI';
import './Reportes.css';
import {
    fmt, fmtNum, AZUL, DORADO, GRIS, VERDE, ROJO, AZULC,
    cabecera, cajaResumen, barChart, seccion, tabla, pie,
} from '../../utils/pdfObra';


// ── helpers ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// 1. REPORTE MENSUAL
// ══════════════════════════════════════════════════════════════
function pdfMensual(mes, ingresos, gastos, salarios) {
    const [anio, mesNum] = mes.split('-');
    const label = new Date(anio, mesNum - 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const filtrar = arr => arr.filter(x => x.fecha && x.fecha.startsWith(mes));

    const ingMes = filtrar(ingresos);
    const gasMes = filtrar(gastos);
    const salMes = filtrar(salarios);

    const totIng   = ingMes.reduce((a, x) => a + (x.total || 0), 0);
    const totGas   = gasMes.reduce((a, x) => a + (x.monto || 0), 0);
    const totBruto = salMes.reduce((a, x) => a + (x.totalBruto || 0), 0);
    const totDesc  = salMes.reduce((a, x) => a + (x.descuentos || 0), 0);
    const totSal   = salMes.reduce((a, x) => a + (x.totalNeto || 0), 0);
    const utilidad = totIng - totGas;

    const doc = new jsPDF();
    let y = cabecera(doc, 'Reporte Mensual', label.charAt(0).toUpperCase() + label.slice(1));

    y = cajaResumen(doc, y, [
        { label: 'Total Ingresos', valor: fmt(totIng),   tipo: 'ing',  _raw: totIng },
        { label: 'Total Gastos',   valor: fmt(totGas),   tipo: 'gas',  _raw: totGas },
        { label: 'Utilidad',       valor: fmt(utilidad), tipo: 'util', _raw: utilidad },
        { label: 'Salarios neto',  valor: fmt(totSal),   tipo: 'neu',  _raw: totSal },
    ]);

    y = barChart(doc, y, [
        { label: 'Ingresos', valor: totIng,   color: VERDE },
        { label: 'Gastos',   valor: totGas,   color: ROJO },
        { label: 'Utilidad', valor: utilidad, color: utilidad >= 0 ? DORADO : ROJO },
    ], 'Comparativo del mes');

    y = seccion(doc, y, `INGRESOS (${ingMes.length} registros)`);
    if (ingMes.length) {
        y = tabla(doc, y,
            ['Fecha', 'Máquina', 'Descripción', 'Tipo', 'Total'],
            ingMes.map(x => [x.fecha || '—', x.maquinaNombre || '—', x.descripcion || '—', x.tipoTrabajo || '—', fmt(x.total)]),
            { 4: { halign: 'right' } },
            { greenCols: [4], totalRow: ['', '', '', 'TOTAL', fmt(totIng)] }
        );
    } else {
        doc.setFontSize(8); doc.setTextColor(...GRIS);
        doc.text('Sin ingresos en este período', 17, y + 5); y += 12;
    }

    y = seccion(doc, y, `GASTOS (${gasMes.length} registros)`);
    if (gasMes.length) {
        y = tabla(doc, y,
            ['Fecha', 'Máquina', 'Descripción', 'Categoría', 'Monto'],
            gasMes.map(x => [x.fecha || '—', x.maquinaNombre || '—', x.descripcion || '—', x.categoria || '—', fmt(x.monto)]),
            { 4: { halign: 'right' } },
            { redCols: [4], totalRow: ['', '', '', 'TOTAL', fmt(totGas)] }
        );
    } else {
        doc.setFontSize(8); doc.setTextColor(...GRIS);
        doc.text('Sin gastos en este período', 17, y + 5); y += 12;
    }

    if (salMes.length) {
        y = seccion(doc, y, `SALARIOS (${salMes.length} liquidaciones)`);
        y = tabla(doc, y,
            ['Fecha', 'Operador', 'Horas', 'Bruto', 'Descuentos', 'Neto'],
            salMes.map(x => [x.fecha || '—', x.operadorNombre || '—', `${x.horasTrabajadas || 0} hrs`, fmt(x.totalBruto), fmt(x.descuentos || 0), fmt(x.totalNeto)]),
            { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
            { redCols: [4], greenCols: [5], totalRow: ['', '', '', fmt(totBruto), fmt(totDesc), fmt(totSal)] }
        );
    }

    pie(doc, `Reporte Mensual — ${label}`);
    doc.save(`reporte-mensual-${mes}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// 2. REPORTE POR MÁQUINA
// ══════════════════════════════════════════════════════════════
function pdfMaquina(maq, ingresos, gastos, combustibles, mantenimientos, horas) {
    const ingM  = ingresos.filter(x => x.maquinaNombre === maq.nombre);
    const gasM  = gastos.filter(x => x.maquinaNombre === maq.nombre);
    const combM = combustibles.filter(x => x.maquinaNombre === maq.nombre);
    const mantM = mantenimientos.filter(x => x.maquinaNombre === maq.nombre);
    const hrsM  = horas.filter(x => x.maquinaNombre === maq.nombre);

    const totIng  = ingM.reduce((a, x) => a + (x.total || 0), 0);
    const totGas  = gasM.reduce((a, x) => a + (x.monto || 0), 0);
    const totComb = combM.reduce((a, x) => a + (x.total || 0), 0);
    const totGal  = combM.reduce((a, x) => a + (x.galones || 0), 0);
    const totMant = mantM.reduce((a, x) => a + (x.costo || 0), 0);
    const totHrs  = hrsM.reduce((a, x) => a + (x.horas || 0), 0);
    const totValHrs = hrsM.reduce((a, x) => a + (x.horas || 0) * (x.valorHora || 0), 0);
    const totEgr  = totGas + totComb + totMant;
    const utilidad = totIng - totEgr;

    const doc = new jsPDF();
    let y = cabecera(doc, `Reporte de Máquina`, `${maq.nombre} · ${maq.tipo || ''} · Placa: ${maq.placa || '—'}`);

    y = cajaResumen(doc, y, [
        { label: 'Total Ingresos', valor: fmt(totIng),   tipo: 'ing',  _raw: totIng },
        { label: 'Total Gastos',   valor: fmt(totEgr),   tipo: 'gas',  _raw: totEgr },
        { label: 'Utilidad',       valor: fmt(utilidad), tipo: 'util', _raw: utilidad },
        { label: 'Horas totales',  valor: `${fmtNum(totHrs)} hrs`, tipo: 'neu' },
    ]);

    doc.setFontSize(8); doc.setTextColor(...GRIS);
    doc.text(`Operador: ${maq.operadorNombre || '—'}  ·  Horómetro: ${fmtNum(maq.horometroActual)} hrs  ·  Estado: ${maq.estado || '—'}  ·  Valor/hr operador: ${fmt(maq.valorHoraOperador)}  ·  Valor/hr máquina: ${fmt(maq.valorHoraMaquina || 0)}`, 14, y);
    y += 10;

    if (ingM.length) {
        y = seccion(doc, y, `INGRESOS (${ingM.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Descripción', 'Tipo', 'Cantidad', 'Valor unit.', 'Total'],
            ingM.map(x => [x.fecha || '—', x.descripcion || '—', x.tipoTrabajo || '—', fmtNum(x.cantidad), fmt(x.valorUnitario), fmt(x.total)]),
            { 5: { halign: 'right' } },
            { greenCols: [5], totalRow: ['', '', '', '', 'TOTAL', fmt(totIng)] }
        );
    }

    if (gasM.length) {
        y = seccion(doc, y, `GASTOS (${gasM.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Descripción', 'Categoría', 'Monto'],
            gasM.map(x => [x.fecha || '—', x.descripcion || '—', x.categoria || '—', fmt(x.monto)]),
            { 3: { halign: 'right' } },
            { redCols: [3], totalRow: ['', '', 'TOTAL', fmt(totGas)] }
        );
    }

    if (combM.length) {
        y = seccion(doc, y, `COMBUSTIBLE (${combM.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Galones', 'Precio/Gal', 'Horómetro', 'Total'],
            combM.map(x => [x.fecha || '—', `${x.galones || 0} gal`, fmt(x.precioPorGalon), fmtNum(x.horometro), fmt(x.total)]),
            { 4: { halign: 'right' } },
            { redCols: [4], totalRow: ['', `${fmtNum(totGal)} gal`, '', '', fmt(totComb)] }
        );
    }

    if (hrsM.length) {
        y = seccion(doc, y, `HORAS TRABAJADAS (${hrsM.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Operador', 'Horas', 'Valor/hr', 'Valor ganado'],
            hrsM.map(x => [x.fecha || '—', x.operadorNombre || '—', `${x.horas || 0} hrs`, fmt(x.valorHora), fmt((x.horas || 0) * (x.valorHora || 0))]),
            { 4: { halign: 'right' } },
            { greenCols: [4], totalRow: ['', '', `${fmtNum(totHrs)} hrs`, '', fmt(totValHrs)] }
        );
    }

    pie(doc, `Reporte máquina — ${maq.nombre}`);
    doc.save(`reporte-maquina-${maq.nombre.replace(/\s+/g, '-')}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// 3. REPORTE OPERADORES
// ══════════════════════════════════════════════════════════════
function pdfOperadores(horas, salarios, maquinas) {
    const ops = {};
    horas.forEach(h => {
        if (!ops[h.operadorNombre]) ops[h.operadorNombre] = { horas: [], salarios: [] };
        ops[h.operadorNombre].horas.push(h);
    });
    salarios.forEach(s => {
        if (!ops[s.operadorNombre]) ops[s.operadorNombre] = { horas: [], salarios: [] };
        ops[s.operadorNombre].salarios.push(s);
    });

    const doc = new jsPDF();
    let y = cabecera(doc, 'Reporte de Operadores', 'Horas trabajadas, salarios y liquidaciones');

    const totHrs   = horas.reduce((a, h) => a + (h.horas || 0), 0);
    const totSal   = salarios.reduce((a, s) => a + (s.totalNeto || 0), 0);
    const totBruto = salarios.reduce((a, s) => a + (s.totalBruto || 0), 0);
    const totDesc  = salarios.reduce((a, s) => a + (s.descuentos || 0), 0);
    const pendientes = salarios.filter(s => s.estado === 'Pendiente').length;

    y = cajaResumen(doc, y, [
        { label: 'Total operadores', valor: String(Object.keys(ops).length), tipo: 'neu' },
        { label: 'Horas acumuladas', valor: `${fmtNum(totHrs)} hrs`, tipo: 'neu' },
        { label: 'Total salarios',   valor: fmt(totSal), tipo: 'gas', _raw: totSal },
        { label: 'Pend. de pago',    valor: String(pendientes), tipo: pendientes > 0 ? 'gas' : 'neu' },
    ]);

    y = seccion(doc, y, 'RESUMEN POR OPERADOR');
    const filasOps = Object.entries(ops).map(([nombre, data]) => {
        const maq = maquinas.find(m => m.operadorNombre === nombre);
        const hrs = data.horas.reduce((a, h) => a + (h.horas || 0), 0);
        const valorHora = maq?.valorHoraOperador || 0;
        const bruto = hrs * valorHora;
        return [nombre, maq?.nombre || '—', `${fmtNum(hrs)} hrs`, fmt(valorHora), fmt(bruto)];
    });
    const totBrutoRes = Object.entries(ops).reduce((acc, [nombre, data]) => {
        const maq = maquinas.find(m => m.operadorNombre === nombre);
        const hrs = data.horas.reduce((a, h) => a + (h.horas || 0), 0);
        return acc + hrs * (maq?.valorHoraOperador || 0);
    }, 0);
    y = tabla(doc, y,
        ['Operador', 'Máquina asignada', 'Total horas', 'Valor/hora', 'Salario bruto'],
        filasOps,
        { 4: { halign: 'right' } },
        { orangeCols: [4], totalRow: ['TOTAL', '', `${fmtNum(totHrs)} hrs`, '', fmt(totBrutoRes)] }
    );

    if (salarios.length) {
        y = seccion(doc, y, 'HISTORIAL DE LIQUIDACIONES');
        y = tabla(doc, y,
            ['Fecha', 'Operador', 'Máquina', 'Horas', 'Bruto', 'Descuentos', 'Neto', 'Estado'],
            salarios.map(s => [
                s.fecha || '—', s.operadorNombre || '—', s.maquinaNombre || '—',
                `${s.horasTrabajadas || 0} hrs`, fmt(s.totalBruto),
                fmt(s.descuentos || 0), fmt(s.totalNeto), s.estado || '—'
            ]),
            { 6: { halign: 'right' } },
            { redCols: [5], greenCols: [6], totalRow: ['', '', '', `${fmtNum(totHrs)} hrs`, fmt(totBruto), fmt(totDesc), fmt(totSal), ''] }
        );
    }

    pie(doc, 'Reporte de Operadores');
    doc.save('reporte-operadores.pdf');
}

// ══════════════════════════════════════════════════════════════
// 4. REPORTE MANTENIMIENTOS
// ══════════════════════════════════════════════════════════════
function pdfMantenimientos(mantenimientos) {
    const total    = mantenimientos.reduce((a, m) => a + (m.costo || 0), 0);
    const promedio = mantenimientos.length ? total / mantenimientos.length : 0;
    const minCosto = mantenimientos.length ? Math.min(...mantenimientos.map(m => m.costo || 0)) : 0;

    const doc = new jsPDF();
    let y = cabecera(doc, 'Reporte de Mantenimientos', 'Historial y costos por máquina');

    y = cajaResumen(doc, y, [
        { label: 'Total registros', valor: String(mantenimientos.length), tipo: 'neu' },
        { label: 'Costo total',     valor: fmt(total),    tipo: 'gas', _raw: total },
        { label: 'Costo mínimo',    valor: fmt(minCosto), tipo: 'neu' },
        { label: 'Costo promedio',  valor: fmt(promedio), tipo: 'neu' },
    ]);

    if (mantenimientos.length) {
        y = seccion(doc, y, `HISTORIAL DE MANTENIMIENTOS (${mantenimientos.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Máquina', 'Tipo', 'Descripción', 'Técnico', 'Costo'],
            mantenimientos.map(m => [
                m.fecha || '—', m.maquinaNombre || '—', m.tipo || '—',
                m.descripcion || '—', m.tecnico || '—', fmt(m.costo)
            ]),
            { 5: { halign: 'right' } },
            { redCols: [5], totalRow: ['', '', '', '', 'TOTAL', fmt(total)] }
        );
    } else {
        doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text('No hay mantenimientos registrados', 14, y + 8);
    }

    pie(doc, 'Reporte de Mantenimientos');
    doc.save('reporte-mantenimientos.pdf');
}

// ══════════════════════════════════════════════════════════════
// 5. REPORTE PAGOS CLIENTES
// ══════════════════════════════════════════════════════════════
function pdfPagos(pagos) {
    const cobrado   = pagos.reduce((a, p) => a + (Number(p.valorPagado) || 0), 0);
    const pendiente = pagos.reduce((a, p) => a + (Number(p.saldoPendiente) || 0), 0);
    const total     = pagos.reduce((a, p) => a + (Number(p.valorTotal) || 0), 0);

    const doc = new jsPDF();
    let y = cabecera(doc, 'Reporte de Pagos Clientes', 'Cobros realizados y pendientes');

    y = cajaResumen(doc, y, [
        { label: 'Total registros', valor: String(pagos.length),     tipo: 'neu' },
        { label: 'Cobrado',         valor: fmt(cobrado),              tipo: 'ing', _raw: cobrado },
        { label: 'Pendiente',       valor: fmt(pendiente),            tipo: pendiente > 0 ? 'gas' : 'neu', _raw: pendiente },
        { label: 'Total',           valor: fmt(total),  tipo: 'neu' },
    ]);

    if (pagos.length) {
        y = seccion(doc, y, `PAGOS (${pagos.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Cliente', 'Máquina', 'Total', 'Pagado', 'Saldo', 'Estado'],
            pagos.map(p => [
                p.fecha || '—', p.cliente || '—', p.maquinaNombre || '—',
                fmt(p.valorTotal), fmt(p.valorPagado), fmt(p.saldoPendiente), p.estado || '—'
            ]),
            { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
            { greenCols: [4], redCols: [5], totalRow: ['', '', 'TOTAL', fmt(total), fmt(cobrado), fmt(pendiente), ''] }
        );
    } else {
        doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text('No hay pagos registrados', 14, y + 8);
    }

    pie(doc, 'Reporte de Pagos Clientes');
    doc.save('reporte-pagos.pdf');
}

// ══════════════════════════════════════════════════════════════
// 6. REPORTE COMBUSTIBLE
// ══════════════════════════════════════════════════════════════
function pdfCombustible(combustibles) {
    const total  = combustibles.reduce((a, c) => a + (c.total || 0), 0);
    const galTot = combustibles.reduce((a, c) => a + (c.galones || 0), 0);

    const doc = new jsPDF();
    let y = cabecera(doc, 'Reporte de Combustible', 'Consumo y gasto por máquina');

    y = cajaResumen(doc, y, [
        { label: 'Total cargas',   valor: String(combustibles.length), tipo: 'neu' },
        { label: 'Total galones',  valor: `${fmtNum(galTot)} gal`,     tipo: 'neu' },
        { label: 'Gasto total',    valor: fmt(total),                  tipo: 'gas', _raw: total },
        { label: 'Precio prom/gl', valor: fmt(galTot ? total / galTot : 0), tipo: 'neu' },
    ]);

    const porMaq = {};
    combustibles.forEach(c => {
        if (!porMaq[c.maquinaNombre]) porMaq[c.maquinaNombre] = { galones: 0, total: 0 };
        porMaq[c.maquinaNombre].galones += c.galones || 0;
        porMaq[c.maquinaNombre].total   += c.total   || 0;
    });

    y = seccion(doc, y, 'RESUMEN POR MÁQUINA');
    y = tabla(doc, y,
        ['Máquina', 'Cargas', 'Total galones', 'Gasto total'],
        Object.entries(porMaq).map(([nombre, d]) => [
            nombre,
            String(combustibles.filter(c => c.maquinaNombre === nombre).length),
            `${fmtNum(d.galones)} gal`,
            fmt(d.total)
        ]),
        { 3: { halign: 'right' } },
        { redCols: [3], totalRow: ['TOTAL', String(combustibles.length), `${fmtNum(galTot)} gal`, fmt(total)] }
    );

    y = seccion(doc, y, `HISTORIAL COMPLETO (${combustibles.length})`);
    y = tabla(doc, y,
        ['Fecha', 'Máquina', 'Galones', 'Precio/Gal', 'Horómetro', 'Total'],
        combustibles.map(c => [
            c.fecha || '—', c.maquinaNombre || '—',
            `${c.galones || 0} gal`, fmt(c.precioPorGalon),
            fmtNum(c.horometro), fmt(c.total)
        ]),
        { 5: { halign: 'right' } },
        { redCols: [5], totalRow: ['', '', `${fmtNum(galTot)} gal`, '', '', fmt(total)] }
    );

    pie(doc, 'Reporte de Combustible');
    doc.save('reporte-combustible.pdf');
}

// ══════════════════════════════════════════════════════════════
// 7. RESUMEN COMPARATIVO POR MÁQUINAS
// ══════════════════════════════════════════════════════════════
function pdfResumenMaquinas(maquinas, ingresos, gastos, combustibles, mantenimientos) {
    const filas = maquinas.map(m => {
        const ing  = ingresos.filter(x => x.maquinaNombre === m.nombre).reduce((a, x) => a + (x.total || 0), 0);
        const gas  = gastos.filter(x => x.maquinaNombre === m.nombre).reduce((a, x) => a + (x.monto || 0), 0);
        const comb = combustibles.filter(x => x.maquinaNombre === m.nombre).reduce((a, x) => a + (x.total || 0), 0);
        const mant = mantenimientos.filter(x => x.maquinaNombre === m.nombre).reduce((a, x) => a + (x.costo || 0), 0);
        const totalGas = gas + comb + mant;
        const utilidad = ing - totalGas;
        return { nombre: m.nombre, tipo: m.tipo || '—', ing, gas, comb, mant, totalGas, utilidad };
    }).sort((a, b) => b.utilidad - a.utilidad);

    const totIng  = filas.reduce((a, f) => a + f.ing, 0);
    const totGas  = filas.reduce((a, f) => a + f.totalGas, 0);
    const totUtil = totIng - totGas;

    const doc = new jsPDF();
    let y = cabecera(doc, 'Resumen por Máquina', 'Ingresos, gastos y utilidad comparativa de toda la flota');

    y = cajaResumen(doc, y, [
        { label: 'Máquinas',       valor: String(maquinas.length), tipo: 'neu' },
        { label: 'Total ingresos', valor: fmt(totIng),  tipo: 'ing',  _raw: totIng },
        { label: 'Total gastos',   valor: fmt(totGas),  tipo: 'gas',  _raw: totGas },
        { label: 'Utilidad total', valor: fmt(totUtil), tipo: 'util', _raw: totUtil },
    ]);

    y = barChart(doc, y, filas.slice(0, 6).map(f => ({
        label: f.nombre,
        valor: f.utilidad,
        color: f.utilidad >= 0 ? VERDE : ROJO,
    })), 'Utilidad por máquina');

    y = seccion(doc, y, 'COMPARATIVO POR MÁQUINA (ordenado por utilidad)');
    y = tabla(doc, y,
        ['Máquina', 'Tipo', 'Ingresos', 'Gastos', 'Combustible', 'Mant.', 'Utilidad'],
        filas.map(f => [f.nombre, f.tipo, fmt(f.ing), fmt(f.gas), fmt(f.comb), fmt(f.mant), fmt(f.utilidad)]),
        { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
        {
            greenCols: [2],
            redCols: [3, 4, 5],
            conditionalCols: [6],
            totalRow: ['TOTAL FLOTA', '', fmt(totIng), fmt(totGas), '', '', fmt(totUtil)],
        }
    );

    pie(doc, 'Resumen por Máquina');
    doc.save('reporte-maquinas-comparativo.pdf');
}

// ══════════════════════════════════════════════════════════════
// 8. REPORTE DE PERIODOS
// ══════════════════════════════════════════════════════════════
function pdfPeriodos(faenas) {
    const cerradas = faenas.filter(f => f.estado === 'cerrada');
    const activas  = faenas.filter(f => f.estado === 'activa');

    const totIng  = cerradas.reduce((a, f) => a + (f.totalIngresos || 0), 0);
    const totGas  = cerradas.reduce((a, f) => a + (f.totalGastos || 0), 0);
    const totUtil = cerradas.reduce((a, f) => a + (f.utilidadNeta || 0), 0);

    const doc = new jsPDF();
    let y = cabecera(doc, 'Reporte de Periodos', 'Historial de periodos de trabajo por máquina');

    y = cajaResumen(doc, y, [
        { label: 'Periodos cerrados', valor: String(cerradas.length), tipo: 'neu' },
        { label: 'En campo',          valor: String(activas.length),  tipo: activas.length > 0 ? 'ing' : 'neu' },
        { label: 'Ingresos totales',  valor: fmt(totIng),  tipo: 'ing', _raw: totIng },
        { label: 'Utilidad acum.',    valor: fmt(totUtil), tipo: 'util', _raw: totUtil },
    ]);

    if (activas.length) {
        y = seccion(doc, y, `PERIODOS ACTIVOS (${activas.length})`);
        y = tabla(doc, y,
            ['Máquina', 'Obra', 'Cliente', 'Inicio'],
            activas.map(f => [f.maquinaNombre || '—', f.nombreObra || '—', f.cliente || '—', f.fechaInicio || '—']),
            {}, {}
        );
    }

    if (cerradas.length) {
        y = seccion(doc, y, `PERIODOS CERRADOS (${cerradas.length})`);
        y = tabla(doc, y,
            ['Máquina', 'Obra', 'Cliente', 'Inicio', 'Cierre', 'Ingresos', 'Gastos', 'Utilidad'],
            cerradas.map(f => [
                f.maquinaNombre || '—', f.nombreObra || '—', f.cliente || '—',
                f.fechaInicio || '—', f.fechaFin || '—',
                fmt(f.totalIngresos), fmt(f.totalGastos), fmt(f.utilidadNeta)
            ]),
            { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
            {
                greenCols: [5],
                redCols: [6],
                conditionalCols: [7],
                totalRow: ['TOTAL', '', '', '', '', fmt(totIng), fmt(totGas), fmt(totUtil)],
            }
        );
    }

    if (!faenas.length) {
        doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text('No hay periodos registrados', 14, y + 8);
    }

    pie(doc, 'Reporte de Periodos');
    doc.save('reporte-periodos.pdf');
}

// ══════════════════════════════════════════════════════════════
// 9. GASTOS POR MÁQUINA DESGLOSADO POR PERIODOS
// ══════════════════════════════════════════════════════════════
// incluirSueldo: false deja fuera los pagos y salarios del operador (así sale por defecto)
function pdfGastosPorPeriodo(maqNombre, gastos, faenas, faenaIdFiltro, incluirSueldo = false) {
    const gasMaq = gastos.filter(x => x.maquinaNombre === maqNombre && (incluirSueldo || !esSueldoOperador(x)));
    let faenasMaq = faenas
        .filter(f => f.maquinaNombre === maqNombre)
        .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));

    const filtrando = !!faenaIdFiltro;
    if (filtrando) faenasMaq = faenasMaq.filter(f => String(f.id) === String(faenaIdFiltro));

    const sinPeriodo  = filtrando ? [] : gasMaq.filter(x => !x.faenaId);
    const totalGastos = filtrando
        ? gasMaq.filter(x => String(x.faenaId) === String(faenaIdFiltro)).reduce((a, x) => a + (x.monto || 0), 0)
        : gasMaq.reduce((a, x) => a + (x.monto || 0), 0);

    const periodoLabel = filtrando ? (faenasMaq[0]?.nombreObra || 'Periodo') : 'Todos los periodos';
    const doc = new jsPDF();
    let y = cabecera(doc, 'Gastos por Periodos', `Máquina: ${maqNombre}  ·  Periodo: ${periodoLabel}`);

    y = cajaResumen(doc, y, [
        { label: 'Máquina',      valor: maqNombre, tipo: 'neu' },
        { label: 'Periodo(s)',   valor: String(faenasMaq.length), tipo: 'neu' },
        { label: 'Total gastos', valor: fmt(totalGastos), tipo: 'gas', _raw: totalGastos },
        { label: filtrando ? 'Estado' : 'Sin periodo',
          valor: filtrando ? (faenasMaq[0]?.estado || '—') : fmt(sinPeriodo.reduce((a, x) => a + (x.monto || 0), 0)),
          tipo: 'neu' },
    ]);

    faenasMaq.forEach((f, idx) => {
        const gasF     = gasMaq.filter(x => String(x.faenaId) === String(f.id));
        const subTotal = gasF.reduce((a, x) => a + (x.monto || 0), 0);
        const estado   = f.estado === 'activa' ? '[ACTIVO]' : 'Cerrado';
        const rango    = `${f.fechaInicio || '—'} → ${f.fechaFin || 'Activo'}`;
        y = seccion(doc, y, `PERIODO ${faenasMaq.length - idx}: ${f.nombreObra || '—'} · ${rango} · ${estado}`);
        if (f.cliente) { doc.setFontSize(7); doc.setTextColor(...GRIS); doc.text(`Cliente: ${f.cliente}`, 17, y + 3); y += 6; }
        if (gasF.length) {
            y = tabla(doc, y, ['Fecha', 'Descripción', 'Categoría', 'Monto'],
                gasF.map(x => [x.fecha || '—', x.descripcion || '—', x.categoria || '—', fmt(x.monto)]),
                { 3: { halign: 'right' } },
                { redCols: [3], totalRow: ['', '', 'SUBTOTAL', fmt(subTotal)] }
            );
        } else { doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text('Sin gastos en este periodo', 17, y + 4); y += 10; }
    });

    if (!filtrando && sinPeriodo.length) {
        y = seccion(doc, y, `SIN PERIODO ASIGNADO (${sinPeriodo.length})`);
        y = tabla(doc, y, ['Fecha', 'Descripción', 'Categoría', 'Monto'],
            sinPeriodo.map(x => [x.fecha || '—', x.descripcion || '—', x.categoria || '—', fmt(x.monto)]),
            { 3: { halign: 'right' } },
            { redCols: [3] }
        );
    }

    const sufijo = filtrando ? `-p${faenaIdFiltro}` : '';
    pie(doc, `Gastos por Periodos — ${maqNombre}`);
    doc.save(`gastos-periodos-${maqNombre.replace(/\s+/g, '-')}${sufijo}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// 10. INGRESOS POR MÁQUINA DESGLOSADO POR PERIODOS
// ══════════════════════════════════════════════════════════════
function pdfIngresosPorPeriodo(maqNombre, ingresos, faenas, faenaIdFiltro) {
    const ingMaq = ingresos.filter(x => x.maquinaNombre === maqNombre);
    let faenasMaq = faenas
        .filter(f => f.maquinaNombre === maqNombre)
        .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));

    const filtrando = !!faenaIdFiltro;
    if (filtrando) faenasMaq = faenasMaq.filter(f => String(f.id) === String(faenaIdFiltro));

    const sinPeriodo = filtrando ? [] : ingMaq.filter(x => !x.faenaId);
    const totalIng   = filtrando
        ? ingMaq.filter(x => String(x.faenaId) === String(faenaIdFiltro)).reduce((a, x) => a + (x.total || 0), 0)
        : ingMaq.reduce((a, x) => a + (x.total || 0), 0);

    const periodoLabel = filtrando ? (faenasMaq[0]?.nombreObra || 'Periodo') : 'Todos los periodos';
    const doc = new jsPDF();
    let y = cabecera(doc, 'Ingresos por Periodos', `Máquina: ${maqNombre}  ·  Periodo: ${periodoLabel}`);

    y = cajaResumen(doc, y, [
        { label: 'Máquina',        valor: maqNombre, tipo: 'neu' },
        { label: 'Periodo(s)',     valor: String(faenasMaq.length), tipo: 'neu' },
        { label: 'Total ingresos', valor: fmt(totalIng), tipo: 'ing', _raw: totalIng },
        { label: filtrando ? 'Estado' : 'Sin periodo',
          valor: filtrando ? (faenasMaq[0]?.estado || '—') : String(sinPeriodo.length),
          tipo: 'neu' },
    ]);

    faenasMaq.forEach((f, idx) => {
        const ingF     = ingMaq.filter(x => String(x.faenaId) === String(f.id));
        const subTotal = ingF.reduce((a, x) => a + (x.total || 0), 0);
        const estado   = f.estado === 'activa' ? '[ACTIVO]' : 'Cerrado';
        const rango    = `${f.fechaInicio || '—'} → ${f.fechaFin || 'Activo'}`;
        y = seccion(doc, y, `PERIODO ${faenasMaq.length - idx}: ${f.nombreObra || '—'} · ${rango} · ${estado}`);
        if (f.cliente) { doc.setFontSize(7); doc.setTextColor(...GRIS); doc.text(`Cliente: ${f.cliente}`, 17, y + 3); y += 6; }
        if (ingF.length) {
            y = tabla(doc, y, ['Fecha', 'Descripción', 'Tipo', 'Cantidad', 'Valor unit.', 'Total'],
                ingF.map(x => [x.fecha || '—', x.descripcion || '—', x.tipoTrabajo || '—',
                    fmtNum(x.cantidad), fmt(x.valorUnitario), fmt(x.total)]),
                { 5: { halign: 'right' } },
                { greenCols: [5], totalRow: ['', '', '', '', 'SUBTOTAL', fmt(subTotal)] }
            );
        } else { doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text('Sin ingresos en este periodo', 17, y + 4); y += 10; }
    });

    if (!filtrando && sinPeriodo.length) {
        y = seccion(doc, y, `SIN PERIODO ASIGNADO (${sinPeriodo.length})`);
        y = tabla(doc, y, ['Fecha', 'Descripción', 'Tipo', 'Cantidad', 'Valor unit.', 'Total'],
            sinPeriodo.map(x => [x.fecha || '—', x.descripcion || '—', x.tipoTrabajo || '—',
                fmtNum(x.cantidad), fmt(x.valorUnitario), fmt(x.total)]),
            { 5: { halign: 'right' } },
            { greenCols: [5] }
        );
    }

    const sufijo = filtrando ? `-p${faenaIdFiltro}` : '';
    pie(doc, `Ingresos por Periodos — ${maqNombre}`);
    doc.save(`ingresos-periodos-${maqNombre.replace(/\s+/g, '-')}${sufijo}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// 11. REPORTE POR PERIODO DE MÁQUINA (ingresos + gastos + utilidad juntos)
// ══════════════════════════════════════════════════════════════
function pdfPeriodoMaquina(maqNombre, ingresos, gastos, faenas, faenaIdFiltro) {
    const ingMaq = ingresos.filter(x => x.maquinaNombre === maqNombre);
    const gasMaq = gastos.filter(x => x.maquinaNombre === maqNombre);
    let faenasMaq = faenas
        .filter(f => f.maquinaNombre === maqNombre)
        .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));

    const filtrando = !!faenaIdFiltro;
    if (filtrando) faenasMaq = faenasMaq.filter(f => String(f.id) === String(faenaIdFiltro));

    const totIng = faenasMaq.reduce((a, f) => a + ingMaq.filter(x => String(x.faenaId) === String(f.id)).reduce((s, x) => s + (x.total || 0), 0), 0);
    const totGas = faenasMaq.reduce((a, f) => a + gasMaq.filter(x => String(x.faenaId) === String(f.id)).reduce((s, x) => s + (x.monto || 0), 0), 0);
    const totUtil = totIng - totGas;

    const periodoLabel = filtrando ? (faenasMaq[0]?.nombreObra || 'Periodo') : 'Todos los periodos';
    const doc = new jsPDF();
    let y = cabecera(doc, 'Reporte por Periodo', `Máquina: ${maqNombre}  ·  Periodo: ${periodoLabel}`);

    y = cajaResumen(doc, y, [
        { label: 'Periodo(s)',      valor: String(faenasMaq.length), tipo: 'neu' },
        { label: 'Total ingresos',  valor: fmt(totIng),  tipo: 'ing', _raw: totIng },
        { label: 'Total gastos',    valor: fmt(totGas),  tipo: 'gas', _raw: totGas },
        { label: 'Utilidad',        valor: fmt(totUtil), tipo: 'util', _raw: totUtil },
    ]);

    if (!faenasMaq.length) {
        doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text('No hay periodos registrados para esta máquina', 14, y + 8);
    }

    faenasMaq.forEach((f, idx) => {
        const ingF = ingMaq.filter(x => String(x.faenaId) === String(f.id));
        const gasF = gasMaq.filter(x => String(x.faenaId) === String(f.id));
        const subIng = ingF.reduce((a, x) => a + (x.total || 0), 0);
        const subGas = gasF.reduce((a, x) => a + (x.monto || 0), 0);
        const estado = f.estado === 'activa' ? '[ACTIVO]' : 'Cerrado';
        const rango  = `${f.fechaInicio || '—'} → ${f.fechaFin || 'Activo'}`;
        y = seccion(doc, y, `PERIODO ${faenasMaq.length - idx}: ${f.nombreObra || '—'} · ${rango} · ${estado} · Utilidad: ${fmt(subIng - subGas)}`);
        if (f.cliente) { doc.setFontSize(7); doc.setTextColor(...GRIS); doc.text(`Cliente: ${f.cliente}`, 17, y + 3); y += 6; }

        if (ingF.length) {
            y = tabla(doc, y, ['Fecha', 'Descripción', 'Tipo', 'Total'],
                ingF.map(x => [x.fecha || '—', x.descripcion || '—', x.tipoTrabajo || '—', fmt(x.total)]),
                { 3: { halign: 'right' } },
                { greenCols: [3], totalRow: ['', '', 'INGRESOS', fmt(subIng)] }
            );
        }
        if (gasF.length) {
            y = tabla(doc, y, ['Fecha', 'Descripción', 'Categoría', 'Monto'],
                gasF.map(x => [x.fecha || '—', x.descripcion || '—', x.categoria || '—', fmt(x.monto)]),
                { 3: { halign: 'right' } },
                { redCols: [3], totalRow: ['', '', 'GASTOS', fmt(subGas)] }
            );
        }
        if (!ingF.length && !gasF.length) {
            doc.setFontSize(8); doc.setTextColor(...GRIS);
            doc.text('Sin ingresos ni gastos en este periodo', 17, y + 4); y += 10;
        }
    });

    const sufijo = filtrando ? `-p${faenaIdFiltro}` : '';
    pie(doc, `Reporte por Periodo — ${maqNombre}`);
    doc.save(`reporte-periodo-${maqNombre.replace(/\s+/g, '-')}${sufijo}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE
// ══════════════════════════════════════════════════════════════
const sumar = (arr, campo) => arr.reduce((a, x) => a + (x[campo] || 0), 0);
const porPeriodo = (arr, maq, periodo) =>
    arr.filter(x => x.maquinaNombre === maq && (!periodo || String(x.faenaId) === String(periodo)));
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function Reportes() {
    const toast = useToast();
    const [maquinas,       setMaquinas]       = useState([]);
    const [ingresos,       setIngresos]       = useState([]);
    const [gastos,         setGastos]         = useState([]);
    const [salarios,       setSalarios]       = useState([]);
    const [horas,          setHoras]          = useState([]);
    const [mantenimientos, setMantenimientos] = useState([]);
    const [combustibles,   setCombustibles]   = useState([]);
    const [faenas,         setFaenas]         = useState([]);
    const [cargando,       setCargando]       = useState(true);
    const [errorCarga,     setErrorCarga]     = useState(false);
    const [generando,      setGenerando]      = useState('');
    const [errorExport,    setErrorExport]    = useState('');

    const [reporte,        setReporte]        = useState('mensual');
    const [mesSel,         setMesSel]         = useState('');
    const [otroMes,        setOtroMes]        = useState(false);
    const [maqSel,         setMaqSel]         = useState('');
    const [periodoSel,     setPeriodoSel]     = useState('');
    const [incluirSueldo,  setIncluirSueldo]  = useState(false);

    useEffect(() => {
        Promise.all([
            getMaquinas(), getIngresos(), getGastos(), getSalarios(),
            getHoras(), getMantenimientos(), getCombustible(), getFaenas()
        ]).then(([maq, ing, gas, sal, hrs, mant, comb, fae]) => {
            setMaquinas(maq.data);
            setIngresos(ing.data);
            setGastos(gas.data);
            setSalarios(sal.data);
            setHoras(hrs.data);
            setMantenimientos(mant.data);
            setCombustibles(comb.data);
            setFaenas(fae.data || []);
            if (maq.data.length) setMaqSel(maq.data[0].nombre);
        }).catch(e => { console.error(e); setErrorCarga(true); }).finally(() => setCargando(false));
    }, []);

    // Meses con movimiento, del más reciente al más antiguo (siempre incluye el mes actual)
    const meses = useMemo(() => {
        const hoy = new Date();
        const set = new Set([`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`]);
        [...ingresos, ...gastos, ...salarios].forEach(x => { if (x.fecha && x.fecha.length >= 7) set.add(x.fecha.slice(0, 7)); });
        return [...set].sort().reverse().map(value => {
            const [a, m] = value.split('-');
            return { value, label: new Date(a, m - 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) };
        });
    }, [ingresos, gastos, salarios]);
    const mes = mesSel || meses[0]?.value || '';
    const mesesRecientes = meses.slice(0, 3);
    const mesEnOtros = !!mes && !mesesRecientes.some(m => m.value === mes);

    // Periodos de la máquina elegida; si solo hay uno queda elegido
    const periodos = useMemo(() => faenas.filter(f => f.maquinaNombre === maqSel)
        .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || '')), [faenas, maqSel]);
    const periodo = periodos.some(f => String(f.id) === String(periodoSel)) ? String(periodoSel)
        : periodos.length === 1 ? String(periodos[0].id) : '';
    const periodoLabel = periodo ? (periodos.find(f => String(f.id) === periodo)?.nombreObra || 'Periodo') : 'Todos los periodos';

    const cambiarReporte = (id) => { setReporte(id); setErrorExport(''); };
    const cambiarMaquina = (v) => { setMaqSel(v); setPeriodoSel(''); setErrorExport(''); };

    const ejecutar = async (tipo, fn) => {
        setGenerando(tipo);
        setErrorExport('');
        try {
            await fn();
            toast(tipo === 'pdf' ? 'PDF generado' : 'Excel generado');
        } catch (e) {
            console.error(e);
            setErrorExport('No se pudo generar el reporte. Intenta de nuevo.');
            toast('Error generando el reporte', 'e');
        } finally { setGenerando(''); }
    };

    // ── métricas reales para la vista previa de cada reporte (nada inventado) ──
    const ingMes = ingresos.filter(x => x.fecha?.startsWith(mes));
    const gasMes = gastos.filter(x => x.fecha?.startsWith(mes));
    const utilMes = sumar(ingMes, 'total') - sumar(gasMes, 'monto');

    const ingMaq = ingresos.filter(x => x.maquinaNombre === maqSel);
    const gasMaq = gastos.filter(x => x.maquinaNombre === maqSel);

    const ingPer = porPeriodo(ingresos, maqSel, periodo);
    const gasPer = porPeriodo(gastos, maqSel, periodo);
    const gasPerSueldo = gasPer.filter(x => incluirSueldo || !esSueldoOperador(x));
    const utilPer = sumar(ingPer, 'total') - sumar(gasPer, 'monto');

    const maquinaObj = maquinas.find(m => m.nombre === maqSel);
    const selPeriodo = (
        <MaquinaPeriodo maquinas={maquinas} maq={maqSel} onMaq={cambiarMaquina}
            periodos={periodos} periodo={periodo} onPeriodo={setPeriodoSel} />
    );
    const selMaquina = (
        <div className="rv-fila">
            <Campo etiqueta="Máquina" id="rv-maq">
                <select id="rv-maq" className="rv-select" value={maqSel} onChange={e => cambiarMaquina(e.target.value)}>
                    {maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                </select>
            </Campo>
        </div>
    );

    const REPORTES = [
        {
            id: 'mensual', titulo: 'Reporte mensual',
            desc: 'Ingresos, gastos, salarios y utilidad de un mes',
            params: (
                <>
                    <div className="rv-campo">
                        <span className="rv-etq">Mes</span>
                        <div className="rv-chips" role="group" aria-label="Mes">
                            {mesesRecientes.map(m => (
                                <button type="button" key={m.value} className={`rv-chip ${mes === m.value && !otroMes ? 'on' : ''}`}
                                    aria-pressed={mes === m.value && !otroMes}
                                    onClick={() => { setMesSel(m.value); setOtroMes(false); }}>{m.label}</button>
                            ))}
                            {meses.length > 3 && (
                                <button type="button" className={`rv-chip ${otroMes || mesEnOtros ? 'on' : ''}`}
                                    aria-pressed={otroMes || mesEnOtros} onClick={() => setOtroMes(true)}>Otro mes</button>
                            )}
                        </div>
                        {(otroMes || mesEnOtros) && (
                            <select className="rv-select rv-otro" aria-label="Elegir otro mes" value={mes}
                                onChange={e => setMesSel(e.target.value)}>
                                {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        )}
                    </div>
                </>
            ),
            n: ingMes.length + gasMes.length, total: utilMes, tono: utilMes >= 0 ? 'pos' : 'neg',
            detalle: `${plural(ingMes.length, 'ingreso', 'ingresos')} · ${plural(gasMes.length, 'gasto', 'gastos')}`,
            vacio: 'Este mes no tiene ingresos ni gastos.',
            pdf: () => pdfMensual(mes, ingresos, gastos, salarios),
            xls: () => xlsMensual(mes, ingresos, gastos, salarios),
        },
        {
            id: 'maquina', titulo: 'Reporte por máquina',
            desc: 'Ingresos, gastos, combustible y horas de una máquina',
            params: selMaquina,
            n: ingMaq.length + gasMaq.length, total: sumar(ingMaq, 'total'), tono: 'pos',
            detalle: `${plural(ingMaq.length, 'ingreso', 'ingresos')} · ${plural(gasMaq.length, 'gasto', 'gastos')}`,
            vacio: 'Esta máquina no tiene ingresos ni gastos.',
            pdf: () => { if (maquinaObj) pdfMaquina(maquinaObj, ingresos, gastos, combustibles, mantenimientos, horas); },
            xls: () => { if (maquinaObj) return xlsMaquina(maquinaObj, ingresos, gastos, combustibles, mantenimientos, horas); },
        },
        {
            id: 'periodo', titulo: 'Reporte por periodo',
            desc: 'Ingresos, gastos y utilidad de un periodo de una máquina, juntos',
            params: selPeriodo,
            n: ingPer.length + gasPer.length, total: utilPer, tono: utilPer >= 0 ? 'pos' : 'neg',
            detalle: periodoLabel,
            vacio: 'Este periodo no tiene ingresos ni gastos.',
            pdf: () => pdfPeriodoMaquina(maqSel, ingresos, gastos, faenas, periodo),
            xls: () => xlsPeriodoMaquina(maqSel, ingresos, gastos, faenas, periodo),
        },
        {
            id: 'ingresos-periodos', titulo: 'Ingresos por periodo',
            desc: 'Desglosa los ingresos de una máquina, periodo por periodo',
            params: selPeriodo,
            n: ingPer.length, total: sumar(ingPer, 'total'), tono: 'pos',
            detalle: periodoLabel,
            vacio: 'Este periodo no tiene ingresos.',
            pdf: () => pdfIngresosPorPeriodo(maqSel, ingresos, faenas, periodo),
            xls: () => xlsIngresosPorPeriodo(maqSel, ingresos, faenas, periodo),
        },
        {
            id: 'gastos-periodos', titulo: 'Gastos por periodo',
            desc: 'Desglosa los gastos de una máquina, periodo por periodo',
            params: (
                <>
                    {selPeriodo}
                    <label className="rv-check">
                        <input type="checkbox" checked={incluirSueldo} onChange={e => setIncluirSueldo(e.target.checked)} />
                        <span>Incluir el sueldo del operador</span>
                    </label>
                </>
            ),
            n: gasPerSueldo.length, total: sumar(gasPerSueldo, 'monto'), tono: 'neg',
            detalle: periodoLabel,
            vacio: 'Este periodo no tiene gastos.',
            pdf: () => pdfGastosPorPeriodo(maqSel, gastos, faenas, periodo, incluirSueldo),
            xls: () => xlsGastosPorPeriodo(maqSel, gastos, faenas, periodo, incluirSueldo),
        },
        {
            id: 'corte', titulo: 'Reporte por corte',
            desc: 'Ingresos, gastos o ambos de uno o varios cortes de un periodo',
        },
    ];

    const actual = REPORTES.find(r => r.id === reporte) || REPORTES[0];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Reportes</h1><p>Elige un reporte, ajusta lo que necesitas y descárgalo en PDF o Excel</p></div>
            </div>

            <div className="content"><div className="pad">

                {cargando && (
                    <div className="ale">
                        <Loader size={18} className="rv-spin" aria-hidden="true" />
                        <div><p>Cargando datos...</p></div>
                    </div>
                )}

                {!cargando && errorCarga && (
                    <div className="ale" role="alert"><div><p>No se pudieron cargar los datos. Recarga la página para intentarlo de nuevo.</p></div></div>
                )}

                {!cargando && !errorCarga && (
                    <div className="rv-layout">
                        <nav className="rv-lista" aria-label="Tipos de reporte">
                            {REPORTES.map(r => (
                                <button type="button" key={r.id} className={`rv-item ${r.id === actual.id ? 'on' : ''}`}
                                    aria-pressed={r.id === actual.id} onClick={() => cambiarReporte(r.id)}>
                                    <strong>{r.titulo}</strong>
                                    <span>{r.desc}</span>
                                </button>
                            ))}
                        </nav>

                        <article className="rv-panel">
                            <header className="rv-cab">
                                <h2>{actual.titulo}</h2>
                                <p>{actual.desc}</p>
                            </header>

                            {actual.id === 'corte' ? (
                                <ReporteCorte maquinas={maquinas} ingresos={ingresos} gastos={gastos} faenas={faenas}
                                    maq={maqSel} onMaq={cambiarMaquina} periodoId={periodo} onPeriodo={setPeriodoSel}
                                    generando={generando} ejecutar={ejecutar} error={errorExport} />
                            ) : (
                                <>
                                    <div className="rv-params">{actual.params}</div>
                                    <VistaPrevia total={actual.total} tono={actual.tono} detalle={actual.detalle}
                                        sinDatos={actual.n === 0} mensajeVacio={actual.vacio}
                                        generando={generando} error={errorExport}
                                        onPdf={() => ejecutar('pdf', actual.pdf)} onXls={() => ejecutar('xls', actual.xls)} />
                                </>
                            )}
                        </article>
                    </div>
                )}

            </div></div>
        </div>
    );
}

export default Reportes;
