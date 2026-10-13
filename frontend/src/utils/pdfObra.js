import autoTable from 'jspdf-autotable';

export const fmt    = (v) => '$' + (v || 0).toLocaleString('es-CO');
export const fmtNum = (v) => (v || 0).toLocaleString('es-CO');

// Diseño "Obra": amarillo y negro de maquinaria, franja de peligro, letras en mayúscula y
// números en tipo monoespaciado. Todos los PDF salen de estas funciones.
export const AZUL     = [17, 17, 17];      // negro obra (se conserva el nombre por los usos existentes)
export const DORADO   = [255, 196, 0];     // amarillo obra
export const GRIS     = [85, 85, 85];
export const VERDE    = [28, 138, 75];
export const ROJO     = [192, 57, 43];
export const AZULC    = [17, 17, 17];
export const NEGRO    = [17, 17, 17];
export const AMARILLO = [255, 196, 0];

export const MONO = 'courier';

// ── cabecera estándar ──────────────────────────────────────────
export function cabecera(doc, titulo, subtitulo) {
    // franja de peligro
    doc.setFillColor(...AMARILLO);
    doc.rect(0, 0, 210, 4, 'F');
    doc.setFillColor(...NEGRO);
    for (let x = -4; x < 214; x += 8) {
        doc.lines([[4, -4], [4, 0], [-4, 4]], x, 4, [1, 1], 'F', true);
    }

    // banda negra con la marca
    doc.setFillColor(...NEGRO);
    doc.rect(0, 4, 210, 17, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('MAQUI', 14, 15.5);
    const w = doc.getTextWidth('MAQUI');
    doc.setTextColor(...AMARILLO);
    doc.text('CONTROL', 14 + w, 15.5);

    const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.setFont(MONO, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(190, 190, 190);
    doc.text(`Generado: ${hoy}`, 196, 14.5, { align: 'right' });

    // título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    doc.setTextColor(...NEGRO);
    doc.text(String(titulo).toUpperCase(), 14, 34);

    if (subtitulo) {
        doc.setFont(MONO, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...GRIS);
        doc.text(String(subtitulo), 14, 40);
    }

    doc.setDrawColor(...NEGRO);
    doc.setLineWidth(0.9);
    doc.line(14, 44, 196, 44);
    doc.setFont('helvetica', 'normal');

    return 50;
}

// ── cajas KPI ─────────────────────────────────────────────────
// tipo: 'ing' verde · 'gas' rojo · 'util' amarillo (rojo si es negativo) · 'neu' negro
export function cajaResumen(doc, y, items) {
    const n = items.length;
    const gap = 3;
    const boxW = Math.floor((182 - gap * (n - 1)) / n);

    items.forEach((item, i) => {
        const x = 14 + i * (boxW + gap);
        const negativo = item.tipo === 'util' && item._raw !== undefined && item._raw < 0;
        const colorTexto = item.tipo === 'ing' ? VERDE : (item.tipo === 'gas' || negativo) ? ROJO : NEGRO;

        // cuerpo (amarillo en la utilidad)
        if (item.tipo === 'util' && !negativo) doc.setFillColor(...AMARILLO);
        else doc.setFillColor(255, 255, 255);
        doc.rect(x, y, boxW, 17, 'F');

        // etiqueta negra
        doc.setFillColor(...NEGRO);
        doc.rect(x, y, boxW, 5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(...AMARILLO);
        doc.text(String(item.label).toUpperCase(), x + 2.5, y + 3.5);

        // cifra
        let fs = 10;
        doc.setFont(MONO, 'bold');
        doc.setFontSize(fs);
        while (fs > 6 && doc.getTextWidth(String(item.valor)) > boxW - 5) { fs -= 0.5; doc.setFontSize(fs); }
        doc.setTextColor(...colorTexto);
        doc.text(String(item.valor), x + 2.5, y + 13);

        // marco
        doc.setDrawColor(...NEGRO);
        doc.setLineWidth(0.5);
        doc.rect(x, y, boxW, 17, 'S');
    });

    doc.setFont('helvetica', 'normal');
    return y + 23;
}

// ── gráfico de barras horizontal ──────────────────────────────
export function barChart(doc, y, items, titulo = '') {
    if (!items.length || items.every(it => it.valor === 0)) return y;

    if (titulo) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...NEGRO);
        doc.text(String(titulo).toUpperCase(), 14, y + 4);
        doc.setDrawColor(...NEGRO);
        doc.setLineWidth(0.6);
        doc.line(14, y + 6, 196, y + 6);
        y += 10;
    }

    const maxVal = Math.max(...items.map(it => Math.abs(it.valor)), 1);
    const chartW = 108;
    const barH   = 6;
    const gap    = 4;
    const x0     = 56;

    items.forEach((item, i) => {
        const barW = (Math.abs(item.valor) / maxVal) * chartW;
        const yBar = y + i * (barH + gap);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(...NEGRO);
        const lbl = item.label.length > 24 ? item.label.slice(0, 22) + '..' : item.label;
        doc.text(lbl, 14, yBar + barH - 1.2);

        doc.setFillColor(236, 236, 230);
        doc.rect(x0, yBar, chartW, barH, 'F');

        const color = item.color === DORADO ? AMARILLO : item.color;
        doc.setFillColor(...color);
        if (barW > 0.5) doc.rect(x0, yBar, Math.max(barW, 1.5), barH, 'F');

        // marcas de bloque sobre la barra
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.4);
        for (let bx = x0 + 3; bx < x0 + Math.max(barW, 1.5); bx += 3) doc.line(bx, yBar, bx, yBar + barH);

        doc.setDrawColor(...NEGRO);
        doc.setLineWidth(0.3);
        doc.rect(x0, yBar, chartW, barH, 'S');

        doc.setFont(MONO, 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...NEGRO);
        doc.text(fmt(item.valor), x0 + chartW + 3, yBar + barH - 1.2);
    });

    doc.setFont('helvetica', 'normal');
    return y + items.length * (barH + gap) + 6;
}

