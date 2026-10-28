// Firmas del acta de horas de cada corte. Se guardan en este navegador (no en el servidor), así que
// cualquier corte, también uno viejo, se puede firmar y volver a imprimir con sus firmas en este equipo.
const CLAVE = 'mc_firmas_acta';
const MAX = 40;

const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch { return {}; } };

export const firmasDeCorte = (corteId) => (corteId ? leer()[String(corteId)] || null : null);

export function guardarFirmasDeCorte(corteId, firmas) {
    if (!corteId) return;
    const todo = leer();
    todo[String(corteId)] = { ...firmas, guardada: new Date().toISOString() };
    // solo se conservan las más recientes para no llenar el almacenamiento del navegador
    const orden = Object.entries(todo).sort((a, b) => String(b[1].guardada).localeCompare(String(a[1].guardada))).slice(0, MAX);
    try { localStorage.setItem(CLAVE, JSON.stringify(Object.fromEntries(orden))); } catch { /* sin almacenamiento o lleno */ }
}

export function borrarFirmasDeCorte(corteId) {
    const todo = leer();
    delete todo[String(corteId)];
    try { localStorage.setItem(CLAVE, JSON.stringify(todo)); } catch { /* sin almacenamiento */ }
}
