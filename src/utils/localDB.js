const r = (k, d = []) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
const w = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ── OPERADORES ────────────────────────────────────────────────
export const getOperadores = () => r('mc_ops');

export const addOperador = (op) => {
    const n = { ...op, id: Date.now(), fechaRegistro: new Date().toISOString().split('T')[0] };
    w('mc_ops', [...getOperadores(), n]);
    return n;
};

export const updateOperador = (id, data) =>
    w('mc_ops', getOperadores().map(o => o.id === id ? { ...o, ...data } : o));

export const deleteOperador = (id) =>
    w('mc_ops', getOperadores().filter(o => o.id !== id));

// ── PERÍODOS DE TRABAJO (DESCANSOS) ──────────────────────────
export const getPeriodos = (operadorId) => {
    const all = r('mc_periodos');
    return operadorId != null ? all.filter(p => p.operadorId === operadorId) : all;
};

export const addPeriodo = (p) => {
    const n = { ...p, id: Date.now(), estado: 'activo', anticipos: 0 };
    w('mc_periodos', [...r('mc_periodos'), n]);
    return n;
};

export const updatePeriodo = (id, data) =>
    w('mc_periodos', r('mc_periodos').map(p => p.id === id ? { ...p, ...data } : p));

export const deletePeriodo = (id) =>
    w('mc_periodos', r('mc_periodos').filter(p => p.id !== id));

export const getPeriodoActivo = (operadorId) =>
    getPeriodos(operadorId).find(p => p.estado === 'activo') || null;
