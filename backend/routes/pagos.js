const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) =>
    res.json(db.prepare('SELECT * FROM pagos ORDER BY fecha DESC, created_at DESC').all())
);

const normalizarPago = (body) => {
    const valorTotal = Number(body.valorTotal ?? body.monto ?? 0) || 0;
    const valorPagado = Number(body.valorPagado ?? 0) || 0;
    const saldoPendiente = Math.max(valorTotal - valorPagado, 0);
    const estado = body.estado || (saldoPendiente <= 0 ? 'Pagado' : valorPagado > 0 ? 'Parcial' : 'Pendiente');

    return {
        cliente: body.cliente || null,
        maquinaNombre: body.maquinaNombre || null,
        descripcion: body.descripcion || null,
        valorTotal,
        valorPagado,
        saldoPendiente,
        estado,
        fecha: body.fecha || null,
    };
};

router.post('/', (req, res) => {
    const pago = normalizarPago(req.body);
    const r = db.prepare(
        'INSERT INTO pagos (cliente, maquinaNombre, descripcion, valorTotal, valorPagado, saldoPendiente, estado, fecha) VALUES (?,?,?,?,?,?,?,?)'
    ).run(
        pago.cliente,
        pago.maquinaNombre,
        pago.descripcion,
        pago.valorTotal,
        pago.valorPagado,
        pago.saldoPendiente,
        pago.estado,
        pago.fecha
    );
    res.status(201).json(db.prepare('SELECT * FROM pagos WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
    const pago = normalizarPago(req.body);
    db.prepare(
        'UPDATE pagos SET cliente=?, maquinaNombre=?, descripcion=?, valorTotal=?, valorPagado=?, saldoPendiente=?, estado=?, fecha=? WHERE id=?'
    ).run(
        pago.cliente,
        pago.maquinaNombre,
        pago.descripcion,
        pago.valorTotal,
        pago.valorPagado,
        pago.saldoPendiente,
        pago.estado,
        pago.fecha,
        req.params.id
    );
    res.json(db.prepare('SELECT * FROM pagos WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM pagos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
