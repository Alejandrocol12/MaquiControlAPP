/**
 * Pure-JS JSON file store con API compatible con better-sqlite3.
 * Soporta: SELECT/INSERT/UPDATE/DELETE con WHERE col=? o col='literal' o col=123
 */
const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, 'data.json');
const TABLES = ['usuarios','maquinaria','gastos','ingresos','salarios','horas',
                'mantenimientos','combustible','pagos','operadores','periodos'];

// ── I/O ──────────────────────────────────────────────────────────────────────
let store = {};

const load = () => {
    try {
        store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        TABLES.forEach(t => { if (!store[t]) store[t] = []; });
    } catch {
        store = Object.fromEntries(TABLES.map(t => [t, []]));
        persist();
    }
};

const persist = () => fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));

load();

store.usuarios = store.usuarios.map((user) => ({
    activo: 1,
    operador_id: null,
    ...user,
}));
store.operadores = store.operadores.map((operador) => ({
    activo: 1,
    ...operador,
}));
persist();

// ── Seed admin ───────────────────────────────────────────────────────────────
if (!store.usuarios.find(u => u.email === 'dueno@mail.com')) {
    store.usuarios.push({
        id: 1, nombre: 'Alejandro', empresa: 'MaquiControl SAS',
        email: 'dueno@mail.com',
        password_hash: bcrypt.hashSync('123456', 10),
        rol: 'admin', activo: 1,
        created_at: new Date().toISOString(),
    });
    persist();
    console.log('Usuario admin seed creado: dueno@mail.com / 123456');
}

// ── SQL helpers ───────────────────────────────────────────────────────────────
const tableFrom = (sql) => {
    const m = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    return m ? m[1].toLowerCase() : null;
};

/**
 * Parsea WHERE con soporte para:
 *   col = ?           → usa siguiente param posicional
 *   col = 'literal'   → string literal
 *   col = 123         → número literal
 * Devuelve (row, params, startIdx) => bool
 */
const parseWhere = (wherePart) => {
    if (!wherePart) return () => true;

    const conds = wherePart.trim().split(/\s+AND\s+/i);

    // Pre-parse each condition
    const parsed = conds.map(cond => {
        const m = cond.trim().match(/^(\w+)\s*=\s*(\?|'([^']*)'|(\d+(?:\.\d+)?))$/i);
        if (!m) return null;
        const col  = m[1].toLowerCase();
        const kind = m[2] === '?' ? 'param' : m[3] !== undefined ? 'string' : 'number';
        const lit  = kind === 'string' ? m[3] : kind === 'number' ? Number(m[4]) : null;
        return { col, kind, lit };
    });

    return (row, params, startIdx) => {
        let pi = startIdx;
        for (const c of parsed) {
            if (!c) continue; // unknown pattern — skip
            const expected = c.kind === 'param' ? params[pi++] : c.lit;
            const rowKey   = Object.keys(row).find(k => k.toLowerCase() === c.col) || c.col;
            const rowVal   = row[rowKey];
            // Compare with loose type coercion
            if (rowVal == null && expected == null) continue;
            if (Number(rowVal) === Number(expected)) continue;
            if (String(rowVal).toLowerCase() === String(expected).toLowerCase()) continue;
            return false;
        }
        return true;
    };
};

const parseOrderBy = (orderPart) => {
    if (!orderPart) return null;
    const parts = orderPart.trim().split(',').map(p => {
        const [col, dir] = p.trim().split(/\s+/);
        return { col: col.toLowerCase(), desc: /desc/i.test(dir || '') };
    });
    return (a, b) => {
        for (const { col, desc } of parts) {
            if (a[col] === b[col]) continue;
            const diff = a[col] < b[col] ? -1 : 1;
            return desc ? -diff : diff;
        }
        return 0;
    };
};

// ── Statement factory ─────────────────────────────────────────────────────────
const Statement = (sql) => {
    const run = (...args) => {
        const params = args.flat();
        const table  = tableFrom(sql);
        const rows   = store[table] || [];

        // INSERT
        if (/^\s*INSERT/i.test(sql)) {
            const colsMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
            const cols = colsMatch[1].split(',').map(c => c.trim());
            const id = Date.now() + Math.floor(Math.random() * 1000);
            const record = { id, created_at: new Date().toISOString() };
            cols.forEach((c, i) => { record[c] = params[i] !== undefined ? params[i] : null; });
            store[table].push(record);
            persist();
            return { lastInsertRowid: record.id };
        }

        // UPDATE
        if (/^\s*UPDATE/i.test(sql)) {
            const setPart   = sql.match(/SET\s+(.+?)\s+WHERE/i)?.[1] || '';
            const wherePart = sql.match(/WHERE\s+(.+)$/i)?.[1] || '';
            const setFields = setPart.split(',').map(s => {
                const m = s.trim().match(/^(\w+)\s*=\s*(\?|'([^']*)'|(-?\d+(?:\.\d+)?))$/i);
                if (!m) return null;
                const kind = m[2] === '?' ? 'param' : m[3] !== undefined ? 'string' : 'number';
                return { col: m[1], kind, lit: kind === 'string' ? m[3] : kind === 'number' ? Number(m[4]) : null };
            }).filter(Boolean);
            const paramCount  = setFields.filter(f => f.kind === 'param').length;
            const setParams   = params.slice(0, paramCount);
            const whereParams = params.slice(paramCount);
            const pred        = parseWhere(wherePart);
            store[table] = rows.map(r => {
                if (!pred(r, whereParams, 0)) return r;
                const updated = { ...r };
                let pi = 0;
                setFields.forEach(({ col, kind, lit }) => {
                    updated[col] = kind === 'param' ? setParams[pi++] : lit;
                });
                return updated;
            });
            persist();
            return {};
        }

        // DELETE
        if (/^\s*DELETE/i.test(sql)) {
            const wherePart = sql.match(/WHERE\s+(.+)$/i)?.[1] || '';
            const pred      = parseWhere(wherePart);
            store[table] = rows.filter(r => !pred(r, params, 0));
            persist();
            return {};
        }

        return {};
    };

    const all = (...args) => {
        const params = args.flat();
        const table  = tableFrom(sql);
        if (!store[table]) return [];

        const wherePart = sql.match(/WHERE\s+(.*?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i)?.[1] || '';
        const orderPart = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|$)/i)?.[1] || '';

        const pred   = parseWhere(wherePart);
        const sorter = parseOrderBy(orderPart);

        let result = store[table].filter(r => pred(r, params, 0));

        // Column projection: SELECT col1, col2 FROM ... (not *)
        const selectRaw = sql.match(/SELECT\s+([\w\s,]+?)\s+FROM/i)?.[1] || '*';
        if (selectRaw.trim() !== '*') {
            const cols = selectRaw.split(',').map(c => c.trim().toLowerCase());
            result = result.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));
        }

        if (sorter) result.sort(sorter);
        return result;
    };

    const get = (...args) => all(...args)[0] || undefined;

    return { run, get, all };
};

const db = {
    prepare: (sql) => Statement(sql),
    exec:    ()    => {}, // CREATE TABLE statements are no-ops
    pragma:  ()    => {},
};

module.exports = db;
