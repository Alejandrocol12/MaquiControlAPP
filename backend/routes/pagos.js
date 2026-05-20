const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) =>
    res.json(db.prepare('SELECT * FROM pagos ORDER BY fecha DESC, created_at DESC').all())
);

router.post('/', (req, res) => {
    const { cliente, monto, descripcion, estado, fecha } = req.body;
    const r = db.prepare(
        'INSERT INTO pagos (cliente, monto, descripcion, estado, fecha) VALUES (?,?,?,?,?)'
    ).run(cliente || null, monto || 0, descripcion || null, estado || 'Pendiente', fecha || null);
    res.status(201).json(db.prepare('SELECT * FROM pagos WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
    const { cliente, monto, descripcion, estado, fecha } = req.body;
    db.prepare(
        'UPDATE pagos SET cliente=?, monto=?, descripcion=?, estado=?, fecha=? WHERE id=?'
    ).run(cliente, monto, descripcion, estado, fecha, req.params.id);
    res.json(db.prepare('SELECT * FROM pagos WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM pagos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
