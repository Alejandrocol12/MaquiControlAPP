import { useState, useMemo } from 'react';

export function useSortable(data, defaultCol = null, defaultDir = 'desc') {
    const [col, setCol] = useState(defaultCol);
    const [dir, setDir] = useState(defaultDir);

    const toggle = (newCol) => {
        if (col === newCol) setDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setCol(newCol); setDir('desc'); }
    };

    const sorted = useMemo(() => {
        if (!col) return data;
        return [...data].sort((a, b) => {
            let va = a[col], vb = b[col];
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va == null) return 1;
            if (vb == null) return -1;
            const cmp = va < vb ? -1 : va > vb ? 1 : 0;
            return dir === 'asc' ? cmp : -cmp;
        });
    }, [data, col, dir]);

    const Th = ({ campo, children, className, style }) => (
        <span
            onClick={() => toggle(campo)}
            className={className}
            style={{ cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', ...style }}
        >
            {children}
            <span style={{ fontSize: '9px', opacity: col === campo ? 1 : 0.3, color: col === campo ? '#f5a623' : 'inherit', lineHeight: 1 }}>
                {col === campo ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
        </span>
    );

    return { sorted, Th, col, dir };
}
