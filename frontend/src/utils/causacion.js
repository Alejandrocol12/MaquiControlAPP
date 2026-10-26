// Gastos de operador que el servidor causa al hacer un corte. Llevan lo ganado en el corte y lo que el
// operador ya había ganado antes de él: con eso se sabe cuánto de lo pagado los cubre, igual que
// la pantalla de Operadores (los pagos llenan primero lo anterior y después cada corte, del más viejo).

export const esCausadoPorCorte = (gasto) => gasto?.corteId != null;

// { ganado, pagado, debe } de un gasto causado, según todo lo pagado al operador
export const estadoCausado = (gasto, pagosOperador = []) => {
    if (!esCausadoPorCorte(gasto)) return null;
    const total = pagosOperador
        .filter(p => p.operadorNombre === gasto.operadorNombre)
        .reduce((a, p) => a + (Number(p.monto) || 0), 0);
    const ganado = Number(gasto.ganadoCorte) || 0;
    const previo = Number(gasto.acumuladoPrevio) || 0;
    const pagado = Math.min(ganado, Math.max(0, total - previo));
    return { ganado, pagado, debe: Math.max(0, ganado - pagado) };
};

// Texto corto del estado: "Pagado", "Parcial" o "Por pagar"
export const nombreEstadoCausado = (e) => (!e ? '' : e.debe <= 0.5 ? 'Pagado' : e.pagado > 0.5 ? 'Parcial' : 'Por pagar');
