const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) =>
    res.json(db.prepare('SELECT * FROM ingresos ORDER BY fecha DESC, created_at DESC').all())
);

router.post('/', (req, res) => {
    const { maquinaNombre, tipoTrabajo, cantidad, valorUnitario, total, fecha, descripcion } = req.body;
    const r = db.prepare(
        'INSERT INTO ingresos (maquinaNombre, tipoTrabajo, cantidad, valorUnitario, total, fecha, descripcion) VALUES (?,?,?,?,?,?,?)'
    ).run(
        maquinaNombre || null,
        tipoTrabajo || null,
        cantidad || 0,
        valorUnitario || 0,
        total || 0,
        fecha || null,
        descripcion || null,
    );
    res.status(201).json(db.prepare('SELECT * FROM ingresos WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
    const { maquinaNombre, tipoTrabajo, cantidad, valorUnitario, total, fecha, descripcion } = req.body;
    db.prepare(
        'UPDATE ingresos SET maquinaNombre=?, tipoTrabajo=?, cantidad=?, valorUnitario=?, total=?, fecha=?, descripcion=? WHERE id=?'
    ).run(maquinaNombre, tipoTrabajo, cantidad, valorUnitario, total, fecha, descripcion, req.params.id);
    res.json(db.prepare('SELECT * FROM ingresos WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM ingresos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
