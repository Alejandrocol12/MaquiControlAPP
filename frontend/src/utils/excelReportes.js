import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ── Colores de marca ──────────────────────────────────────────
const C = {
    AZUL:    'FF1A2D42',
    DORADO:  'FFF5A623',
    VERDE:   'FF27AE60',
    ROJO:    'FFE74C3C',
    AZULC:   'FF2980B9',
    GRIS:    'FF6B7A8D',
    BLANCO:  'FFFFFFFF',
    BGALT:   'FFF0F4F8',
    BGVERDE: 'FFE8F5E9',
    BGROJO:  'FFFDF3F3',
    BGDORADO:'FFFFF8E7',
    BGAZUL:  'FFE8F0FE',
};

const fmt = (v) => '$' + (v || 0).toLocaleString('es-CO');
const fmtN = (v) => (v || 0).toLocaleString('es-CO');
const hoyStr = () => new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

// ── Helpers de estilo ──────────────────────────────────────────
function fill(argb) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function border() {
    const s = { style: 'thin', color: { argb: 'FFD1D5DB' } };
    return { top: s, left: s, bottom: s, right: s };
}
function borderAzul() {
    const s = { style: 'thin', color: { argb: C.AZUL } };
    return { top: s, left: s, bottom: s, right: s };
}

function applyHeader(cell, text, bg = C.AZUL, color = C.BLANCO) {
    cell.value = text;
    cell.fill = fill(bg);
    cell.font = { bold: true, color: { argb: color }, name: 'Calibri', size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = borderAzul();
}

function applyData(cell, value, color = null, bold = false, halign = 'left') {
    cell.value = value;
    cell.font = { name: 'Calibri', size: 10, color: color ? { argb: color } : undefined, bold };
    cell.alignment = { vertical: 'middle', horizontal: halign };
    cell.border = border();
}

function applyTotal(cell, value, halign = 'right') {
    cell.value = value;
    cell.fill = fill(C.AZUL);
    cell.font = { bold: true, color: { argb: C.BLANCO }, name: 'Calibri', size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: halign };
    cell.border = borderAzul();
}

// ── Cabecera del libro ─────────────────────────────────────────
function addCabecera(ws, titulo, subtitulo, ncols) {
    ws.mergeCells(1, 1, 1, ncols);
    const c1 = ws.getCell(1, 1);
    c1.value = 'MaquiControl';
    c1.fill = fill(C.AZUL);
    c1.font = { bold: true, size: 18, color: { argb: C.DORADO }, name: 'Calibri' };
    c1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 36;

    ws.mergeCells(2, 1, 2, ncols);
    const c2 = ws.getCell(2, 1);
    c2.value = titulo;
    c2.fill = fill(C.AZUL);
    c2.font = { bold: true, size: 13, color: { argb: C.BLANCO }, name: 'Calibri' };
    c2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 22;

    if (subtitulo) {
        ws.mergeCells(3, 1, 3, ncols);
        const c3 = ws.getCell(3, 1);
        c3.value = subtitulo + '   |   Generado: ' + hoyStr();
        c3.fill = fill(C.AZUL);
        c3.font = { size: 9, color: { argb: 'FFADB5BD' }, name: 'Calibri' };
        c3.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(3).height = 16;
        return 4;
    }
    return 3;
}

// ── Fila KPI ──────────────────────────────────────────────────
function addKPIs(ws, rowIdx, ncols, items) {
    ws.mergeCells(rowIdx, 1, rowIdx, ncols);
    const blank = ws.getCell(rowIdx, 1);
    blank.value = '';
    blank.fill = fill('FFF8FAFC');
    ws.getRow(rowIdx).height = 8;
    rowIdx++;

    const colW = Math.floor(ncols / items.length);
    items.forEach((kpi, i) => {
        const col = i * colW + 1;
        const end = i === items.length - 1 ? ncols : col + colW - 1;
        if (col !== end) ws.mergeCells(rowIdx, col, rowIdx, end);
        if (col !== end) ws.mergeCells(rowIdx + 1, col, rowIdx + 1, end);

        const bgMap = { ing: C.BGVERDE, gas: C.BGROJO, util: C.BGDORADO, neu: C.BGAZUL };
        const fgMap = { ing: C.VERDE, gas: C.ROJO, util: C.DORADO, neu: C.AZULC };
        const bg = bgMap[kpi.tipo] || 'FFF0F4F8';
        const fg = fgMap[kpi.tipo] || C.GRIS;

        const lbl = ws.getCell(rowIdx, col);
        lbl.value = kpi.label;
        lbl.fill = fill(bg);
        lbl.font = { size: 8, color: { argb: C.GRIS }, name: 'Calibri' };
        lbl.alignment = { vertical: 'middle', horizontal: 'center' };
        lbl.border = border();

        const val = ws.getCell(rowIdx + 1, col);
        val.value = kpi.valor;
        val.fill = fill(bg);
        val.font = { bold: true, size: 11, color: { argb: fg }, name: 'Calibri' };
        val.alignment = { vertical: 'middle', horizontal: 'center' };
        val.border = border();
    });
    ws.getRow(rowIdx).height = 14;
    ws.getRow(rowIdx + 1).height = 20;
    return rowIdx + 2;
}

// ── Fila separadora ────────────────────────────────────────────
function addSep(ws, rowIdx, ncols) {
    ws.mergeCells(rowIdx, 1, rowIdx, ncols);
    const c = ws.getCell(rowIdx, 1);
    c.fill = fill('FFF8FAFC');
    c.value = '';
    ws.getRow(rowIdx).height = 6;
    return rowIdx + 1;
}

// ── Sección con título ─────────────────────────────────────────
function addSeccion(ws, rowIdx, ncols, texto) {
    ws.mergeCells(rowIdx, 1, rowIdx, ncols);
    const c = ws.getCell(rowIdx, 1);
    c.value = texto;
    c.fill = fill(C.AZUL);
    c.font = { bold: true, size: 10, color: { argb: C.BLANCO }, name: 'Calibri' };
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(rowIdx).height = 18;
    return rowIdx + 1;
}

// ── Tabla de datos ─────────────────────────────────────────────
// cols: [{ key, header, width, color?, bold?, halign?, isNum? }]
function addTabla(ws, rowIdx, cols, rows, totalRow = null) {
    const N = cols.length;

    // Encabezado
    cols.forEach((col, i) => applyHeader(ws.getCell(rowIdx, i + 1), col.header, C.DORADO, C.AZUL));
    ws.getRow(rowIdx).height = 18;
    rowIdx++;

    // Datos
    rows.forEach((row, ri) => {
        const isAlt = ri % 2 === 1;
        const bgRow = isAlt ? C.BGALT : C.BLANCO;
        cols.forEach((col, ci) => {
            const cell = ws.getCell(rowIdx, ci + 1);
            const val  = row[ci];
            cell.fill  = fill(bgRow);
            cell.font  = {
                name: 'Calibri', size: 9.5,
                color: col.color ? { argb: col.color } : undefined,
                bold: col.bold || false,
            };
            cell.alignment = { vertical: 'middle', horizontal: col.halign || 'left' };
            cell.border = border();
            cell.value = val;
        });
        ws.getRow(rowIdx).height = 16;
        rowIdx++;
    });

    // Total
    if (totalRow) {
        cols.forEach((col, ci) => applyTotal(ws.getCell(rowIdx, ci + 1), totalRow[ci], col.halign || 'right'));
        ws.getRow(rowIdx).height = 18;
        rowIdx++;
    }

    return rowIdx + 1;
}

// ── Ajuste de ancho de columnas ────────────────────────────────
function setColWidths(ws, cols) {
    cols.forEach((col, i) => {
        ws.getColumn(i + 1).width = col.width || 16;
    });
}

// ── Guardar libro ──────────────────────────────────────────────
async function guardar(wb, nombre) {
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre);
}

