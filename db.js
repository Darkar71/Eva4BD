/**
 * db.js — Módulo de conexión a MongoDB
 *
 * Gestiona tres conexiones separadas según el rol del usuario:
 *   - adminClient  : usuario adminTotal      → acceso completo (crear, eliminar, administrar)
 *   - dbClient     : usuario usuarioDB       → lectura/escritura sobre comerciotech_db
 *   - readClient   : usuario usuarioLectura  → solo lectura sobre comerciotech_db
 *
 * Todas las conexiones usan autenticación obligatoria,
 * siguiendo las recomendaciones del CIS MongoDB Benchmark.
 */

'use strict';

require('dotenv').config();
const { MongoClient } = require('mongodb');

const {
  MONGO_HOST,
  MONGO_PORT,
  MONGO_DB,
  MONGO_USER_ADMIN,
  MONGO_PASS_ADMIN,
  MONGO_USER_DB,
  MONGO_PASS_DB,
  MONGO_USER_READ,
  MONGO_PASS_READ,
} = process.env;

// ── Opciones comunes de conexión ──────────────────────────────────────────────
const BASE_OPTIONS = {
  connectTimeoutMS: 15000,
  serverSelectionTimeoutMS: 15000,
};

// ── URIs de conexión ──────────────────────────────────────────────────────────
// Se usa authSource=admin porque ambos usuarios fueron creados en la base admin
const URI_ADMIN = `mongodb://${MONGO_USER_ADMIN}:${encodeURIComponent(MONGO_PASS_ADMIN)}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
const URI_DB = `mongodb://${MONGO_USER_DB}:${encodeURIComponent(MONGO_PASS_DB)}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=proyectoDB`;
// NOTA: usuarioLectura usa el mismo authSource que usuarioDB (proyectoDB).
// Si al conectar da error de autenticación, cambia authSource=proyectoDB por authSource=admin.
const URI_READ = `mongodb://${MONGO_USER_READ}:${encodeURIComponent(MONGO_PASS_READ)}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=proyectoDB`;
// ── Instancias de cliente ─────────────────────────────────────────────────────
let adminClient = null;
let dbClient    = null;
let readClient  = null;

/**
 * conectar() — Abre ambas conexiones a MongoDB.
 * Se llama una sola vez al iniciar el servidor.
 */
async function conectar() {
  try {
    adminClient = new MongoClient(URI_ADMIN, BASE_OPTIONS);
    dbClient    = new MongoClient(URI_DB,    BASE_OPTIONS);
    readClient  = new MongoClient(URI_READ,  BASE_OPTIONS);

    await adminClient.connect();
    await dbClient.connect();
    await readClient.connect();

    console.log('✅ Conexión MongoDB establecida (adminTotal + usuarioDB + usuarioLectura)');
  } catch (err) {
    console.error('❌ Error al conectar a MongoDB:', err.message);
    process.exit(1); // Detiene el servidor si no puede conectar
  }
}

/**
 * getDB(rol) — Retorna la base de datos según el rol solicitado.
 * @param {'admin'|'user'|'read'} rol
 * @returns {import('mongodb').Db}
 */
function getDB(rol = 'user') {
  if (rol === 'admin') {
    if (!adminClient) throw new Error('adminClient no inicializado');
    return adminClient.db(MONGO_DB);
  }
  if (rol === 'read') {
    if (!readClient) throw new Error('readClient no inicializado');
    return readClient.db(MONGO_DB);
  }
  if (!dbClient) throw new Error('dbClient no inicializado');
  return dbClient.db(MONGO_DB);
}

/**
 * cerrar() — Cierra ambas conexiones limpiamente.
 * Se llama al apagar el servidor (SIGINT/SIGTERM).
 */
async function cerrar() {
  if (adminClient) await adminClient.close();
  if (dbClient)    await dbClient.close();
  if (readClient)  await readClient.close();
  console.log('🔌 Conexiones MongoDB cerradas');
}

module.exports = { conectar, getDB, cerrar };
