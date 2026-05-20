const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) =>
    res.json(db.prepare('SELECT * FROM salarios ORDER BY fecha DESC, created_at DESC').all())
);

router.post('/', (req, res) => {
    const {
        operadorNombre, maquinaNombre,
        horasTrabajadas, valorHora,
        totalBruto, descuentos, totalNeto,
        fecha, estado, nota,
    } = req.body;
    const r = db.prepare(
        'INSERT INTO salarios (operadorNombre, maquinaNombre, horasTrabajadas, valorHora, totalBruto, descuentos, totalNeto, fecha, estado, nota) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(
        operadorNombre || null,
        maquinaNombre || null,
        horasTrabajadas || 0,
        valorHora || 0,
        totalBruto || 0,
        descuentos || 0,
        totalNeto || 0,
        fecha || null,
        estado || 'Pendiente',
        nota || null,
    );
    res.status(201).json(db.prepare('SELECT * FROM salarios WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
    const { estado, nota } = req.body;
    db.prepare('UPDATE salarios SET estado=?, nota=? WHERE id=?').run(estado, nota, req.params.id);
    res.json(db.prepare('SELECT * FROM salarios WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM salarios WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
