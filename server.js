/**
 * server.js — Servidor principal de ComercioTech
 *
 * Inicia el servidor Express, conecta a MongoDB y registra todas las rutas.
 * Aplica cabeceras de seguridad básicas en cada respuesta HTTP.
 *
 * Uso:
 *   node server.js       → producción
 *   npm run dev          → desarrollo con nodemon (reinicio automático)
 */

'use strict';

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path    = require('path');
const { conectar, cerrar } = require('./db');

// ── Rutas de la API ───────────────────────────────────────────────────────────
const authRouter      = require('./routes/auth');
const clientesRouter  = require('./routes/clientes');
const productosRouter = require('./routes/productos');
const pedidosRouter   = require('./routes/pedidos');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware: parsear JSON en el body de las peticiones ─────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Middleware: sesiones de usuario ────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'comerciotech-secret-dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 4, // 4 horas
  },
}));

// ── Middleware: cabeceras de seguridad HTTP básicas ───────────────────────────
// Evitan que el navegador ejecute contenido no autorizado
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── Archivos estáticos: HTML, CSS, JS del frontend ───────────────────────────
// index:false evita que sirva automáticamente index.html sin pasar por el control de sesión
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ── Rutas de autenticación (login/logout/me) — sin protección ────────────────
app.use('/api/auth', authRouter);

// ── Rutas de la API REST (protegidas dentro de cada router) ──────────────────
app.use('/api/clientes',  clientesRouter);
app.use('/api/productos', productosRouter);
app.use('/api/pedidos',   pedidosRouter);

// ── Ruta raíz → sirve el frontend solo si hay sesión iniciada ────────────────
app.get('/', (req, res) => {
  if (!req.session || !req.session.usuario) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
  if (!req.session || !req.session.usuario) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Manejo de rutas no encontradas ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Inicio del servidor ───────────────────────────────────────────────────────
(async () => {
  await conectar(); // conectar a MongoDB antes de aceptar peticiones
  app.listen(PORT, () => {
    console.log(`🚀 ComercioTech corriendo en http://localhost:${PORT}`);
  });
})();

// ── Cierre limpio al detener el proceso ──────────────────────────────────────
process.on('SIGINT',  async () => { await cerrar(); process.exit(0); });
process.on('SIGTERM', async () => { await cerrar(); process.exit(0); });
