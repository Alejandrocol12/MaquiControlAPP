// Módulos que no se usan y se esconden del menú. El código sigue ahí: para volver a
// mostrar uno, basta quitarlo de esta lista.
export const MODULOS_OCULTOS = ['mantenimientos', 'combustible', 'mapa'];

export const moduloVisible = (modulo) => !MODULOS_OCULTOS.includes(modulo);
