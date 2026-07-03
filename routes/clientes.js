/**
 * routes/clientes.js — Rutas CRUD para la colección clientes
 *
 * Endpoints disponibles:
 *   GET    /api/clientes          → Listar todos los clientes
 *   GET    /api/clientes/:id      → Obtener un cliente por ID
 *   POST   /api/clientes          → Crear un nuevo cliente
 *   PUT    /api/clientes/:id      → Actualizar un cliente existente
 *   DELETE /api/clientes/:id      → Eliminar un cliente (solo adminTotal)
 *
 * Validaciones aplicadas con express-validator antes de tocar la DB.
 */

'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');
const { body, param, validationResult } = require('express-validator');
const { getDB } = require('../db');
const { requireAuth, requireRol, clienteSegunRol } = require('../middleware/sesion');

const router = express.Router();

// Todas las rutas de clientes requieren sesión iniciada
router.use(requireAuth);

// ── Helper: maneja errores de validación ─────────────────────────────────────
function validar(req, res) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ error: 'Datos inválidos', detalles: errores.array() });
    return false;
  }
  return true;
}

// ── Helper: convierte string a ObjectId con manejo de error ──────────────────
function toObjectId(id, res) {
  try {
    return new ObjectId(id);
  } catch {
    res.status(400).json({ error: 'ID inválido' });
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/clientes — Listar todos los clientes
// Usa usuarioDB (lectura/escritura estándar)
// ────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const db = getDB(clienteSegunRol(req));
    const clientes = await db.collection('clientes').find().toArray();
    res.json(clientes);
  } catch (err) {
    console.error('GET /clientes:', err.message);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/clientes/:id — Obtener un cliente por ID
// ────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const oid = toObjectId(req.params.id, res);
  if (!oid) return;
  try {
    const db = getDB(clienteSegunRol(req));
    const cliente = await db.collection('clientes').findOne({ _id: oid });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    console.error('GET /clientes/:id:', err.message);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/clientes — Crear un nuevo cliente
// Validaciones: nombre, email y teléfono son obligatorios
// ────────────────────────────────────────────────────────────────────────────
router.post('/',
  requireRol('admin', 'editor'),
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('email').isEmail().withMessage('Email inválido'),
  body('telefono').trim().notEmpty().withMessage('El teléfono es obligatorio'),
  async (req, res) => {
    if (!validar(req, res)) return;
    try {
      const db = getDB('user');
      const nuevoCliente = {
        nombre:        req.body.nombre.trim(),
        email:         req.body.email.trim().toLowerCase(),
        telefono:      req.body.telefono.trim(),
        direccion: {
          calle:        req.body.calle        || '',
          ciudad:       req.body.ciudad       || '',
          region:       req.body.region       || '',
          codigoPostal: req.body.codigoPostal || '',
        },
        fechaRegistro:  new Date(),
        activo:         true,
        preferencias:   [],
        totalCompras:   0,
        montoAcumulado: 0,
      };
      const resultado = await db.collection('clientes').insertOne(nuevoCliente);
      res.status(201).json({ mensaje: 'Cliente creado', id: resultado.insertedId });
    } catch (err) {
      // Error de índice único en email
      if (err.code === 11000) {
        return res.status(409).json({ error: 'El email ya está registrado' });
      }
      console.error('POST /clientes:', err.message);
      res.status(500).json({ error: 'Error al crear cliente' });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/clientes/:id — Actualizar un cliente
// Solo actualiza los campos enviados (patch parcial con $set)
// ────────────────────────────────────────────────────────────────────────────
router.put('/:id',
  requireRol('admin', 'editor'),
  body('nombre').optional().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('telefono').optional().trim().notEmpty(),
  async (req, res) => {
    if (!validar(req, res)) return;
    const oid = toObjectId(req.params.id, res);
    if (!oid) return;
    try {
      const db = getDB('user');
      const campos = {};
      if (req.body.nombre)   campos.nombre   = req.body.nombre.trim();
      if (req.body.email)    campos.email    = req.body.email.trim().toLowerCase();
      if (req.body.telefono) campos.telefono = req.body.telefono.trim();
      if (req.body.ciudad)   campos['direccion.ciudad'] = req.body.ciudad;
      if (req.body.region)   campos['direccion.region'] = req.body.region;

      if (Object.keys(campos).length === 0) {
        return res.status(400).json({ error: 'No se enviaron campos a actualizar' });
      }

      const resultado = await db.collection('clientes').updateOne(
        { _id: oid },
        { $set: campos }
      );
      if (resultado.matchedCount === 0) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
      res.json({ mensaje: 'Cliente actualizado' });
    } catch (err) {
      console.error('PUT /clientes/:id:', err.message);
      res.status(500).json({ error: 'Error al actualizar cliente' });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/clientes/:id — Eliminar un cliente
// Usa adminTotal porque es una operación destructiva
// ────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireRol('admin'), async (req, res) => {
  const oid = toObjectId(req.params.id, res);
  if (!oid) return;
  try {
    const db = getDB('admin'); // operación destructiva → adminTotal
    const resultado = await db.collection('clientes').deleteOne({ _id: oid });
    if (resultado.deletedCount === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json({ mensaje: 'Cliente eliminado' });
  } catch (err) {
    console.error('DELETE /clientes/:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

module.exports = router;
