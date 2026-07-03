/**
 * routes/pedidos.js — Rutas CRUD para la colección pedidos
 *
 * Endpoints disponibles:
 *   GET    /api/pedidos              → Listar todos (filtro opcional ?estado=)
 *   GET    /api/pedidos/:id          → Obtener un pedido por ID
 *   POST   /api/pedidos              → Crear un nuevo pedido
 *   PUT    /api/pedidos/:id/estado   → Actualizar el estado de un pedido
 *   DELETE /api/pedidos/:id          → Eliminar un pedido (solo adminTotal)
 *
 * El estado del pedido está validado contra el enum definido en el esquema:
 *   pendiente | en_proceso | enviado | entregado | cancelado
 */

'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db');
const { requireAuth, requireRol, clienteSegunRol } = require('../middleware/sesion');

const router = express.Router();

// Todas las rutas de pedidos requieren sesión iniciada
router.use(requireAuth);

// Estados válidos según el $jsonSchema definido en el Avance 3
const ESTADOS_VALIDOS = ['pendiente', 'en_proceso', 'enviado', 'entregado', 'cancelado'];

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
// GET /api/pedidos — Listar pedidos (filtro opcional ?estado=en_proceso)
// ────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const db = getDB(clienteSegunRol(req));
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADOS_VALIDOS.includes(req.query.estado)) {
        return res.status(400).json({ error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}` });
      }
      filtro.estado = req.query.estado;
    }
    const pedidos = await db.collection('pedidos').find(filtro).toArray();
    res.json(pedidos);
  } catch (err) {
    console.error('GET /pedidos:', err.message);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/pedidos/:id — Obtener un pedido por ID
// ────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const oid = toObjectId(req.params.id, res);
  if (!oid) return;
  try {
    const db = getDB(clienteSegunRol(req));
    const pedido = await db.collection('pedidos').findOne({ _id: oid });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(pedido);
  } catch (err) {
    console.error('GET /pedidos/:id:', err.message);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/pedidos — Crear un nuevo pedido
// Requiere: clienteId (string ObjectId), productos (array), metodoPago
// ────────────────────────────────────────────────────────────────────────────
router.post('/',
  requireRol('admin', 'editor'),
  body('clienteId').notEmpty().withMessage('clienteId es obligatorio'),
  body('productos').isArray({ min: 1 }).withMessage('Debe incluir al menos un producto'),
  body('metodoPago').trim().notEmpty().withMessage('El método de pago es obligatorio'),
  async (req, res) => {
    if (!validar(req, res)) return;
    try {
      const db = getDB('user');

      // Validar que el clienteId exista en la colección clientes
      let clienteOid;
      try { clienteOid = new ObjectId(req.body.clienteId); }
      catch { return res.status(400).json({ error: 'clienteId inválido' }); }

      const cliente = await db.collection('clientes').findOne({ _id: clienteOid });
      if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

      // Calcular total a partir del arreglo de productos
      const productos = req.body.productos.map(p => ({
        productoId:     new ObjectId(p.productoId),
        nombre:         p.nombre,
        precioUnitario: parseFloat(p.precioUnitario),
        cantidad:       parseInt(p.cantidad),
        subtotal:       parseFloat(p.precioUnitario) * parseInt(p.cantidad),
      }));
      const total = productos.reduce((acc, p) => acc + p.subtotal, 0);

      const nuevoPedido = {
        clienteId:      clienteOid,
        clienteNombre:  cliente.nombre,
        productos,
        estado:         'pendiente',   // estado inicial siempre pendiente
        total,
        fechaPedido:    new Date(),
        direccionEnvio: req.body.direccionEnvio || cliente.direccion,
        metodoPago:     req.body.metodoPago.trim(),
        notasCliente:   req.body.notasCliente || '',
      };

      const resultado = await db.collection('pedidos').insertOne(nuevoPedido);
      res.status(201).json({ mensaje: 'Pedido creado', id: resultado.insertedId });
    } catch (err) {
      console.error('POST /pedidos:', err.message);
      res.status(500).json({ error: 'Error al crear pedido' });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/pedidos/:id/estado — Actualizar estado de un pedido
// Valida que el nuevo estado esté dentro del enum del $jsonSchema
// ────────────────────────────────────────────────────────────────────────────
router.put('/:id/estado',
  requireRol('admin', 'editor'),
  body('estado').trim().notEmpty().withMessage('El estado es obligatorio'),
  async (req, res) => {
    if (!validar(req, res)) return;
    const oid = toObjectId(req.params.id, res);
    if (!oid) return;

    const nuevoEstado = req.body.estado.trim();
    if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
      return res.status(400).json({
        error: `Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}`
      });
    }

    try {
      const db = getDB('user');
      const campos = { estado: nuevoEstado };
      // Si el estado es 'entregado', registrar la fecha de entrega
      if (nuevoEstado === 'entregado') campos.fechaEntrega = new Date();

      const resultado = await db.collection('pedidos').updateOne(
        { _id: oid },
        { $set: campos }
      );
      if (resultado.matchedCount === 0) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }
      res.json({ mensaje: `Estado actualizado a '${nuevoEstado}'` });
    } catch (err) {
      console.error('PUT /pedidos/:id/estado:', err.message);
      res.status(500).json({ error: 'Error al actualizar estado' });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/pedidos/:id — Eliminar un pedido (usa adminTotal)
// ────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireRol('admin'), async (req, res) => {
  const oid = toObjectId(req.params.id, res);
  if (!oid) return;
  try {
    const db = getDB('admin');
    const resultado = await db.collection('pedidos').deleteOne({ _id: oid });
    if (resultado.deletedCount === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    res.json({ mensaje: 'Pedido eliminado' });
  } catch (err) {
    console.error('DELETE /pedidos/:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar pedido' });
  }
});

module.exports = router;
