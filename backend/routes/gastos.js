const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) =>
    res.json(db.prepare('SELECT * FROM gastos ORDER BY fecha DESC, created_at DESC').all())
);

router.post('/', (req, res) => {
    const { maquinaNombre, descripcion, categoria, monto, fecha } = req.body;
    const r = db.prepare(
        'INSERT INTO gastos (maquinaNombre, descripcion, categoria, monto, fecha) VALUES (?,?,?,?,?)'
    ).run(
        maquinaNombre || null,
        descripcion || null,
        categoria || null,
        monto || 0,
        fecha || null,
    );
    res.status(201).json(db.prepare('SELECT * FROM gastos WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
    const { maquinaNombre, descripcion, categoria, monto, fecha } = req.body;
    db.prepare(
        'UPDATE gastos SET maquinaNombre=?, descripcion=?, categoria=?, monto=?, fecha=? WHERE id=?'
    ).run(maquinaNombre, descripcion, categoria, monto, fecha, req.params.id);
    res.json(db.prepare('SELECT * FROM gastos WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM gastos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