// ══════════════════════════════════════════════════════════════
// REPORTES
// ══════════════════════════════════════════════════════════════

export async function xlsMensual(mes, ingresos, gastos, salarios) {
    const [anio, mesNum] = mes.split('-');
    const label = new Date(anio, mesNum - 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const label2 = label.charAt(0).toUpperCase() + label.slice(1);
    const filtrar = arr => arr.filter(x => x.fecha && x.fecha.startsWith(mes));

    const ingMes = filtrar(ingresos);
    const gasMes = filtrar(gastos);
    const salMes = filtrar(salarios);
    const totIng = ingMes.reduce((a, x) => a + (x.total || 0), 0);
    const totGas = gasMes.reduce((a, x) => a + (x.monto || 0), 0);
    const totSal = salMes.reduce((a, x) => a + (x.totalNeto || 0), 0);
    const utilidad = totIng - totGas;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MaquiControl';

    // Hoja resumen
    const ws = wb.addWorksheet('Resumen');
    const N = 5;
    let r = addCabecera(ws, 'Reporte Mensual', label2, N);
    r = addKPIs(ws, r, N, [
        { label: 'Total Ingresos', valor: fmt(totIng),   tipo: 'ing' },
        { label: 'Total Gastos',   valor: fmt(totGas),   tipo: 'gas' },
        { label: 'Utilidad',       valor: fmt(utilidad), tipo: 'util' },
        { label: 'Salarios neto',  valor: fmt(totSal),   tipo: 'neu' },
    ]);
    r = addSep(ws, r, N);

    // Ingresos
    r = addSeccion(ws, r, N, `INGRESOS — ${ingMes.length} registros`);
    const colsIng = [
        { header: 'Fecha', width: 13 },
        { header: 'Máquina', width: 20 },
        { header: 'Descripción', width: 30 },
        { header: 'Tipo', width: 16 },
        { header: 'Total', width: 16, color: C.VERDE, bold: true, halign: 'right' },
    ];
    r = addTabla(ws, r, colsIng,
        ingMes.map(x => [x.fecha||'—', x.maquinaNombre||'—', x.descripcion||'—', x.tipoTrabajo||'—', fmt(x.total)]),
        ['', '', '', 'TOTAL', fmt(totIng)]
    );
    r = addSep(ws, r, N);

    // Gastos
    r = addSeccion(ws, r, N, `GASTOS — ${gasMes.length} registros`);
    const colsGas = [
        { header: 'Fecha', width: 13 },
        { header: 'Máquina', width: 20 },
        { header: 'Descripción', width: 30 },
        { header: 'Categoría', width: 16 },
        { header: 'Monto', width: 16, color: C.ROJO, bold: true, halign: 'right' },
    ];
    r = addTabla(ws, r, colsGas,
        gasMes.map(x => [x.fecha||'—', x.maquinaNombre||'—', x.descripcion||'—', x.categoria||'—', fmt(x.monto)]),
        ['', '', '', 'TOTAL', fmt(totGas)]
    );

    if (salMes.length) {
        r = addSep(ws, r, N);
        r = addSeccion(ws, r, N, `SALARIOS — ${salMes.length} liquidaciones`);
        const colsSal = [
            { header: 'Fecha', width: 13 },
            { header: 'Operador', width: 22 },
            { header: 'Horas', width: 12, halign: 'center' },
            { header: 'Bruto', width: 16, halign: 'right' },
            { header: 'Descuentos', width: 16, color: C.ROJO, bold: true, halign: 'right' },
            { header: 'Neto', width: 16, color: C.VERDE, bold: true, halign: 'right' },
        ];
        r = addTabla(ws, r, colsSal,
            salMes.map(x => [x.fecha||'—', x.operadorNombre||'—', `${x.horasTrabajadas||0} hrs`, fmt(x.totalBruto), fmt(x.descuentos||0), fmt(x.totalNeto)]),
            ['', '', '', '', 'TOTAL', fmt(totSal)]
        );
    }

    setColWidths(ws, colsIng);
    ws.views = [{ state: 'frozen', ySplit: 6, xSplit: 0 }];
    await guardar(wb, `reporte-mensual-${mes}.xlsx`);
}

export async function xlsMaquina(maq, ingresos, gastos, combustibles, mantenimientos, horas) {
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
    const totEgr  = totGas + totComb + totMant;
    const utilidad = totIng - totEgr;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MaquiControl';
    const N = 6;

    // Hoja Resumen
    const ws = wb.addWorksheet('Resumen');
    let r = addCabecera(ws, `Reporte de Máquina: ${maq.nombre}`,
        `${maq.tipo||''} · Placa: ${maq.placa||'—'} · Operador: ${maq.operadorNombre||'—'}`, N);
    r = addKPIs(ws, r, N, [
        { label: 'Total Ingresos', valor: fmt(totIng),  tipo: 'ing' },
        { label: 'Total Egresos',  valor: fmt(totEgr),  tipo: 'gas' },
        { label: 'Utilidad',       valor: fmt(utilidad),tipo: 'util' },
        { label: 'Horas acumuladas', valor: `${fmtN(totHrs)} hrs`, tipo: 'neu' },
    ]);
    r = addSep(ws, r, N);

    const buildSheet = (name, cols, rows, total) => {
        const s = wb.addWorksheet(name);
        let rr = addCabecera(s, name, maq.nombre, cols.length);
        rr = addSep(s, rr, cols.length);
        addTabla(s, rr, cols, rows, total);
        setColWidths(s, cols);
        s.views = [{ state: 'frozen', ySplit: 4 }];
    };

    if (ingM.length) buildSheet('Ingresos', [
        { header: 'Fecha', width: 13 },
        { header: 'Descripción', width: 30 },
        { header: 'Tipo', width: 18 },
        { header: 'Cantidad', width: 12, halign: 'center' },
        { header: 'Valor unit.', width: 16, halign: 'right' },
        { header: 'Total', width: 16, color: C.VERDE, bold: true, halign: 'right' },
    ], ingM.map(x => [x.fecha||'—', x.descripcion||'—', x.tipoTrabajo||'—', fmtN(x.cantidad), fmt(x.valorUnitario), fmt(x.total)]),
    ['', '', '', '', 'TOTAL', fmt(totIng)]);

    if (gasM.length) buildSheet('Gastos', [
        { header: 'Fecha', width: 13 },
        { header: 'Descripción', width: 30 },
        { header: 'Categoría', width: 20 },
        { header: 'Monto', width: 16, color: C.ROJO, bold: true, halign: 'right' },
    ], gasM.map(x => [x.fecha||'—', x.descripcion||'—', x.categoria||'—', fmt(x.monto)]),
    ['', '', 'TOTAL', fmt(totGas)]);

    if (combM.length) buildSheet('Combustible', [
        { header: 'Fecha', width: 13 },
        { header: 'Galones', width: 12, halign: 'center' },
        { header: 'Precio/Gal', width: 16, halign: 'right' },
        { header: 'Horómetro', width: 14, halign: 'center' },
        { header: 'Total', width: 16, color: C.ROJO, bold: true, halign: 'right' },
    ], combM.map(x => [x.fecha||'—', `${x.galones||0} gal`, fmt(x.precioPorGalon), fmtN(x.horometro), fmt(x.total)]),
    ['', '', '', 'TOTAL', fmt(totComb)]);

    if (hrsM.length) buildSheet('Horas', [
        { header: 'Fecha', width: 13 },
        { header: 'Operador', width: 22 },
        { header: 'Horas', width: 12, halign: 'center' },
        { header: 'Valor/hr', width: 16, halign: 'right' },
        { header: 'Valor ganado', width: 16, color: C.VERDE, bold: true, halign: 'right' },
    ], hrsM.map(x => [x.fecha||'—', x.operadorNombre||'—', `${x.horas||0} hrs`, fmt(x.valorHora), fmt((x.horas||0)*(x.valorHora||0))]),
    ['', '', `${fmtN(totHrs)} hrs`, '', fmt(hrsM.reduce((a,x)=>a+(x.horas||0)*(x.valorHora||0),0))]);

    if (mantM.length) buildSheet('Mantenimientos', [
        { header: 'Fecha', width: 13 },
        { header: 'Tipo', width: 20 },
        { header: 'Descripción', width: 30 },
        { header: 'Técnico', width: 20 },
        { header: 'Estado', width: 14 },
        { header: 'Costo', width: 16, color: C.ROJO, bold: true, halign: 'right' },
    ], mantM.map(x => [x.fecha||'—', x.tipo||'—', x.descripcion||'—', x.tecnico||'—', x.estado||'—', fmt(x.costo)]),
    ['', '', '', '', 'TOTAL', fmt(totMant)]);

    setColWidths(ws, Array(N).fill({ width: 18 }));
    await guardar(wb, `reporte-maquina-${maq.nombre.replace(/\s+/g,'-')}.xlsx`);
}

export async function xlsOperadores(horas, salarios, maquinas) {
    const ops = {};
    horas.forEach(h => {
        if (!ops[h.operadorNombre]) ops[h.operadorNombre] = { horas: [], maq: null };
        ops[h.operadorNombre].horas.push(h);
    });
    maquinas.forEach(m => {
        if (m.operadorNombre && ops[m.operadorNombre]) ops[m.operadorNombre].maq = m;
    });

    const totHrs = horas.reduce((a,h)=>a+(h.horas||0),0);
    const totSal = salarios.reduce((a,s)=>a+(s.totalNeto||0),0);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MaquiControl';
    const N = 5;

    const ws = wb.addWorksheet('Resumen');
    let r = addCabecera(ws, 'Reporte de Operadores', 'Horas trabajadas y salarios', N);
    r = addKPIs(ws, r, N, [
        { label: 'Operadores',     valor: String(Object.keys(ops).length), tipo: 'neu' },
        { label: 'Horas totales',  valor: `${fmtN(totHrs)} hrs`, tipo: 'neu' },
        { label: 'Total salarios', valor: fmt(totSal), tipo: 'gas' },
        { label: 'Liquidaciones',  valor: String(salarios.length), tipo: 'neu' },
    ]);
    r = addSep(ws, r, N);
    r = addSeccion(ws, r, N, 'RESUMEN POR OPERADOR');
    r = addTabla(ws, r, [
        { header: 'Operador', width: 26 },
        { header: 'Máquina asignada', width: 22 },
        { header: 'Total horas', width: 14, halign: 'center' },
        { header: 'Valor/hora', width: 16, halign: 'right' },
        { header: 'Salario bruto', width: 18, color: C.DORADO, bold: true, halign: 'right' },
    ],
    Object.entries(ops).map(([nombre, data]) => {
        const hrs = data.horas.reduce((a,h)=>a+(h.horas||0),0);
        const vh  = data.maq?.valorHoraOperador || 0;
        return [nombre, data.maq?.nombre||'—', `${fmtN(hrs)} hrs`, fmt(vh), fmt(hrs*vh)];
    }),
    ['TOTAL', '', `${fmtN(totHrs)} hrs`, '', fmt(Object.entries(ops).reduce((acc,[n,d])=>{
        const hrs=d.horas.reduce((a,h)=>a+(h.horas||0),0);
        return acc+hrs*(d.maq?.valorHoraOperador||0);
    },0))]);
    setColWidths(ws, [{ width: 26 }, { width: 22 }, { width: 14 }, { width: 16 }, { width: 18 }]);

    if (salarios.length) {
        const ws2 = wb.addWorksheet('Liquidaciones');
        let r2 = addCabecera(ws2, 'Historial de Liquidaciones', '', 7);
        r2 = addSep(ws2, r2, 7);
        addTabla(ws2, r2, [
            { header: 'Fecha', width: 13 },
            { header: 'Operador', width: 24 },
            { header: 'Máquina', width: 20 },
            { header: 'Horas', width: 12, halign: 'center' },
            { header: 'Bruto', width: 16, halign: 'right' },
            { header: 'Descuentos', width: 16, color: C.ROJO, bold: true, halign: 'right' },
            { header: 'Neto', width: 16, color: C.VERDE, bold: true, halign: 'right' },
        ],
        salarios.map(s => [s.fecha||'—', s.operadorNombre||'—', s.maquinaNombre||'—',
            `${s.horasTrabajadas||0} hrs`, fmt(s.totalBruto), fmt(s.descuentos||0), fmt(s.totalNeto)]),
        ['', '', '', '', '', 'TOTAL NETO', fmt(totSal)]);
        ws2.views = [{ state: 'frozen', ySplit: 4 }];
    }

    ws.views = [{ state: 'frozen', ySplit: 6 }];
    await guardar(wb, 'reporte-operadores.xlsx');
}

export async function xlsMantenimientos(mantenimientos) {
    const total   = mantenimientos.reduce((a,m)=>a+(m.costo||0),0);
    const pend    = mantenimientos.filter(m=>m.estado==='Pendiente').length;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MaquiControl';
    const N = 6;

    const ws = wb.addWorksheet('Mantenimientos');
    let r = addCabecera(ws, 'Reporte de Mantenimientos', 'Historial y costos por máquina', N);
    r = addKPIs(ws, r, N, [
        { label: 'Total registros', valor: String(mantenimientos.length), tipo: 'neu' },
        { label: 'Costo total',     valor: fmt(total), tipo: 'gas' },
        { label: 'Pendientes',      valor: String(pend), tipo: pend>0?'gas':'neu' },
        { label: 'Costo promedio',  valor: fmt(mantenimientos.length ? total/mantenimientos.length : 0), tipo: 'neu' },
    ]);
    r = addSep(ws, r, N);
    r = addSeccion(ws, r, N, `HISTORIAL (${mantenimientos.length} registros)`);
    addTabla(ws, r, [
        { header: 'Fecha', width: 13 },
        { header: 'Máquina', width: 22 },
        { header: 'Tipo', width: 18 },
        { header: 'Descripción', width: 32 },
        { header: 'Estado', width: 14 },
        { header: 'Costo', width: 16, color: C.ROJO, bold: true, halign: 'right' },
    ],
    mantenimientos.map(m => [m.fecha||'—', m.maquinaNombre||'—', m.tipo||'—', m.descripcion||'—', m.estado||'—', fmt(m.costo)]),
    ['', '', '', '', 'TOTAL', fmt(total)]);

    ws.views = [{ state: 'frozen', ySplit: 6 }];
    await guardar(wb, 'reporte-mantenimientos.xlsx');
}

export async function xlsCombustible(combustibles) {
    const total  = combustibles.reduce((a,c)=>a+(c.total||0),0);
    const galTot = combustibles.reduce((a,c)=>a+(c.galones||0),0);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MaquiControl';

    // Hoja resumen por máquina
    const ws = wb.addWorksheet('Por Máquina');
    const porMaq = {};
    combustibles.forEach(c => {
        if (!porMaq[c.maquinaNombre]) porMaq[c.maquinaNombre] = { cargas: 0, galones: 0, total: 0 };
        porMaq[c.maquinaNombre].cargas++;
        porMaq[c.maquinaNombre].galones += c.galones||0;
        porMaq[c.maquinaNombre].total   += c.total||0;
    });
    const N = 4;
    let r = addCabecera(ws, 'Reporte de Combustible', 'Consumo y gasto por máquina', N);
    r = addKPIs(ws, r, N, [
        { label: 'Total cargas',   valor: String(combustibles.length), tipo: 'neu' },
        { label: 'Total galones',  valor: `${fmtN(galTot)} gal`, tipo: 'neu' },
        { label: 'Gasto total',    valor: fmt(total), tipo: 'gas' },
        { label: 'Precio prom/gl', valor: fmt(galTot ? total/galTot : 0), tipo: 'neu' },
    ]);
    r = addSep(ws, r, N);
    r = addSeccion(ws, r, N, 'RESUMEN POR MÁQUINA');
    addTabla(ws, r, [
        { header: 'Máquina', width: 26 },
        { header: 'Cargas', width: 12, halign: 'center' },
        { header: 'Total galones', width: 16, halign: 'center' },
        { header: 'Gasto total', width: 16, color: C.ROJO, bold: true, halign: 'right' },
    ],
    Object.entries(porMaq).map(([n,d])=>[n, String(d.cargas), `${fmtN(d.galones)} gal`, fmt(d.total)]),
    ['TOTAL', String(combustibles.length), `${fmtN(galTot)} gal`, fmt(total)]);

    // Hoja historial completo
    const ws2 = wb.addWorksheet('Historial');
    let r2 = addCabecera(ws2, 'Historial de Combustible', '', 6);
    r2 = addSep(ws2, r2, 6);
    addTabla(ws2, r2, [
        { header: 'Fecha', width: 13 },
        { header: 'Máquina', width: 24 },
        { header: 'Galones', width: 12, halign: 'center' },
        { header: 'Precio/Gal', width: 16, halign: 'right' },
        { header: 'Horómetro', width: 14, halign: 'center' },
        { header: 'Total', width: 16, color: C.ROJO, bold: true, halign: 'right' },
    ],
    combustibles.map(c=>[c.fecha||'—', c.maquinaNombre||'—', `${c.galones||0} gal`, fmt(c.precioPorGalon), fmtN(c.horometro), fmt(c.total)]),
    ['', '', `${fmtN(galTot)} gal`, '', '', fmt(total)]);
    ws2.views = [{ state: 'frozen', ySplit: 4 }];

    ws.views = [{ state: 'frozen', ySplit: 6 }];
    await guardar(wb, 'reporte-combustible.xlsx');
}

export async function xlsPagos(pagos) {
    const cobrado   = pagos.filter(p=>p.estado==='Pagado').reduce((a,p)=>a+(p.monto||0),0);
    const pendiente = pagos.filter(p=>p.estado!=='Pagado').reduce((a,p)=>a+(p.monto||0),0);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MaquiControl';
    const N = 6;

    const ws = wb.addWorksheet('Pagos');
    let r = addCabecera(ws, 'Reporte de Pagos Clientes', 'Cobros realizados y pendientes', N);
    r = addKPIs(ws, r, N, [
        { label: 'Total registros', valor: String(pagos.length), tipo: 'neu' },
        { label: 'Cobrado',         valor: fmt(cobrado),   tipo: 'ing' },
        { label: 'Pendiente',       valor: fmt(pendiente), tipo: pendiente>0?'gas':'neu' },
        { label: 'Total',           valor: fmt(cobrado+pendiente), tipo: 'neu' },
    ]);
    r = addSep(ws, r, N);
    r = addSeccion(ws, r, N, `PAGOS (${pagos.length})`);
    addTabla(ws, r, [
        { header: 'Fecha', width: 13 },
        { header: 'Cliente', width: 24 },
        { header: 'Máquina', width: 22 },
        { header: 'Descripción', width: 28 },
        { header: 'Monto', width: 16, color: C.VERDE, bold: true, halign: 'right' },
        { header: 'Estado', width: 14 },
    ],
    pagos.map(p=>[p.fecha||'—', p.clienteNombre||p.cliente||'—', p.maquinaNombre||'—', p.descripcion||'—', fmt(p.monto), p.estado||'—']),
    ['', '', '', 'TOTAL', fmt(cobrado+pendiente), '']);

    ws.views = [{ state: 'frozen', ySplit: 6 }];
    await guardar(wb, 'reporte-pagos.xlsx');
}

export async function xlsResumenFlota(maquinas, ingresos, gastos, combustibles, mantenimientos) {
    const filas = maquinas.map(m => {
        const ing  = ingresos.filter(x=>x.maquinaNombre===m.nombre).reduce((a,x)=>a+(x.total||0),0);
        const gas  = gastos.filter(x=>x.maquinaNombre===m.nombre).reduce((a,x)=>a+(x.monto||0),0);
        const comb = combustibles.filter(x=>x.maquinaNombre===m.nombre).reduce((a,x)=>a+(x.total||0),0);
        const mant = mantenimientos.filter(x=>x.maquinaNombre===m.nombre).reduce((a,x)=>a+(x.costo||0),0);
        const totalGas = gas+comb+mant;
        return { nombre:m.nombre, tipo:m.tipo||'—', estado:m.estado||'—', ing, gas, comb, mant, totalGas, util:ing-totalGas };
    }).sort((a,b)=>b.util-a.util);

    const totIng  = filas.reduce((a,f)=>a+f.ing,0);
    const totGas  = filas.reduce((a,f)=>a+f.totalGas,0);
    const totUtil = totIng-totGas;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MaquiControl';
    const N = 8;

    const ws = wb.addWorksheet('Flota');
    let r = addCabecera(ws, 'Resumen Comparativo por Máquina', 'Flota completa — ingresos, gastos y utilidad', N);
    r = addKPIs(ws, r, N, [
        { label: 'Máquinas',       valor: String(maquinas.length), tipo: 'neu' },
        { label: 'Total ingresos', valor: fmt(totIng),  tipo: 'ing' },
        { label: 'Total gastos',   valor: fmt(totGas),  tipo: 'gas' },
        { label: 'Utilidad total', valor: fmt(totUtil), tipo: 'util' },
    ]);
    r = addSep(ws, r, N);
    r = addSeccion(ws, r, N, 'COMPARATIVO POR MÁQUINA (ordenado por utilidad)');
    addTabla(ws, r, [
        { header: 'Máquina', width: 24 },
        { header: 'Tipo', width: 14 },
        { header: 'Estado', width: 14 },
        { header: 'Ingresos', width: 16, color: C.VERDE, bold: true, halign: 'right' },
        { header: 'Gastos', width: 16, color: C.ROJO, bold: true, halign: 'right' },
        { header: 'Combustible', width: 16, color: C.ROJO, bold: true, halign: 'right' },
        { header: 'Mantenimiento', width: 16, color: C.ROJO, bold: true, halign: 'right' },
        { header: 'Utilidad', width: 16, color: C.DORADO, bold: true, halign: 'right' },
    ],
    filas.map(f=>[f.nombre, f.tipo, f.estado, fmt(f.ing), fmt(f.gas), fmt(f.comb), fmt(f.mant), fmt(f.util)]),
    ['TOTAL FLOTA', '', '', fmt(totIng), fmt(filas.reduce((a,f)=>a+f.gas,0)), fmt(filas.reduce((a,f)=>a+f.comb,0)), fmt(filas.reduce((a,f)=>a+f.mant,0)), fmt(totUtil)]);

    ws.views = [{ state: 'frozen', ySplit: 6 }];
    await guardar(wb, 'reporte-flota.xlsx');
}
