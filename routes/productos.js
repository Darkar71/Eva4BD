/**
 * routes/productos.js — Rutas CRUD para la colección productos
 *
 * Endpoints disponibles:
 *   GET    /api/productos              → Listar todos (con filtro opcional ?categoria=)
 *   GET    /api/productos/:id          → Obtener un producto por ID
 *   POST   /api/productos              → Crear un nuevo producto
 *   PUT    /api/productos/:id          → Actualizar un producto
 *   DELETE /api/productos/:id          → Eliminar un producto (solo adminTotal)
 */

'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db');
const { requireAuth, requireRol, clienteSegunRol } = require('../middleware/sesion');

const router = express.Router();

// Todas las rutas de productos requieren sesión iniciada
router.use(requireAuth);

function validar(req, res) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ error: 'Datos inválidos', detalles: errores.array() });
    return false;
  }
  return true;
}

function toObjectId(id, res) {
  try { return new ObjectId(id); }
  catch { res.status(400).json({ error: 'ID inválido' }); return null; }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/productos — Listar productos (filtro opcional por categoría)
// Ejemplo: GET /api/productos?categoria=electronica
// ────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const db = getDB(clienteSegunRol(req));
    const filtro = {};
    // Filtro por categoría si se pasa como query param
    if (req.query.categoria) {
      filtro.categoria = req.query.categoria.trim().toLowerCase();
    }
    const productos = await db.collection('productos').find(filtro).toArray();
    res.json(productos);
  } catch (err) {
    console.error('GET /productos:', err.message);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/productos/:id — Obtener un producto por ID
// ────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const oid = toObjectId(req.params.id, res);
  if (!oid) return;
  try {
    const db = getDB(clienteSegunRol(req));
    const producto = await db.collection('productos').findOne({ _id: oid });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    console.error('GET /productos/:id:', err.message);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/productos — Crear un nuevo producto
// Campos requeridos: nombre, categoria, precio, stock
// ────────────────────────────────────────────────────────────────────────────
router.post('/',
  requireRol('admin', 'editor'),
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('categoria').trim().notEmpty().withMessage('La categoría es obligatoria'),
  body('precio').isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
  body('stock').isInt({ min: 0 }).withMessage('El stock debe ser un entero positivo'),
  async (req, res) => {
    if (!validar(req, res)) return;
    try {
      const db = getDB('user');
      const nuevoProducto = {
        nombre:           req.body.nombre.trim(),
        categoria:        req.body.categoria.trim().toLowerCase(),
        precio:           parseFloat(req.body.precio),
        stock:            parseInt(req.body.stock),
        especificaciones: req.body.especificaciones || {},
        fechaIngreso:     new Date(),
        activo:           true,
        calificacion:     0,
      };
      const resultado = await db.collection('productos').insertOne(nuevoProducto);
      res.status(201).json({ mensaje: 'Producto creado', id: resultado.insertedId });
    } catch (err) {
      console.error('POST /productos:', err.message);
      res.status(500).json({ error: 'Error al crear producto' });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/productos/:id — Actualizar precio y/o stock de un producto
// Solo actualiza los campos enviados con $set
// ────────────────────────────────────────────────────────────────────────────
router.put('/:id',
  requireRol('admin', 'editor'),
  body('precio').optional().isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  async (req, res) => {
    if (!validar(req, res)) return;
    const oid = toObjectId(req.params.id, res);
    if (!oid) return;
    try {
      const db = getDB('user');
      const campos = {};
      if (req.body.nombre)    campos.nombre    = req.body.nombre.trim();
      if (req.body.categoria) campos.categoria = req.body.categoria.trim().toLowerCase();
      if (req.body.precio !== undefined) campos.precio = parseFloat(req.body.precio);
      if (req.body.stock  !== undefined) campos.stock  = parseInt(req.body.stock);

      if (Object.keys(campos).length === 0) {
        return res.status(400).json({ error: 'No se enviaron campos a actualizar' });
      }

      const resultado = await db.collection('productos').updateOne(
        { _id: oid },
        { $set: campos }
      );
      if (resultado.matchedCount === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      res.json({ mensaje: 'Producto actualizado' });
    } catch (err) {
      console.error('PUT /productos/:id:', err.message);
      res.status(500).json({ error: 'Error al actualizar producto' });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/productos/:id — Eliminar un producto (usa adminTotal)
// ────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireRol('admin'), async (req, res) => {
  const oid = toObjectId(req.params.id, res);
  if (!oid) return;
  try {
    const db = getDB('admin');
    const resultado = await db.collection('productos').deleteOne({ _id: oid });
    if (resultado.deletedCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto eliminado' });
  } catch (err) {
    console.error('DELETE /productos/:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;