// ── sección con título ─────────────────────────────────────────
export function seccion(doc, y, texto) {
    // el título no se queda solo al pie de la página: si no cabe la tabla, pasa a la siguiente
    if (y > 245) { doc.addPage(); y = 16; }
    doc.setFillColor(...AMARILLO);
    doc.rect(14, y, 3.2, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...NEGRO);
    doc.text(String(texto).toUpperCase(), 19.5, y + 4.6);
    doc.setDrawColor(...NEGRO);
    doc.setLineWidth(0.7);
    doc.line(14, y + 7.5, 196, y + 7.5);
    doc.setFont('helvetica', 'normal');
    return y + 10;
}

// ── tabla con autoTable ────────────────────────────────────────
// opts: { totalRow, greenCols, redCols, orangeCols, conditionalCols }
export function tabla(doc, y, head, body, colStyles, opts = {}) {
    const { totalRow, greenCols = [], redCols = [], orangeCols = [], conditionalCols = [] } = opts;
    const derechas = Object.keys(colStyles || {}).filter(k => colStyles[k]?.halign === 'right').map(Number);
    autoTable(doc, {
        startY: y,
        head: [head.map(h => String(h).toUpperCase())],
        body,
        foot: totalRow ? [totalRow] : undefined,
        showFoot: 'lastPage',
        theme: 'plain',
        headStyles: { fillColor: NEGRO, textColor: AMARILLO, fontStyle: 'bold', fontSize: 7, cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 } },
        bodyStyles: { fontSize: 8, textColor: [30, 30, 30], cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } },
        footStyles: { fillColor: AMARILLO, textColor: NEGRO, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 2.4, bottom: 2.4, left: 2.5, right: 2.5 } },
        margin: { left: 14, right: 14 },
        columnStyles: colStyles || {},
        didParseCell: (data) => {
            const i = data.column.index;
            // cifras alineadas a la derecha en tipo monoespaciado
            if (derechas.includes(i)) data.cell.styles.halign = 'right';
            if (derechas.includes(i) && data.section !== 'head') data.cell.styles.font = MONO;
            if (data.section === 'body') {
                if (greenCols.includes(i)) { data.cell.styles.textColor = VERDE; data.cell.styles.fontStyle = 'bold'; }
                if (redCols.includes(i)) { data.cell.styles.textColor = ROJO; data.cell.styles.fontStyle = 'bold'; }
                if (orangeCols.includes(i)) { data.cell.styles.textColor = NEGRO; data.cell.styles.fontStyle = 'bold'; }
                if (conditionalCols.includes(i)) {
                    const isNeg = String(data.cell.raw).includes('-');
                    data.cell.styles.textColor = isNeg ? ROJO : VERDE;
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        },
        // línea negra fina al pie de cada fila
        didDrawCell: (data) => {
            if (data.section === 'head') return;
            doc.setDrawColor(...NEGRO);
            doc.setLineWidth(data.section === 'foot' ? 0.6 : 0.15);
            doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        },
    });
    return doc.lastAutoTable.finalY + 6;
}

// ── pie de página ──────────────────────────────────────────────
export function pie(doc, texto) {
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(...NEGRO);
        doc.setLineWidth(0.6);
        doc.line(14, 284, 196, 284);
        doc.setFillColor(...AMARILLO);
        doc.rect(14, 284.6, 24, 1.4, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...GRIS);
        doc.setFont(MONO, 'normal');
        doc.text(`MaquiControl · ${texto}`, 14, 291);
        doc.text(`Pág. ${i} de ${pages}`, 196, 291, { align: 'right' });
    }
}


