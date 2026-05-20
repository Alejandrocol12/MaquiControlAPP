const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
    res.json(db.prepare('SELECT * FROM maquinaria ORDER BY created_at DESC').all());
});

router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM maquinaria WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    res.json(row);
});

router.post('/', (req, res) => {
    const {
        nombre, tipo, placa, estado,
        horometroActual, valorHoraOperador, valorHoraMaquina,
        operadorNombre,
    } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const r = db.prepare(
        'INSERT INTO maquinaria (nombre, tipo, placa, estado, horometroActual, valorHoraOperador, valorHoraMaquina, operadorNombre) VALUES (?,?,?,?,?,?,?,?)'
    ).run(
        nombre,
        tipo || null,
        placa || null,
        estado || 'Activa',
        horometroActual || 0,
        valorHoraOperador || 0,
        valorHoraMaquina || 0,
        operadorNombre || null,
    );
    res.status(201).json(db.prepare('SELECT * FROM maquinaria WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
    const {
        nombre, tipo, placa, estado,
        horometroActual, valorHoraOperador, valorHoraMaquina,
        operadorNombre,
    } = req.body;
    db.prepare(
        'UPDATE maquinaria SET nombre=?, tipo=?, placa=?, estado=?, horometroActual=?, valorHoraOperador=?, valorHoraMaquina=?, operadorNombre=? WHERE id=?'
    ).run(
        nombre,
        tipo,
        placa,
        estado,
        horometroActual ?? 0,
        valorHoraOperador ?? 0,
        valorHoraMaquina ?? 0,
        operadorNombre || null,
        req.params.id,
    );
    res.json(db.prepare('SELECT * FROM maquinaria WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM maquinaria WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
