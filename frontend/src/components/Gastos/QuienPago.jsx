import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, X, Users } from 'lucide-react';
import { getPagadores, createPagador, renombrarPagador, quitarPagador } from '../../api';
import { useToast } from '../../utils/toast';
import './Gastos.css';

// Lista de personas que pagan gastos. Cada usuario arma la suya.
export function usePagadores() {
    const [pagadores, setPagadores] = useState([]);
    const recargar = useCallback(async () => {
        try { const r = await getPagadores(); setPagadores(r.data || []); } catch (e) { console.error(e); }
    }, []);
    useEffect(() => { recargar(); }, [recargar]);
    // Crea a la persona y devuelve su nombre; si ya existe (sin importar mayúsculas) devuelve el existente
    const crear = useCallback(async (nombre) => {
        const limpio = String(nombre || '').trim().replace(/\s+/g, ' ');
        const igual = pagadores.find(p => p.nombre.toLowerCase() === limpio.toLowerCase());
        if (igual) return igual.nombre;
        const r = await createPagador(limpio);
        await recargar();
        return r.data.nombre;
    }, [pagadores, recargar]);
    return { pagadores, recargar, crear };
}

// Selector "¿Quién pagó?" para los formularios de gasto. value '' = sin asignar.
export function QuienPago({ value, onChange, pagadores, onCrear, onAdministrar, id = 'quien-pago', selectClass = 'fsel', inputClass = 'fi', labelClass = 'fl', conEtiqueta = true }) {
    const [nueva, setNueva] = useState(false);
    const [nombre, setNombre] = useState('');
    const [error, setError] = useState('');

    const agregar = async () => {
        if (!nombre.trim()) { setError('Escribe el nombre.'); return; }
        try {
            const n = await onCrear(nombre);
            onChange(n); setNueva(false); setNombre(''); setError('');
        } catch (e) { setError(e.response?.data?.error || 'No se pudo agregar.'); }
    };

    const enLista = !value || pagadores.some(p => p.nombre === value);
    return (
        <div className="qp">
            {conEtiqueta && <label className={labelClass} htmlFor={id}>¿Quién pagó?</label>}
            <select id={id} className={selectClass} value={nueva ? '__nueva' : (value || '')}
                onChange={e => { if (e.target.value === '__nueva') { setNueva(true); } else { setNueva(false); onChange(e.target.value); } }}>
                <option value="">Sin asignar</option>
                {pagadores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                {!enLista && <option value={value}>{value}</option>}
                <option value="__nueva">+ Otra persona…</option>
            </select>
            {nueva && (
                <div className="qp-nueva">
                    <input className={inputClass} aria-label="Nombre de la persona" value={nombre} maxLength={60} placeholder="Nombre de quien pagó"
                        onChange={e => { setNombre(e.target.value); setError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }} />
                    <button type="button" className="bp" onClick={agregar}>Agregar</button>
                    <button type="button" className="bs" onClick={() => { setNueva(false); setNombre(''); setError(''); }}>Cancelar</button>
                </div>
            )}
            {error && <p className="qp-error" role="alert">{error}</p>}
            {onAdministrar && !nueva && <button type="button" className="qp-link" onClick={onAdministrar}><Users size={12} /> Administrar personas</button>}
        </div>
    );
}

// Ventana para crear, renombrar y quitar personas
export function AdministrarPagadores({ pagadores, gastos = [], onCambio, onCerrar }) {
    const toast = useToast();
    const [nuevo, setNuevo] = useState('');
    const [error, setError] = useState('');
    const [ocupado, setOcupado] = useState(false);

    const usos = (n) => gastos.filter(g => (g.pagadoPor || '').trim() === n);

    useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onCerrar]);

    const agregar = async () => {
        if (!nuevo.trim()) { setError('Escribe un nombre.'); return; }
        setOcupado(true);
        try { await createPagador(nuevo); setNuevo(''); setError(''); await onCambio(); toast('Persona agregada'); }
        catch (e) { setError(e.response?.data?.error || 'No se pudo agregar.'); }
        setOcupado(false);
    };
    const renombrar = async (p, valor) => {
        const v = valor.trim();
        if (v === p.nombre) return;
        try { await renombrarPagador(p.id, v); setError(''); await onCambio(); toast('Nombre cambiado en todos sus gastos'); }
        catch (e) { setError(e.response?.data?.error || 'No se pudo cambiar el nombre.'); await onCambio(); }
    };
    const quitar = async (p) => {
        try { await quitarPagador(p.id); setError(''); await onCambio(); toast('Persona quitada'); }
        catch (e) { setError(e.response?.data?.error || 'No se pudo quitar.'); }
    };

    return (
        <div className="qp-fondo" role="dialog" aria-modal="true" aria-label="Personas que pagan gastos" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="qp-modal">
                <div className="qp-mh"><b><Users size={16} /> Quién paga</b><button className="qp-x" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button></div>
                <p className="qp-sub">Arma la lista como quieras: socios, operadores, la caja, un proveedor. Aparece al registrar un gasto y en los reportes.</p>
                <div className="qp-lista">
                    {pagadores.length === 0 && <p className="qp-vacio">Todavía no hay personas. Agrega la primera abajo.</p>}
                    {pagadores.map(p => {
                        const n = usos(p.nombre).length;
                        return (
                            <div className="qp-fila" key={p.id + p.nombre}>
                                <input className="fi" defaultValue={p.nombre} maxLength={60} aria-label={`Nombre de ${p.nombre}`}
                                    onBlur={e => renombrar(p, e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                                <span className="qp-n">{n} gasto{n === 1 ? '' : 's'}</span>
                                <button className="qp-del" onClick={() => quitar(p)} disabled={n > 0} title={n > 0 ? 'Tiene gastos registrados' : 'Quitar'} aria-label={`Quitar a ${p.nombre}`}><Trash2 size={14} /></button>
                            </div>
                        );
                    })}
                </div>
                <div className="qp-fila qp-add">
                    <input className="fi" placeholder="Nombre de la nueva persona" maxLength={60} value={nuevo} aria-label="Nueva persona"
                        onChange={e => { setNuevo(e.target.value); setError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') agregar(); }} />
                    <button className="bp" onClick={agregar} disabled={ocupado}><Plus size={14} /> Agregar</button>
                </div>
                {error && <p className="qp-error" role="alert">{error}</p>}
                <p className="qp-nota">Si cambias un nombre, se cambia en todos sus gastos. Solo se puede quitar a quien no tiene gastos.</p>
            </div>
        </div>
    );
}
