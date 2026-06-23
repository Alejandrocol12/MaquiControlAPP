import { useState } from 'react';

export function useDateRange(data, campo = 'fecha') {
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');

    const filtrado = (!desde && !hasta)
        ? data
        : data.filter(item => {
            const f = item[campo] || '';
            if (desde && f < desde) return false;
            if (hasta && f > hasta) return false;
            return true;
        });

    return { filtrado, desde, setDesde, hasta, setHasta };
}

export function DateRangePicker({ desde, setDesde, hasta, setHasta }) {
    return (
        <div className="dr-pick">
            <input className="dr-in" type="date" value={desde}
                onChange={e => setDesde(e.target.value)}
                title="Desde" />
            <span className="dr-sep">—</span>
            <input className="dr-in" type="date" value={hasta}
                onChange={e => setHasta(e.target.value)}
                title="Hasta" />
            {(desde || hasta) && (
                <button className="dr-x" onClick={() => { setDesde(''); setHasta(''); }}>✕</button>
            )}
        </div>
    );
}
