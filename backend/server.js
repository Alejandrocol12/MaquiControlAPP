require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./middleware/auth');

const app = express();

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(express.json());

// Rutas públicas
app.use('/api/auth', require('./routes/auth'));

// Rutas protegidas con JWT
app.use('/api/maquinaria',    requireAuth, require('./routes/maquinaria'));
app.use('/api/gastos',        requireAuth, require('./routes/gastos'));
app.use('/api/ingresos',      requireAuth, require('./routes/ingresos'));
app.use('/api/salarios',      requireAuth, require('./routes/salarios'));
app.use('/api/horas',         requireAuth, require('./routes/horas'));
app.use('/api/mantenimientos',requireAuth, require('./routes/mantenimientos'));
app.use('/api/combustible',   requireAuth, require('./routes/combustible'));
app.use('/api/pagos',         requireAuth, require('./routes/pagos'));
app.use('/api/operadores',    requireAuth, require('./routes/operadores'));
app.use('/api/usuarios',      requireAuth, require('./routes/usuarios'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`MaquiControl backend corriendo en http://localhost:${PORT}`));
