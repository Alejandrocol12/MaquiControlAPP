import './Monto.css';

const completo = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');

// Versión corta para pantallas angostas: $109,7M (millones) o $1,2MM (miles de millones)
export const montoCorto = (v) => {
    const n = Math.round(Number(v) || 0);
    const a = Math.abs(n);
    const s = n < 0 ? '-' : '';
    const dec = (x) => x.toLocaleString('es-CO', { maximumFractionDigits: 1 });
    if (a >= 1e9) return `${s}$${dec(a / 1e9)}MM`;
    if (a >= 1e8) return `${s}$${Math.round(a / 1e6)}M`;
    if (a >= 1e6) return `${s}$${dec(a / 1e6)}M`;
    return completo(n);
};

// Un valor en pesos: completo en pantallas anchas y abreviado en el celular, para que no se salga de su tarjeta
export default function Monto({ v }) {
    return (
        <>
            <span className="monto-completo">{completo(v)}</span>
            <span className="monto-corto" aria-hidden="true">{montoCorto(v)}</span>
        </>
    );
}
