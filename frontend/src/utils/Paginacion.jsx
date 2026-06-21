import { useState, useEffect } from 'react';

export function usePaginacion(items, porPagina = 25) {
    const [pagina, setPagina] = useState(1);

    useEffect(() => { setPagina(1); }, [items.length]);

    const total   = Math.max(1, Math.ceil(items.length / porPagina));
    const inicio  = (pagina - 1) * porPagina;
    const paginados = items.slice(inicio, inicio + porPagina);

    const ir = (n) => setPagina(Math.max(1, Math.min(n, total)));

    return { paginados, pagina, total, ir, setPagina };
}

export function Paginacion({ pagina, total, ir, totalItems, porPagina }) {
    if (total <= 1) return null;

    const inicio = (pagina - 1) * porPagina + 1;
    const fin    = Math.min(pagina * porPagina, totalItems);

    const paginas = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - pagina) <= 1) paginas.push(i);
        else if (paginas[paginas.length - 1] !== '...') paginas.push('...');
    }

    return (
        <div className="pag">
            <span className="pag-i">{inicio}–{fin} de {totalItems}</span>
            <div className="pag-b">
                <button className="pb" onClick={() => ir(pagina - 1)} disabled={pagina === 1}>‹</button>
                {paginas.map((p, i) =>
                    p === '...'
                        ? <span key={`d${i}`} className="pb" style={{ cursor: 'default', color: '#9aa5b4' }}>…</span>
                        : <button key={p} className={`pb${pagina === p ? ' on' : ''}`} onClick={() => ir(p)}>{p}</button>
                )}
                <button className="pb" onClick={() => ir(pagina + 1)} disabled={pagina === total}>›</button>
            </div>
        </div>
    );
}
