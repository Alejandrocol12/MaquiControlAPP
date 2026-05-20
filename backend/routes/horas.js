const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) =>
    res.json(db.prepare('SELECT * FROM horas ORDER BY fecha DESC, created_at DESC').all())
);

// Horas de un operador específico por su ID
router.get('/operador/:operadorId', (req, res) =>
    res.json(
        db.prepare('SELECT * FROM horas WHERE operador_id = ? ORDER BY fecha DESC, created_at DESC')
            .all(req.params.operadorId)
    )
);

router.post('/', (req, res) => {
    const {
        operador_id, maquina_id,
        operadorNombre, maquinaNombre,
        horas, fecha,
        valorHora, horometroInicio, horometroFin,
    } = req.body;

    const r = db.prepare(
        'INSERT INTO horas (operador_id, maquina_id, operadorNombre, maquinaNombre, horas, fecha, valorHora, horometroInicio, horometroFin) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(
        operador_id || null,
        maquina_id || null,
        operadorNombre || null,
        maquinaNombre || null,
        horas || 0,
        fecha || null,
        valorHora || 0,
        horometroInicio || 0,
        horometroFin || 0,
    );

    // Actualizar horometroActual de la máquina al registrar horas
    if (maquinaNombre && horometroFin) {
        const maq = db.prepare('SELECT * FROM maquinaria WHERE nombre = ?').get(maquinaNombre);
        if (maq) {
            db.prepare('UPDATE maquinaria SET horometroActual=? WHERE id=?').run(horometroFin, maq.id);
        }
    }

    res.status(201).json(db.prepare('SELECT * FROM horas WHERE id = ?').get(r.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM horas WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
