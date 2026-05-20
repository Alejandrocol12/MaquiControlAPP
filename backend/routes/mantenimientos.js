const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) =>
    res.json(db.prepare('SELECT * FROM mantenimientos ORDER BY fecha DESC, created_at DESC').all())
);

router.post('/', (req, res) => {
    const { maquina_id, descripcion, costo, tipo, estado, fecha } = req.body;
    const r = db.prepare(
        'INSERT INTO mantenimientos (maquina_id, descripcion, costo, tipo, estado, fecha) VALUES (?,?,?,?,?,?)'
    ).run(maquina_id || null, descripcion || null, costo || 0, tipo || null, estado || 'Pendiente', fecha || null);
    res.status(201).json(db.prepare('SELECT * FROM mantenimientos WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
    const { maquina_id, descripcion, costo, tipo, estado, fecha } = req.body;
    db.prepare(
        'UPDATE mantenimientos SET maquina_id=?, descripcion=?, costo=?, tipo=?, estado=?, fecha=? WHERE id=?'
    ).run(maquina_id, descripcion, costo, tipo, estado, fecha, req.params.id);
    res.json(db.prepare('SELECT * FROM mantenimientos WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM mantenimientos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
