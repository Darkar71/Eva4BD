/**
 * routes/auth.js — Login, logout y verificación de sesión
 *
 * Los 3 usuarios corresponden 1:1 a los usuarios de MongoDB creados
 * en el Avance 2 (adminTotal, usuarioDB, usuarioLectura).
 * Las contraseñas se validan contra las mismas credenciales guardadas
 * en el .env que usa db.js para conectarse a MongoDB.
 */

'use strict';

const express = require('express');
const router = express.Router();

// ── Mapa de usuarios de la aplicación → rol ───────────────────────────────────
const USUARIOS = {
  adminTotal: {
    password: process.env.MONGO_PASS_ADMIN,
    rol: 'admin',
  },
  usuarioDB: {
    password: process.env.MONGO_PASS_DB,
    rol: 'editor',
  },
  usuarioLectura: {
    password: process.env.MONGO_PASS_READ,
    rol: 'lectura',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }

  const u = USUARIOS[usuario];
  if (!u || !u.password || u.password !== password) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  req.session.usuario = { nombre: usuario, rol: u.rol };
  res.json({ mensaje: 'Login exitoso', nombre: usuario, rol: u.rol });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ────────────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'No se pudo cerrar sesión' });
    res.clearCookie('connect.sid');
    res.json({ mensaje: 'Sesión cerrada' });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me — Retorna el usuario/rol de la sesión activa
// ────────────────────────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  res.json(req.session.usuario);
});

module.exports = router;
