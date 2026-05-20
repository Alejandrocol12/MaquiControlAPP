const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) =>
    res.json(db.prepare('SELECT * FROM combustible ORDER BY fecha DESC, created_at DESC').all())
);

router.post('/', (req, res) => {
    const { maquina_id, litros, costo, fecha } = req.body;
    const r = db.prepare(
        'INSERT INTO combustible (maquina_id, litros, costo, fecha) VALUES (?,?,?,?)'
    ).run(maquina_id || null, litros || 0, costo || 0, fecha || null);
    res.status(201).json(db.prepare('SELECT * FROM combustible WHERE id = ?').get(r.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM combustible WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
