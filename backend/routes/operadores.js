const router = require('express').Router();
const db = require('../db');

// ── OPERADORES ─────────────────────────────────────────────────
router.get('/', (req, res) =>
    res.json(db.prepare('SELECT * FROM operadores WHERE activo = 1 ORDER BY nombre').all())
);

router.post('/', (req, res) => {
    const { nombre, cedula, telefono, email, observaciones } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const r = db.prepare(
        'INSERT INTO operadores (nombre, cedula, telefono, email, observaciones, activo) VALUES (?,?,?,?,?,?)'
    ).run(nombre.trim(), cedula || null, telefono || null, email || null, observaciones || null, 1);
    res.status(201).json(db.prepare('SELECT * FROM operadores WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
    const { nombre, cedula, telefono, email, observaciones } = req.body;
    db.prepare(
        'UPDATE operadores SET nombre=?, cedula=?, telefono=?, email=?, observaciones=? WHERE id=?'
    ).run(nombre, cedula, telefono, email, observaciones, req.params.id);
    res.json(db.prepare('SELECT * FROM operadores WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
    db.prepare('UPDATE operadores SET activo = 0 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

// ── PERÍODOS ───────────────────────────────────────────────────
router.get('/:operadorId/periodos', (req, res) =>
    res.json(db.prepare('SELECT * FROM periodos WHERE operador_id = ? ORDER BY created_at DESC').all(req.params.operadorId))
);

router.get('/:operadorId/periodos/activo', (req, res) => {
    const p = db.prepare("SELECT * FROM periodos WHERE operador_id = ? AND estado = 'activo' LIMIT 1").get(req.params.operadorId);
    res.json(p || null);
});

router.post('/:operadorId/periodos', (req, res) => {
    const { fecha_inicio, desde_hora_id, anticipos, estado } = req.body;
    const r = db.prepare(
        'INSERT INTO periodos (operador_id, estado, anticipos, fecha_inicio, desde_hora_id) VALUES (?, ?, ?, ?, ?)'
    ).run(
        req.params.operadorId,
        estado || 'activo',
        anticipos || 0,
        fecha_inicio || new Date().toISOString().split('T')[0],
        desde_hora_id || null
    );
    res.status(201).json(db.prepare('SELECT * FROM periodos WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/periodos/:id', (req, res) => {
    const {
        estado,
        anticipos,
        fecha_fin,
        horas_total,
        salario_bruto,
        salario_neto,
        nota,
        desde_hora_id,
    } = req.body;
    db.prepare(
        'UPDATE periodos SET estado=?, anticipos=?, fecha_fin=?, horas_total=?, salario_bruto=?, salario_neto=?, nota=?, desde_hora_id=? WHERE id=?'
    ).run(
        estado,
        anticipos,
        fecha_fin || null,
        horas_total ?? null,
        salario_bruto ?? null,
        salario_neto ?? null,
        nota || null,
        desde_hora_id ?? null,
        req.params.id
    );
    res.json(db.prepare('SELECT * FROM periodos WHERE id = ?').get(req.params.id));
});

router.delete('/periodos/:id', (req, res) => {
    db.prepare('DELETE FROM periodos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
