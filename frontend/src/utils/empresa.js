import { getEmpresa } from '../api';

// Datos de la empresa para el encabezado de los PDF. Se cargan al entrar para que los PDF se armen sin esperar.
let datos = null;

export const empresaActual = () => datos;
export const guardarEmpresa = (d) => { datos = d; };
export const limpiarEmpresa = () => { datos = null; };

export async function cargarEmpresa() {
    try { datos = (await getEmpresa()).data; } catch { /* los PDF salen sin esos datos */ }
    return datos;
}

// "NIT 900.123.456-7 · Villavicencio · 300 123 4567"
export function lineaEmpresa(d = datos, max = 70) {
    if (!d) return '';
    const t = [d.nit && `NIT ${d.nit}`, d.ciudad, d.telefono, d.direccion].filter(Boolean).join(' · ');
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
}
