// Etiqueta de estado con un solo estilo para toda la app: el mismo estado
// siempre se ve igual, sin importar el módulo.
const TONO = {
    Pagado: 'ok', Completado: 'ok', 'En curso': 'ok',
    Parcial: 'warn', 'En proceso': 'warn',
    Pendiente: 'bad', Deuda: 'bad',
    Cerrado: 'neutral',
};

function Estado({ valor, tono }) {
    return <span className={`estado ${tono || TONO[valor] || 'neutral'}`}><i />{valor}</span>;
}

export default Estado;
