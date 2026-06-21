import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '../../utils/toast';
import {
    getMaquinas, getIngresos, getGastos, getSalarios,
    getHoras, getMantenimientos, getCombustible, getPagos, getFaenas
} from '../../api';
import { BarChart2, Tractor, HardHat, Wrench, CreditCard, Fuel, Loader, Clock, Briefcase } from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────
const fmt    = (v) => '$' + (v || 0).toLocaleString('es-CO');
const fmtNum = (v) => (v || 0).toLocaleString('es-CO');
const AZUL   = [13, 27, 42];      // #0d1b2a
const DORADO = [245, 166, 35];    // #f5a623
const GRIS   = [107, 122, 141];

// ── cabecera estándar de cada PDF ──────────────────────────────
function cabecera(doc, titulo, subtitulo) {
    // barra superior
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, 210, 22, 'F');

    // nombre app
    doc.setTextColor(245, 166, 35);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MaquiControl', 14, 14);

    // fecha generación
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(`Generado: ${hoy}`, 196, 14, { align: 'right' });

    // título del reporte
    doc.setTextColor(...AZUL);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, 14, 33);

    if (subtitulo) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRIS);
        doc.text(subtitulo, 14, 39);
    }

    // línea separadora dorada
    doc.setDrawColor(...DORADO);
    doc.setLineWidth(0.8);
    doc.line(14, 43, 196, 43);

    return 48; // y de inicio del contenido
}

// ── caja resumen ───────────────────────────────────────────────
function cajaResumen(doc, y, items) {
    const col = 60;
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(14, y, 182, 18, 2, 2, 'F');
    items.forEach((item, i) => {
        const x = 20 + i * col;
        doc.setFontSize(7);
        doc.setTextColor(...GRIS);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, x, y + 7);
        doc.setFontSize(10);
        doc.setTextColor(...AZUL);
        doc.setFont('helvetica', 'bold');
        doc.text(item.valor, x, y + 14);
    });
    return y + 24;
}

