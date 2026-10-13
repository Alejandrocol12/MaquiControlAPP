import { useState } from 'react';
import './Gastos.css';

// A qué periodo va un gasto. Por defecto va al periodo de trabajo en campo (como siempre); si hay
// un periodo de gastos externos abierto en la máquina, va ahí. También se puede dejar sin periodo
// o abrir un periodo de gastos externos desde aquí mismo.
export const esDeGastos = (f) => f && f.tipo === 'gastos';
export const gastosExternosAbierto = (faenas, maquina) =>
    (faenas || []).find(f => esDeGastos(f) && f.estado === 'abierta' && (!maquina || f.maquinaNombre === maquina)) || null;

// 'auto' = el periodo de trabajo en campo (lo asigna el servidor); 'sin' = sin periodo; un id = ese periodo
export const destinoPorDefecto = (faenas, maquina) => {
    const ext = gastosExternosAbierto(faenas, maquina);
    return ext ? String(ext.id) : 'auto';
};
export const faenaIdDeDestino = (dest) => (dest === 'auto' || dest === '' || dest == null ? undefined : dest === 'sin' ? -1 : Number(dest));
export const destinoDeGasto = (g) => (g && g.faenaId ? String(g.faenaId) : 'sin');

function DestinoGasto({ faenas, maquina, value, onChange, onAbrir, id = 'destino-gasto', selectClass = 'fsel', inputClass = 'fi', labelClass = 'fl' }) {
    const [nuevo, setNuevo] = useState(false);
    const [nombre, setNombre] = useState('');
    const [error, setError] = useState('');
    const propias = (faenas || []).filter(f => !maquina || f.maquinaNombre === maquina);
    const activa = propias.find(f => !esDeGastos(f) && f.estado === 'activa');
    const externos = propias.filter(f => esDeGastos(f) && f.estado === 'abierta');
    const actual = propias.find(f => String(f.id) === String(value));
    const extra = actual && !externos.includes(actual) && !(activa && activa.id === actual.id) ? actual : null;
    const hayExterno = externos.length > 0;

    const abrir = async () => {
        if (!nombre.trim()) { setError('Escribe un nombre, por ejemplo "Gastos de taller".'); return; }
        try { await onAbrir(nombre.trim()); setNuevo(false); setNombre(''); setError(''); }
        catch (e) { setError(e.response?.data?.error || 'No se pudo abrir el periodo.'); }
    };

    return (
        <div className="qp">
            <label className={labelClass} htmlFor={id}>¿A qué periodo va?</label>
            <select id={id} className={selectClass} value={nuevo ? '__nuevo' : (value || 'auto')}
                onChange={e => { if (e.target.value === '__nuevo') setNuevo(true); else { setNuevo(false); onChange(e.target.value); } }}>
                <option value="auto">{activa ? `Periodo de trabajo: ${activa.nombreObra || 'en campo'}` : 'Periodo de trabajo (no hay uno abierto)'}</option>
                {externos.map(f => <option key={f.id} value={String(f.id)}>Gastos externos: {f.nombreObra || 'sin nombre'}</option>)}
                {extra && <option value={String(extra.id)}>{esDeGastos(extra) ? 'Gastos externos' : 'Periodo'}: {extra.nombreObra || 'sin nombre'}</option>}
                <option value="sin">Sin periodo</option>
                {onAbrir && !hayExterno && <option value="__nuevo">+ Abrir periodo de gastos externos…</option>}
            </select>
            {nuevo && (
                <div className="qp-nueva">
                    <input className={inputClass} aria-label="Nombre del periodo de gastos externos" value={nombre} maxLength={80} placeholder="Ej: Gastos de taller"
                        onChange={e => { setNombre(e.target.value); setError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); abrir(); } }} />
                    <button type="button" className="bp" onClick={abrir}>Abrir</button>
                    <button type="button" className="bs" onClick={() => { setNuevo(false); setNombre(''); setError(''); }}>Cancelar</button>
                </div>
            )}
            {error && <p className="qp-error" role="alert">{error}</p>}
            {!nuevo && <span className="gp-hint">{value === 'sin' ? 'Este gasto no entra a ningún periodo.' : hayExterno && String(value) === String(externos[0].id) ? 'Va al periodo de gastos externos, no al de trabajo.' : 'Va al periodo de trabajo en campo.'}</span>}
        </div>
    );
}

export default DestinoGasto;
