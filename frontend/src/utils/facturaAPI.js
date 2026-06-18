import { subirFacturaGasto, getFacturaGasto, deleteFacturaGasto } from '../api';

export async function guardarFactura(gastoId, file) {
    const form = new FormData();
    form.append('file', file);
    await subirFacturaGasto(gastoId, form);
}

export async function eliminarFactura(gastoId) {
    await deleteFacturaGasto(gastoId);
}

export async function abrirFactura(gastoId) {
    const res = await getFacturaGasto(gastoId);
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 15000);
}
