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
    // iOS Safari bloquea window.open() después de un await.
    // Abrimos el tab ANTES de la petición para que cuente como gesto directo del usuario.
    const tab = window.open('about:blank', '_blank');
    try {
        const res = await getFacturaGasto(gastoId);
        const url = URL.createObjectURL(res.data);
        if (tab) {
            tab.location.href = url;
        } else {
            // Popup bloqueado → forzar descarga
            const a = document.createElement('a');
            a.href = url;
            a.download = 'factura.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (e) {
        if (tab) tab.close();
        console.error(e);
    }
}
