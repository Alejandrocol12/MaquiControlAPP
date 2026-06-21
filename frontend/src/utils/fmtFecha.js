const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export const fmtFecha = (fecha) => {
    if (!fecha) return '-';
    const str = String(fecha).split('T')[0];
    const parts = str.split('-');
    if (parts.length !== 3) return str;
    const [y, m, d] = parts;
    const mes = MESES[parseInt(m, 10) - 1];
    if (!mes) return str;
    return `${parseInt(d, 10)} ${mes} ${y}`;
};

export const fmtFechaCorta = (fecha) => {
    if (!fecha) return '-';
    const str = String(fecha).split('T')[0];
    const parts = str.split('-');
    if (parts.length !== 3) return str;
    const [, m, d] = parts;
    const mes = MESES[parseInt(m, 10) - 1];
    if (!mes) return str;
    return `${parseInt(d, 10)} ${mes}`;
};
