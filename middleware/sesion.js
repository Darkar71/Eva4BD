/**
 * middleware/sesion.js — Control de acceso por sesión y rol
 *
 * Roles del sistema:
 *   admin   → adminTotal      (acceso completo: crear, editar, eliminar)
 *   editor  → usuarioDB       (crear y editar, sin eliminar)
 *   lectura → usuarioLectura  (solo lectura, sin botones de acción)
 */

'use strict';

/**
 * requireAuth — exige que exista una sesión iniciada.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ error: 'No autenticado. Inicia sesión.' });
  }
  next();
}

/**
 * requireRol(...rolesPermitidos) — exige sesión iniciada Y que el rol
 * del usuario esté dentro de los roles permitidos para esa ruta.
 * Ejemplo: requireRol('admin', 'editor')
 */
function requireRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({ error: 'No autenticado. Inicia sesión.' });
    }
    if (!rolesPermitidos.includes(req.session.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para realizar esta acción' });
    }
    next();
  };
}

/**
 * clienteSegunRol(req) — Devuelve qué conexión de Mongo (ver db.js) debe
 * usarse para una lectura, según el rol de la sesión activa.
 * El usuario 'lectura' consulta con su propia conexión (usuarioLectura),
 * el resto usa la conexión estándar (usuarioDB).
 */
function clienteSegunRol(req) {
  return req.session?.usuario?.rol === 'lectura' ? 'read' : 'user';
}

module.exports = { requireAuth, requireRol, clienteSegunRol };
