// Reglas de qué cuenta como egreso por operadores, en un solo sitio para que Dashboard,
// Finanzas y Periodos den siempre el mismo número.
//
// - Lo que de verdad se le pagó al operador entra como Gasto categoría "Pago operador"
//   (lo crea el backend al registrar un pago en Operadores).
// - El salario que la app crea sola al cerrar un periodo de máquina es solo informativo
//   (cuánto se ganó el operador): no tiene gasto enlazado y NO suma a los egresos.
// - Un salario anotado a mano en Finanzas sí cuenta: es un registro explícito del admin.

export const CAT_PAGO_OPERADOR = 'Pago operador';

export const esPagoOperador = (gasto) => gasto?.categoria === CAT_PAGO_OPERADOR;

// true = salario anotado a mano (cuenta en egresos). false = automático del cierre (informativo).
export const salarioCuenta = (salario) => salario?.gastoGeneradoId != null;
