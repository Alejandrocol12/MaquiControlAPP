const DB_NAME = 'maquicontrol-facturas';
const STORE = 'facturas';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => {
            e.target.result.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

export async function guardarFactura(gastoId, file) {
    const db = await openDB();
    const data = await file.arrayBuffer();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ id: String(gastoId), data, nombre: file.name });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

export async function obtenerFactura(gastoId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(String(gastoId));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

export async function eliminarFactura(gastoId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(String(gastoId));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

export async function listarIdsConFactura() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAllKeys();
        req.onsuccess = () => resolve(new Set(req.result.map(String)));
        req.onerror = () => reject(req.error);
    });
}

export function abrirFactura(factura) {
    const blob = new Blob([factura.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 15000);
}
