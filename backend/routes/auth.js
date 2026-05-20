const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const signToken = (user) =>
    jwt.sign(
        {
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
            operadorId: user.operador_id || null,
        },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Correo y contrasena requeridos' });

    const user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email.trim().toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Correo o contrasena incorrectos' });
    }

    const { password_hash, operador_id, ...safeUser } = user;
    safeUser.operadorId = operador_id || null;
    res.json({ token: signToken(user), user: safeUser });
});

// POST /api/auth/register
router.post('/register', (req, res) => {
    const { nombre, empresa, email, password } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Nombre, correo y contrasena son requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });

    const exists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
    if (exists) return res.status(409).json({ error: 'Ese correo ya esta registrado' });

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
        'INSERT INTO usuarios (nombre, empresa, email, password_hash, rol, activo, operador_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(nombre.trim(), empresa?.trim() || '', email.trim().toLowerCase(), hash, 'admin', 1, null);

    const user = db.prepare('SELECT id, nombre, empresa, email, rol, activo, created_at, operador_id FROM usuarios WHERE id = ?').get(result.lastInsertRowid);
    user.operadorId = user.operador_id || null;
    delete user.operador_id;
    res.status(201).json({ token: signToken(user), user });
});

// GET /api/auth/me  (verifica y renueva el token)
const { requireAuth } = require('../middleware/auth');
router.get('/me', requireAuth, (req, res) => {
    const user = db.prepare('SELECT id, nombre, empresa, email, rol, activo, operador_id FROM usuarios WHERE id = ? AND activo = 1').get(req.user.id);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    user.operadorId = user.operador_id || null;
    delete user.operador_id;
    res.json({ user });
});

module.exports = router;
