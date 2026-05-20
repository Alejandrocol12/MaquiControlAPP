const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Solo admins pueden gestionar usuarios
router.use(requireAdmin);

router.get('/', (req, res) =>
    res.json(
        db.prepare('SELECT id, nombre, empresa, email, rol, activo, created_at, operador_id FROM usuarios ORDER BY created_at DESC')
            .all()
            .map((user) => ({
                ...user,
                operadorId: user.operador_id || null,
            }))
    )
);

router.post('/', (req, res) => {
    const { nombre, empresa, email, password, rol, operadorId } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Nombre, correo y contrasena son requeridos' });
    }
    if (!['admin', 'operador'].includes(rol)) {
        return res.status(400).json({ error: 'Rol invalido' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(normalizedEmail);
    if (exists) return res.status(409).json({ error: 'Ese correo ya esta registrado' });

    if (rol === 'operador' && !operadorId) {
        return res.status(400).json({ error: 'Debes vincular la cuenta a un operador' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
        'INSERT INTO usuarios (nombre, empresa, email, password_hash, rol, activo, operador_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
        nombre.trim(),
        empresa?.trim() || '',
        normalizedEmail,
        hash,
        rol,
        1,
        rol === 'operador' ? operadorId : null
    );

    const user = db.prepare(
        'SELECT id, nombre, empresa, email, rol, activo, created_at, operador_id FROM usuarios WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json({
        ...user,
        operadorId: user.operador_id || null,
    });
});

router.put('/:id/rol', (req, res) => {
    const { rol } = req.body;
    if (!['admin', 'operador'].includes(rol)) return res.status(400).json({ error: 'Rol invalido' });
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
    db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(rol, req.params.id);
    res.json({ ok: true });
});

router.put('/:id/activo', (req, res) => {
    const { activo } = req.body;
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, req.params.id);
    res.json({ ok: true });
});

router.put('/:id/vincular-operador', (req, res) => {
    const { operadorId } = req.body;
    db.prepare('UPDATE usuarios SET operador_id = ? WHERE id = ?').run(operadorId || null, req.params.id);
    res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