// ── sección con título ─────────────────────────────────────────
function seccion(doc, y, texto) {
    doc.setFillColor(...AZUL);
    doc.rect(14, y, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(texto, 17, y + 5);
    return y + 9;
}

// ── tabla con autoTable ────────────────────────────────────────
function tabla(doc, y, head, body, colStyles) {
    autoTable(doc, {
        startY: y,
        head: [head],
        body,
        theme: 'grid',
        headStyles: { fillColor: DORADO, textColor: AZUL, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: 14, right: 14 },
        columnStyles: colStyles || {},
    });
    return doc.lastAutoTable.finalY + 6;
}

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

    const totIng = ingMes.reduce((a, x) => a + (x.total || 0), 0);
    const totGas = gasMes.reduce((a, x) => a + (x.monto || 0), 0);
    const totSal = salMes.reduce((a, x) => a + (x.totalNeto || 0), 0);
    const utilidad = totIng - totGas;

    const doc = new jsPDF();
    let y = cabecera(doc, 'Reporte Mensual', label.charAt(0).toUpperCase() + label.slice(1));

    y = cajaResumen(doc, y, [
        { label: 'Total Ingresos', valor: fmt(totIng) },
        { label: 'Total Gastos',   valor: fmt(totGas) },
        { label: 'Utilidad',       valor: fmt(utilidad) },
        { label: 'Salarios neto',  valor: fmt(totSal) },
    ]);

    // Ingresos
    y = seccion(doc, y, `INGRESOS (${ingMes.length} registros)`);
    if (ingMes.length) {
        y = tabla(doc, y,
            ['Fecha', 'Máquina', 'Descripción', 'Tipo', 'Total'],
            ingMes.map(x => [x.fecha || '—', x.maquinaNombre || '—', x.descripcion || '—', x.tipoTrabajo || '—', fmt(x.total)]),
            { 4: { halign: 'right' } }
        );
    } else {
        doc.setFontSize(8); doc.setTextColor(...GRIS);
        doc.text('Sin ingresos en este período', 17, y + 5); y += 12;
    }

    // Gastos
    y = seccion(doc, y, `GASTOS (${gasMes.length} registros)`);
    if (gasMes.length) {
        y = tabla(doc, y,
            ['Fecha', 'Máquina', 'Descripción', 'Categoría', 'Monto'],
            gasMes.map(x => [x.fecha || '—', x.maquinaNombre || '—', x.descripcion || '—', x.categoria || '—', fmt(x.monto)]),
            { 4: { halign: 'right' } }
        );
    } else {
        doc.setFontSize(8); doc.setTextColor(...GRIS);
        doc.text('Sin gastos en este período', 17, y + 5); y += 12;
    }

    // Salarios
    if (salMes.length) {
        y = seccion(doc, y, `SALARIOS (${salMes.length} liquidaciones)`);
        y = tabla(doc, y,
            ['Fecha', 'Operador', 'Horas', 'Bruto', 'Descuentos', 'Neto'],
            salMes.map(x => [x.fecha || '—', x.operadorNombre || '—', `${x.horasTrabajadas || 0} hrs`, fmt(x.totalBruto), fmt(x.descuentos || 0), fmt(x.totalNeto)]),
            { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
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
    const totMant = mantM.reduce((a, x) => a + (x.costo || 0), 0);
    const totHrs  = hrsM.reduce((a, x) => a + (x.horas || 0), 0);

    const doc = new jsPDF();
    let y = cabecera(doc, `Reporte de Máquina`, `${maq.nombre} · ${maq.tipo || ''} · Placa: ${maq.placa || '—'}`);

    y = cajaResumen(doc, y, [
        { label: 'Total Ingresos', valor: fmt(totIng) },
        { label: 'Total Gastos',   valor: fmt(totGas + totComb + totMant) },
        { label: 'Utilidad',       valor: fmt(totIng - totGas - totComb - totMant) },
        { label: 'Horas totales',  valor: `${fmtNum(totHrs)} hrs` },
    ]);

    // Info máquina
    doc.setFontSize(8); doc.setTextColor(...GRIS);
    doc.text(`Operador: ${maq.operadorNombre || '—'}  ·  Horómetro: ${fmtNum(maq.horometroActual)} hrs  ·  Estado: ${maq.estado || '—'}  ·  Valor/hr operador: ${fmt(maq.valorHoraOperador)}  ·  Valor/hr máquina: ${fmt(maq.valorHoraMaquina || 0)}`, 14, y);
    y += 10;

    if (ingM.length) {
        y = seccion(doc, y, `INGRESOS (${ingM.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Descripción', 'Tipo', 'Cantidad', 'Valor unit.', 'Total'],
            ingM.map(x => [x.fecha || '—', x.descripcion || '—', x.tipoTrabajo || '—', fmtNum(x.cantidad), fmt(x.valorUnitario), fmt(x.total)]),
            { 5: { halign: 'right' } }
        );
    }

    if (gasM.length) {
        y = seccion(doc, y, `GASTOS (${gasM.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Descripción', 'Categoría', 'Monto'],
            gasM.map(x => [x.fecha || '—', x.descripcion || '—', x.categoria || '—', fmt(x.monto)]),
            { 3: { halign: 'right' } }
        );
    }

    if (combM.length) {
        y = seccion(doc, y, `COMBUSTIBLE (${combM.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Galones', 'Precio/Gal', 'Horómetro', 'Total'],
            combM.map(x => [x.fecha || '—', `${x.galones || 0} gal`, fmt(x.precioPorGalon), fmtNum(x.horometro), fmt(x.total)]),
            { 4: { halign: 'right' } }
        );
    }

    if (hrsM.length) {
        y = seccion(doc, y, `HORAS TRABAJADAS (${hrsM.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Operador', 'Horas', 'Valor/hr', 'Valor ganado'],
            hrsM.map(x => [x.fecha || '—', x.operadorNombre || '—', `${x.horas || 0} hrs`, fmt(x.valorHora), fmt((x.horas || 0) * (x.valorHora || 0))]),
            { 4: { halign: 'right' } }
        );
    }

    pie(doc, `Reporte máquina — ${maq.nombre}`);
    doc.save(`reporte-maquina-${maq.nombre.replace(/\s+/g, '-')}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// 3. REPORTE OPERADORES
// ══════════════════════════════════════════════════════════════
function pdfOperadores(horas, salarios, maquinas) {
    // Agrupar por operador
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

    // Resumen general
    const totHrs = horas.reduce((a, h) => a + (h.horas || 0), 0);
    const totSal = salarios.reduce((a, s) => a + (s.totalNeto || 0), 0);
    const pendientes = salarios.filter(s => s.estado === 'Pendiente').length;
    y = cajaResumen(doc, y, [
        { label: 'Total operadores',  valor: String(Object.keys(ops).length) },
        { label: 'Horas acumuladas',  valor: `${fmtNum(totHrs)} hrs` },
        { label: 'Total salarios',    valor: fmt(totSal) },
        { label: 'Pend. de pago',     valor: String(pendientes) },
    ]);

    // Tabla resumen por operador
    y = seccion(doc, y, 'RESUMEN POR OPERADOR');
    const filas = Object.entries(ops).map(([nombre, data]) => {
        const maq = maquinas.find(m => m.operadorNombre === nombre);
        const hrs = data.horas.reduce((a, h) => a + (h.horas || 0), 0);
        const valorHora = maq?.valorHoraOperador || 0;
        const bruto = hrs * valorHora;
        return [nombre, maq?.nombre || '—', `${fmtNum(hrs)} hrs`, fmt(valorHora), fmt(bruto)];
    });
    y = tabla(doc, y,
        ['Operador', 'Máquina asignada', 'Total horas', 'Valor/hora', 'Salario bruto'],
        filas,
        { 4: { halign: 'right' } }
    );

    // Historial de liquidaciones
    if (salarios.length) {
        y = seccion(doc, y, 'HISTORIAL DE LIQUIDACIONES');
        y = tabla(doc, y,
            ['Fecha', 'Operador', 'Máquina', 'Horas', 'Bruto', 'Descuentos', 'Neto', 'Estado'],
            salarios.map(s => [
                s.fecha || '—', s.operadorNombre || '—', s.maquinaNombre || '—',
                `${s.horasTrabajadas || 0} hrs`, fmt(s.totalBruto),
                fmt(s.descuentos || 0), fmt(s.totalNeto), s.estado || '—'
            ]),
            { 6: { halign: 'right' } }
        );
    }

    pie(doc, 'Reporte de Operadores');
    doc.save('reporte-operadores.pdf');
}

// ══════════════════════════════════════════════════════════════
// 4. REPORTE MANTENIMIENTOS
// ══════════════════════════════════════════════════════════════
function pdfMantenimientos(mantenimientos) {
    const total = mantenimientos.reduce((a, m) => a + (m.costo || 0), 0);

    const doc = new jsPDF();
    let y = cabecera(doc, 'Reporte de Mantenimientos', 'Historial y costos por máquina');

    y = cajaResumen(doc, y, [
        { label: 'Total registros',  valor: String(mantenimientos.length) },
        { label: 'Costo total',      valor: fmt(total) },
        { label: 'Registros',        valor: String(mantenimientos.length) },
        { label: 'Costo promedio',   valor: fmt(mantenimientos.length ? total / mantenimientos.length : 0) },
    ]);

    if (mantenimientos.length) {
        y = seccion(doc, y, `HISTORIAL DE MANTENIMIENTOS (${mantenimientos.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Máquina', 'Tipo', 'Descripción', 'Técnico', 'Costo'],
            mantenimientos.map(m => [
                m.fecha || '—', m.maquinaNombre || '—', m.tipo || '—',
                m.descripcion || '—', m.tecnico || '—', fmt(m.costo)
            ]),
            { 5: { halign: 'right' } }
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
    const cobrado   = pagos.filter(p => p.estado === 'Pagado').reduce((a, p) => a + (p.monto || 0), 0);
    const pendiente = pagos.filter(p => p.estado !== 'Pagado').reduce((a, p) => a + (p.monto || 0), 0);

    const doc = new jsPDF();
    let y = cabecera(doc, 'Reporte de Pagos Clientes', 'Cobros realizados y pendientes');

    y = cajaResumen(doc, y, [
        { label: 'Total registros',  valor: String(pagos.length) },
        { label: 'Cobrado',          valor: fmt(cobrado) },
        { label: 'Pendiente',        valor: fmt(pendiente) },
        { label: 'Total',            valor: fmt(cobrado + pendiente) },
    ]);

    if (pagos.length) {
        y = seccion(doc, y, `PAGOS (${pagos.length})`);
        y = tabla(doc, y,
            ['Fecha', 'Cliente', 'Máquina', 'Descripción', 'Monto', 'Estado'],
            pagos.map(p => [
                p.fecha || '—', p.clienteNombre || p.cliente || '—',
                p.maquinaNombre || '—', p.descripcion || '—',
                fmt(p.monto), p.estado || '—'
            ]),
            { 4: { halign: 'right' } }
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
        { label: 'Total cargas',   valor: String(combustibles.length) },
        { label: 'Total galones',  valor: `${fmtNum(galTot)} gal` },
        { label: 'Gasto total',    valor: fmt(total) },
        { label: 'Precio prom/gl', valor: fmt(galTot ? total / galTot : 0) },
    ]);

    // Resumen por máquina
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
        { 3: { halign: 'right' } }
    );

    y = seccion(doc, y, `HISTORIAL COMPLETO (${combustibles.length})`);
    y = tabla(doc, y,
        ['Fecha', 'Máquina', 'Galones', 'Precio/Gal', 'Horómetro', 'Total'],
        combustibles.map(c => [
            c.fecha || '—', c.maquinaNombre || '—',
            `${c.galones || 0} gal`, fmt(c.precioPorGalon),
            fmtNum(c.horometro), fmt(c.total)
        ]),
        { 5: { halign: 'right' } }
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

    const totIng = filas.reduce((a, f) => a + f.ing, 0);
    const totGas = filas.reduce((a, f) => a + f.totalGas, 0);
    const totUtil = totIng - totGas;

    const doc = new jsPDF();
    let y = cabecera(doc, 'Resumen por Máquina', 'Ingresos, gastos y utilidad comparativa de toda la flota');

    y = cajaResumen(doc, y, [
        { label: 'Máquinas',       valor: String(maquinas.length) },
        { label: 'Total ingresos', valor: fmt(totIng) },
        { label: 'Total gastos',   valor: fmt(totGas) },
        { label: 'Utilidad total', valor: fmt(totUtil) },
    ]);

    y = seccion(doc, y, 'COMPARATIVO POR MÁQUINA (ordenado por utilidad)');
    y = tabla(doc, y,
        ['Máquina', 'Tipo', 'Ingresos', 'Gastos', 'Combustible', 'Mant.', 'Utilidad'],
        filas.map(f => [
            f.nombre, f.tipo, fmt(f.ing), fmt(f.gas), fmt(f.comb), fmt(f.mant),
            fmt(f.utilidad)
        ]),
        { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }
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
        { label: 'Periodos cerrados', valor: String(cerradas.length) },
        { label: 'En campo',          valor: String(activas.length) },
        { label: 'Ingresos totales',  valor: fmt(totIng) },
        { label: 'Utilidad acum.',    valor: fmt(totUtil) },
    ]);

    if (activas.length) {
        y = seccion(doc, y, `PERIODOS ACTIVOS (${activas.length})`);
        y = tabla(doc, y,
            ['Máquina', 'Obra', 'Cliente', 'Inicio'],
            activas.map(f => [f.maquinaNombre || '—', f.nombreObra || '—', f.cliente || '—', f.fechaInicio || '—']),
            {}
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
            { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } }
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
function pdfGastosPorPeriodo(maqNombre, gastos, faenas, faenaIdFiltro) {
    const gasMaq = gastos.filter(x => x.maquinaNombre === maqNombre);
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
        { label: 'Máquina',      valor: maqNombre },
        { label: 'Periodo(s)',   valor: String(faenasMaq.length) },
        { label: 'Total gastos', valor: fmt(totalGastos) },
        { label: filtrando ? 'Estado' : 'Sin periodo',
          valor: filtrando ? (faenasMaq[0]?.estado || '—') : fmt(sinPeriodo.reduce((a, x) => a + (x.monto || 0), 0)) },
    ]);

    faenasMaq.forEach((f, idx) => {
        const gasF    = gasMaq.filter(x => String(x.faenaId) === String(f.id));
        const subTotal = gasF.reduce((a, x) => a + (x.monto || 0), 0);
        const estado  = f.estado === 'activa' ? '● ACTIVO' : 'Cerrado';
        const rango   = `${f.fechaInicio || '—'} → ${f.fechaFin || 'Activo'}`;
        y = seccion(doc, y, `PERIODO ${faenasMaq.length - idx}: ${f.nombreObra || '—'} · ${rango} · ${estado}`);
        if (f.cliente) { doc.setFontSize(7); doc.setTextColor(...GRIS); doc.text(`Cliente: ${f.cliente}`, 17, y + 3); y += 6; }
        if (gasF.length) {
            y = tabla(doc, y, ['Fecha', 'Descripción', 'Categoría', 'Monto'],
                gasF.map(x => [x.fecha || '—', x.descripcion || '—', x.categoria || '—', fmt(x.monto)]),
                { 3: { halign: 'right' } });
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...AZUL);
            doc.text(`Subtotal: ${fmt(subTotal)}`, 182, y - 2, { align: 'right' }); y += 4;
        } else { doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text('Sin gastos en este periodo', 17, y + 4); y += 10; }
    });

    if (!filtrando && sinPeriodo.length) {
        y = seccion(doc, y, `SIN PERIODO ASIGNADO (${sinPeriodo.length})`);
        y = tabla(doc, y, ['Fecha', 'Descripción', 'Categoría', 'Monto'],
            sinPeriodo.map(x => [x.fecha || '—', x.descripcion || '—', x.categoria || '—', fmt(x.monto)]),
            { 3: { halign: 'right' } });
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
        { label: 'Máquina',         valor: maqNombre },
        { label: 'Periodo(s)',       valor: String(faenasMaq.length) },
        { label: 'Total ingresos',   valor: fmt(totalIng) },
        { label: filtrando ? 'Estado' : 'Sin periodo',
          valor: filtrando ? (faenasMaq[0]?.estado || '—') : String(sinPeriodo.length) },
    ]);

    faenasMaq.forEach((f, idx) => {
        const ingF    = ingMaq.filter(x => String(x.faenaId) === String(f.id));
        const subTotal = ingF.reduce((a, x) => a + (x.total || 0), 0);
        const estado  = f.estado === 'activa' ? '● ACTIVO' : 'Cerrado';
        const rango   = `${f.fechaInicio || '—'} → ${f.fechaFin || 'Activo'}`;
        y = seccion(doc, y, `PERIODO ${faenasMaq.length - idx}: ${f.nombreObra || '—'} · ${rango} · ${estado}`);
        if (f.cliente) { doc.setFontSize(7); doc.setTextColor(...GRIS); doc.text(`Cliente: ${f.cliente}`, 17, y + 3); y += 6; }
        if (ingF.length) {
            y = tabla(doc, y, ['Fecha', 'Descripción', 'Tipo', 'Cantidad', 'Valor unit.', 'Total'],
                ingF.map(x => [x.fecha || '—', x.descripcion || '—', x.tipoTrabajo || '—',
                    fmtNum(x.cantidad), fmt(x.valorUnitario), fmt(x.total)]),
                { 5: { halign: 'right' } });
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(39, 174, 96);
            doc.text(`Subtotal: ${fmt(subTotal)}`, 182, y - 2, { align: 'right' }); y += 4;
        } else { doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text('Sin ingresos en este periodo', 17, y + 4); y += 10; }
    });

    if (!filtrando && sinPeriodo.length) {
        y = seccion(doc, y, `SIN PERIODO ASIGNADO (${sinPeriodo.length})`);
        y = tabla(doc, y, ['Fecha', 'Descripción', 'Tipo', 'Cantidad', 'Valor unit.', 'Total'],
            sinPeriodo.map(x => [x.fecha || '—', x.descripcion || '—', x.tipoTrabajo || '—',
                fmtNum(x.cantidad), fmt(x.valorUnitario), fmt(x.total)]),
            { 5: { halign: 'right' } });
    }

    const sufijo = filtrando ? `-p${faenaIdFiltro}` : '';
    pie(doc, `Ingresos por Periodos — ${maqNombre}`);
    doc.save(`ingresos-periodos-${maqNombre.replace(/\s+/g, '-')}${sufijo}.pdf`);
}

// ── pie de página ──────────────────────────────────────────────
function pie(doc, texto) {
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(...GRIS);
        doc.setLineWidth(0.3);
        doc.line(14, 285, 196, 285);
        doc.setFontSize(7);
        doc.setTextColor(...GRIS);
        doc.setFont('helvetica', 'normal');
        doc.text(`MaquiControl — ${texto}`, 14, 290);
        doc.text(`Página ${i} de ${pages}`, 196, 290, { align: 'right' });
    }
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE
// ══════════════════════════════════════════════════════════════
function Reportes() {
    const toast = useToast();
    const [maquinas,       setMaquinas]       = useState([]);
    const [ingresos,       setIngresos]       = useState([]);
    const [gastos,         setGastos]         = useState([]);
    const [salarios,       setSalarios]       = useState([]);
    const [horas,          setHoras]          = useState([]);
    const [mantenimientos, setMantenimientos] = useState([]);
    const [combustibles,   setCombustibles]   = useState([]);
    const [pagos,          setPagos]          = useState([]);
    const [faenas,         setFaenas]         = useState([]);
    const [cargando,       setCargando]       = useState(true);
    const [generando,      setGenerando]      = useState(null);

    const [mesSel,             setMesSel]             = useState('');
    const [maqSel,             setMaqSel]             = useState('');
    const [maqSelGastos,       setMaqSelGastos]       = useState('');
    const [maqSelIngresos,     setMaqSelIngresos]     = useState('');
    const [periodoSelGastos,   setPeriodoSelGastos]   = useState('');
    const [periodoSelIngresos, setPeriodoSelIngresos] = useState('');

    useEffect(() => {
        const now = new Date();
        setMesSel(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

        Promise.all([
            getMaquinas(), getIngresos(), getGastos(), getSalarios(),
            getHoras(), getMantenimientos(), getCombustible(), getPagos(), getFaenas()
        ]).then(([maq, ing, gas, sal, hrs, mant, comb, pag, fae]) => {
            setMaquinas(maq.data);
            setIngresos(ing.data);
            setGastos(gas.data);
            setSalarios(sal.data);
            setHoras(hrs.data);
            setMantenimientos(mant.data);
            setCombustibles(comb.data);
            setPagos(pag.data);
            setFaenas(fae.data || []);
            if (maq.data.length) {
                setMaqSel(maq.data[0].nombre);
                setMaqSelGastos(maq.data[0].nombre);
                setMaqSelIngresos(maq.data[0].nombre);
            }
        }).catch(console.error).finally(() => setCargando(false));
    }, []);

    const meses = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        return {
            value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
        };
    });

    const ejecutar = async (id, fn) => {
        setGenerando(id);
        try { await fn(); }
        catch(e) { console.error(e); toast('Error generando el PDF', 'e'); }
        finally { setGenerando(null); }
    };

    const REPORTES = [
        {
            id: 'mensual', ico: <BarChart2 size={22} />, color: 'r',
            titulo: 'Reporte Mensual',
            desc: 'Ingresos, gastos, salarios y utilidad del mes seleccionado',
            control: (
                <select className="bs" style={{ padding: '6px 10px', fontSize: '12px' }}
                    value={mesSel} onChange={e => setMesSel(e.target.value)}>
                    {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
            ),
            accion: () => pdfMensual(mesSel, ingresos, gastos, salarios),
        },
        {
            id: 'maquina', ico: <Tractor size={22} />, color: 'b',
            titulo: 'Reporte por Máquina',
            desc: 'Ingresos, gastos, combustible y horas de una máquina específica',
            control: (
                <select className="bs" style={{ padding: '6px 10px', fontSize: '12px' }}
                    value={maqSel} onChange={e => setMaqSel(e.target.value)}>
                    {maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                </select>
            ),
            accion: () => {
                const maq = maquinas.find(m => m.nombre === maqSel);
                if (maq) pdfMaquina(maq, ingresos, gastos, combustibles, mantenimientos, horas);
            },
        },
        {
            id: 'gastos-periodos', ico: <BarChart2 size={22} />, color: 'b',
            titulo: 'Gastos por Periodos',
            desc: 'Gastos de una máquina desglosados por periodo — elige uno específico o todos',
            control: (
                <div style={{ display: 'flex', gap: '6px' }}>
                    <select className="bs" style={{ padding: '6px 10px', fontSize: '12px' }}
                        value={maqSelGastos}
                        onChange={e => { setMaqSelGastos(e.target.value); setPeriodoSelGastos(''); }}>
                        {maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                    </select>
                    <select className="bs" style={{ padding: '6px 10px', fontSize: '12px' }}
                        value={periodoSelGastos} onChange={e => setPeriodoSelGastos(e.target.value)}>
                        <option value=''>Todos los periodos</option>
                        {faenas.filter(f => f.maquinaNombre === maqSelGastos)
                            .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''))
                            .map((f, i, arr) => (
                                <option key={f.id} value={f.id}>
                                    {`P${arr.length - i}: ${f.nombreObra || 'Sin nombre'} (${f.fechaInicio || '—'})`}
                                </option>
                            ))}
                    </select>
                </div>
            ),
            accion: () => pdfGastosPorPeriodo(maqSelGastos, gastos, faenas, periodoSelGastos),
        },
        {
            id: 'ingresos-periodos', ico: <Tractor size={22} />, color: 'r',
            titulo: 'Ingresos por Periodos',
            desc: 'Ingresos de una máquina desglosados por periodo — elige uno específico o todos',
            control: (
                <div style={{ display: 'flex', gap: '6px' }}>
                    <select className="bs" style={{ padding: '6px 10px', fontSize: '12px' }}
                        value={maqSelIngresos}
                        onChange={e => { setMaqSelIngresos(e.target.value); setPeriodoSelIngresos(''); }}>
                        {maquinas.map(m => <option key={m.id}>{m.nombre}</option>)}
                    </select>
                    <select className="bs" style={{ padding: '6px 10px', fontSize: '12px' }}
                        value={periodoSelIngresos} onChange={e => setPeriodoSelIngresos(e.target.value)}>
                        <option value=''>Todos los periodos</option>
                        {faenas.filter(f => f.maquinaNombre === maqSelIngresos)
                            .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''))
                            .map((f, i, arr) => (
                                <option key={f.id} value={f.id}>
                                    {`P${arr.length - i}: ${f.nombreObra || 'Sin nombre'} (${f.fechaInicio || '—'})`}
                                </option>
                            ))}
                    </select>
                </div>
            ),
            accion: () => pdfIngresosPorPeriodo(maqSelIngresos, ingresos, faenas, periodoSelIngresos),
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Reportes</h1><p>Genera y descarga reportes en PDF</p></div>
            </div>

            <div className="content"><div className="pad">

                {cargando && (
                    <div className="ale">
                        <Loader size={18} />
                        <div><p>Cargando datos...</p></div>
                    </div>
                )}

                {!cargando && REPORTES.map(r => (
                    <div className="rep" key={r.id}>
                        <div className={`rpi ${r.color}`}>{r.ico}</div>
                        <div style={{ flex: 1 }}>
                            <h3>{r.titulo}</h3>
                            <p>{r.desc}</p>
                        </div>
                        {r.control && (
                            <div style={{ marginRight: '8px' }}>{r.control}</div>
                        )}
                        <button
                            className="rbtn"
                            onClick={() => ejecutar(r.id, r.accion)}
                            disabled={generando === r.id}
                            style={{ marginLeft: r.control ? '0' : 'auto', opacity: generando === r.id ? 0.6 : 1 }}
                        >
                            {generando === r.id ? <><Clock size={13} style={{marginRight:'4px',verticalAlign:'middle'}} />Generando...</> : '↓ PDF'}
                        </button>
                    </div>
                ))}

            </div></div>
        </div>
    );
}

export default Reportes;
