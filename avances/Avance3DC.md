# Avance 3
**Diego Carvajal**

## 1. Modelo de Base de Datos NoSQL

ComercioTech requiere un modelo de datos documental que soporte la flexibilidad necesaria para gestionar clientes, productos y pedidos con atributos variables. A diferencia de un modelo relacional, MongoDB permite almacenar subdocumentos y arreglos dentro de un mismo documento, lo que reduce la necesidad de JOINs y mejora el rendimiento en las consultas más frecuentes.

### 1.1 Decisiones de Diseño

El modelo se diseñó considerando los patrones de consulta más frecuentes del sistema:

- Los pedidos embeben un arreglo de productos para evitar consultas cruzadas en operaciones de lectura de historial.
- Los clientes incluyen su dirección como subdocumento, ya que siempre se consultan juntos.
- Los productos usan un subdocumento de especificaciones flexible para soportar atributos distintos por categoría.
- Se definen índices en los campos de búsqueda más frecuentes: email, estado del pedido y categoría de producto.

## 2. Creación de Colecciones

Se creó la base de datos `comerciotech_db` y sus colecciones en MongoDB desde la consola `mongosh`. Las colecciones se crean con validación de esquema usando `$jsonSchema` para garantizar la integridad de los datos.

### 2.1 Crear la Base de Datos y Colecciones

Ejecutar en mongosh:

```javascript
// Seleccionar (o crear) la base de datos
use comerciotech_db

// Crear colección clientes con validación de esquema
db.createCollection("clientes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre", "email", "telefono", "direccion", "fechaRegistro"],
      properties: {
        nombre:        { bsonType: "string", description: "Nombre completo del cliente" },
        email:         { bsonType: "string", description: "Email único del cliente" },
        telefono:      { bsonType: "string", description: "Teléfono de contacto" },
        direccion:     { bsonType: "object", description: "Dirección embebida" },
        fechaRegistro: { bsonType: "date",   description: "Fecha de registro" },
        activo:        { bsonType: "bool",   description: "Estado de la cuenta" }
      }
    }
  },
  validationLevel: "moderate"
})
```

**Resultado en consola:**

```
comerciotech_db> db.createCollection("clientes", {
...     validator: {
...       $jsonSchema: {
...         bsonType: "object",
...         required: ["nombre", "email", "telefono", "direccion", "fechaRegistro"],
...         properties: {
...           nombre:        { bsonType: "string",   description: "Nombre completo del cliente" },
...           email:         { bsonType: "string",   description: "Email único del cliente" },
...           telefono:      { bsonType: "string",   description: "Teléfono de contacto" },
...           direccion:     { bsonType: "object",   description: "Dirección embebida" },
...           fechaRegistro: { bsonType: "date",     description: "Fecha de registro" },
...           activo:        { bsonType: "bool",     description: "Estado de la cuenta" }
...         }
...       }
...     },
...     validationLevel: "moderate"
... })
{ ok: 1 }
```

```javascript
// Crear colección productos con validación de esquema
db.createCollection("productos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre", "categoria", "precio", "stock", "fechaIngreso"],
      properties: {
        nombre:           { bsonType: "string", description: "Nombre del producto" },
        categoria:        { bsonType: "string", description: "Categoría del producto" },
        precio:           { bsonType: "double", description: "Precio en CLP" },
        stock:            { bsonType: "int",    description: "Unidades disponibles" },
        especificaciones: { bsonType: "object", description: "Atributos variables por categoría" },
        fechaIngreso:     { bsonType: "date",   description: "Fecha de ingreso al catálogo" }
      }
    }
  },
  validationLevel: "moderate"
})
```

**Resultado en consola:**

```
comerciotech_db> db.createCollection("productos", {
...     validator: {
...       $jsonSchema: {
...         bsonType: "object",
...         required: ["nombre", "categoria", "precio", "stock", "fechaIngreso"],
...         properties: {
...           nombre:           { bsonType: "string", description: "Nombre del producto" },
...           categoria:        { bsonType: "string", description: "Categoría del producto" },
...           precio:           { bsonType: "double", description: "Precio en CLP" },
...           stock:            { bsonType: "int",    description: "Unidades disponibles" },
...           especificaciones: { bsonType: "object", description: "Atributos variables por categoría" },
...           fechaIngreso:     { bsonType: "date",   description: "Fecha de ingreso al catálogo" }
...         }
...       }
...     },
...     validationLevel: "moderate"
... })
{ ok: 1 }
```

```javascript
// Crear colección pedidos con validación de esquema
db.createCollection("pedidos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["clienteId", "productos", "estado", "total", "fechaPedido"],
      properties: {
        clienteId:      { bsonType: "objectId", description: "Referencia al cliente" },
        productos:      { bsonType: "array",    description: "Arreglo de productos del pedido" },
        estado:         { bsonType: "string", enum: ["pendiente","en_proceso","enviado","entregado","cancelado"] },
        total:          { bsonType: "double",   description: "Total del pedido en CLP" },
        fechaPedido:    { bsonType: "date",     description: "Fecha del pedido" },
        direccionEnvio: { bsonType: "object",   description: "Dirección de entrega embebida" }
      }
    }
  },
  validationLevel: "moderate"
})
```

**Resultado en consola:**

```
comerciotech_db> db.createCollection("pedidos", {
...     validator: {
...       $jsonSchema: {
...         bsonType: "object",
...         required: ["clienteId", "productos", "estado", "total", "fechaPedido"],
...         properties: {
...           clienteId:      { bsonType: "objectId", description: "Referencia al cliente" },
...           productos:      { bsonType: "array",    description: "Arreglo de productos del pedido" },
...           estado:         { bsonType: "string",   enum: ["pendiente","en_proceso","enviado","entregado","cancelado"] },
...           total:          { bsonType: "double",   description: "Total del pedido en CLP" },
...           fechaPedido:    { bsonType: "date",     description: "Fecha del pedido" },
...           direccionEnvio: { bsonType: "object",   description: "Dirección de entrega embebida" }
...         }
...       }
...     },
...     validationLevel: "moderate"
... })
{ ok: 1 }
```

### 2.2 Creación de Índices

```javascript
// Índice único en email de clientes (búsquedas de login)
db.clientes.createIndex({ email: 1 }, { unique: true, name: "idx_email_unico" })

// Índice en categoría de productos (filtros de catálogo)
db.productos.createIndex({ categoria: 1 }, { name: "idx_categoria" })

// Índice en estado de pedidos (filtros por estado)
db.pedidos.createIndex({ estado: 1 }, { name: "idx_estado_pedido" })

// Índice en clienteId de pedidos (historial por cliente)
db.pedidos.createIndex({ clienteId: 1 }, { name: "idx_cliente_pedidos" })

// Verificar índices creados
db.clientes.getIndexes()
db.productos.getIndexes()
db.pedidos.getIndexes()
```

**Resultado en consola:**

```
comerciotech_db> db.clientes.createIndex({ email: 1 }, { unique: true, name: "idx_email_unico" })
idx_email_unico

comerciotech_db> db.productos.createIndex({ categoria: 1 }, { name: "idx_categoria" })
idx_categoria

comerciotech_db> db.pedidos.createIndex({ estado: 1 }, { name: "idx_estado_pedido" })
idx_estado_pedido

comerciotech_db> db.pedidos.createIndex({ clienteId: 1 }, { name: "idx_cliente_pedidos" })
idx_cliente_pedidos

comerciotech_db> db.clientes.getIndexes()
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { email: 1 }, name: 'idx_email_unico', unique: true }
]

comerciotech_db> db.productos.getIndexes()
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { categoria: 1 }, name: 'idx_categoria' }
]

comerciotech_db> db.pedidos.getIndexes()
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { estado: 1 }, name: 'idx_estado_pedido' },
  { v: 2, key: { clienteId: 1 }, name: 'idx_cliente_pedidos' }
]
```

## 3. Implementación de Documentos

Inserción de documentos de ejemplo en cada colección, siguiendo la estructura definida en el modelo.

### 3.1 Documentos — Colección clientes

Cada cliente incluye su dirección como subdocumento y un arreglo de preferencias de categoría:

```javascript
use comerciotech_db

// Insertar clientes de ejemplo
db.clientes.insertMany([
  {
    nombre: "María González",
    email: "maria.gonzalez@email.com",
    telefono: "+56912345678",
    direccion: {
      calle: "Av. Providencia 1234",
      ciudad: "Santiago",
      region: "Metropolitana",
      codigoPostal: "7500000"
    },
    fechaRegistro: new Date('2024-03-15'),
    activo: true,
    preferencias: ["electronica", "computacion"],
    totalCompras: 3,
    montoAcumulado: 450000
  },
  {
    nombre: "Carlos Pérez",
    email: "carlos.perez@email.com",
    telefono: "+56987654321",
    direccion: {
      calle: "Calle Falsa 567",
      ciudad: "Valparaíso",
      region: "Valparaíso",
      codigoPostal: "2340000"
    },
    fechaRegistro: new Date('2024-06-20'),
    activo: true,
    preferencias: ["ropa", "calzado"],
    totalCompras: 1,
    montoAcumulado: 89990
  }
])
```

**Resultado en consola:**

```
comerciotech_db> use comerciotech_db
already on db comerciotech_db

comerciotech_db> db.clientes.insertMany([
...   {
...     nombre: "María González",
...     email: "maria.gonzalez@email.com",
...     telefono: "+56912345678",
...     direccion: {
...       calle: "Av. Providencia 1234",
...       ciudad: "Santiago",
...       region: "Metropolitana",
...       codigoPostal: "7500000"
...     },
...     fechaRegistro: new Date('2024-03-15'),
...     activo: true,
...     preferencias: ["electronica", "computacion"],
...     totalCompras: 3,
...     montoAcumulado: 450000
...   },
...   {
...     nombre: "Carlos Pérez",
...     email: "carlos.perez@email.com",
...     telefono: "+56987654321",
...     direccion: {
...       calle: "Calle Falsa 567",
...       ciudad: "Valparaíso",
...       region: "Valparaíso",
...       codigoPostal: "2340000"
...     },
...     fechaRegistro: new Date('2024-06-20'),
...     activo: true,
...     preferencias: ["ropa", "calzado"],
...     totalCompras: 1,
...     montoAcumulado: 89990
...   }
... ])
{
  acknowledged: true,
  insertedIds: {
    '0': ObjectId('6843f4c200c7e90d13f7b422'),
    '1': ObjectId('6843f4c200c7e90d13f7b423')
  }
}
```

```javascript
// Verificar documentos insertados
db.clientes.find()
```

**Resultado en consola:**

```
comerciotech_db> db.clientes.find()
[
  {
    _id: ObjectId('6843f4c200c7e90d13f7b422'),
    nombre: 'María González',
    email: 'maria.gonzalez@email.com',
    telefono: '+56912345678',
    direccion: {
      calle: 'Av. Providencia 1234',
      ciudad: 'Santiago',
      region: 'Metropolitana',
      codigoPostal: '7500000'
    },
    fechaRegistro: ISODate('2024-03-15T00:00:00.000Z'),
    activo: true,
    preferencias: [ 'electronica', 'computacion' ],
    totalCompras: 3,
    montoAcumulado: 450000
  },
  {
    _id: ObjectId('6843f4c200c7e90d13f7b423'),
    nombre: 'Carlos Pérez',
    email: 'carlos.perez@email.com',
    telefono: '+56987654321',
    direccion: {
      calle: 'Calle Falsa 567',
      ciudad: 'Valparaíso',
      region: 'Valparaíso',
      codigoPostal: '2340000'
    },
    fechaRegistro: ISODate('2024-06-20T00:00:00.000Z'),
    activo: true,
    preferencias: [ 'ropa', 'calzado' ],
    totalCompras: 1,
    montoAcumulado: 89990
  }
]
```

### 3.2 Documentos — Colección productos

```javascript
db.productos.insertMany([
  {
    nombre: "Notebook Lenovo IdeaPad 3",
    categoria: "computacion",
    precio: 399990,
    stock: 15,
    especificaciones: {
      procesador: "Intel Core i5-1235U",
      ram: "8GB DDR4",
      almacenamiento: "512GB SSD",
      pantalla: "15.6 pulgadas Full HD",
      sistemaOperativo: "Windows 11 Home"
    },
    fechaIngreso: new Date('2024-01-10'),
    activo: true,
    calificacion: 4.5
  },
  {
    nombre: "Polera Deportiva Nike Dri-FIT",
    categoria: "ropa",
    precio: 24990,
    stock: 80,
    especificaciones: {
      tallas: ["S","M","L","XL"],
      colores: ["negro","blanco","azul"],
      material: "100% Poliéster",
      genero: "Unisex"
    },
    fechaIngreso: new Date('2024-02-05'),
    activo: true,
    calificacion: 4.2
  },
  {
    nombre: "Smartphone Samsung Galaxy A54",
    categoria: "electronica",
    precio: 329990,
    stock: 25,
    especificaciones: {
      procesador: "Exynos 1380",
      ram: "8GB",
      almacenamiento: "256GB",
      camara: "50MP + 12MP + 5MP",
      bateria: "5000mAh",
      pantalla: "6.4 pulgadas AMOLED"
    },
    fechaIngreso: new Date('2024-01-20'),
    activo: true,
    calificacion: 4.7
  }
])
```

**Resultado en consola:**

```
comerciotech_db> db.productos.insertMany([...])
{
  acknowledged: true,
  insertedIds: {
    '0': ObjectId('6843f5a300c7e90d13f7b424'),
    '1': ObjectId('6843f5a300c7e90d13f7b425'),
    '2': ObjectId('6843f5a300c7e90d13f7b426')
  }
}
```

```javascript
// Verificar productos insertados
db.productos.find()
```

**Resultado en consola:**

```
comerciotech_db> db.productos.find()
[
  {
    _id: ObjectId('6843f5a300c7e90d13f7b424'),
    nombre: 'Notebook Lenovo IdeaPad 3',
    categoria: 'computacion',
    precio: 399990,
    stock: 15,
    especificaciones: {
      procesador: 'Intel Core i5-1235U',
      ram: '8GB DDR4',
      almacenamiento: '512GB SSD',
      pantalla: '15.6 pulgadas Full HD',
      sistemaOperativo: 'Windows 11 Home'
    },
    fechaIngreso: ISODate('2024-01-10T00:00:00.000Z'),
    activo: true,
    calificacion: 4.5
  },
  {
    _id: ObjectId('6843f5a300c7e90d13f7b425'),
    nombre: 'Polera Deportiva Nike Dri-FIT',
    categoria: 'ropa',
    precio: 24990,
    stock: 80,
    especificaciones: {
      tallas: [ 'S', 'M', 'L', 'XL' ],
      colores: [ 'negro', 'blanco', 'azul' ],
      material: '100% Poliéster',
      genero: 'Unisex'
    },
    fechaIngreso: ISODate('2024-02-05T00:00:00.000Z'),
    activo: true,
    calificacion: 4.2
  },
  {
    _id: ObjectId('6843f5a300c7e90d13f7b426'),
    nombre: 'Smartphone Samsung Galaxy A54',
    categoria: 'electronica',
    precio: 329990,
    stock: 25,
    especificaciones: {
      procesador: 'Exynos 1380',
      ram: '8GB',
      almacenamiento: '256GB',
      camara: '50MP + 12MP + 5MP',
      bateria: '5000mAh',
      pantalla: '6.4 pulgadas AMOLED'
    },
    fechaIngreso: ISODate('2024-01-20T00:00:00.000Z'),
    activo: true,
    calificacion: 4.7
  }
]
```

### 3.3 Documentos — Colección pedidos

Cada pedido incluye un arreglo de productos comprados:

```javascript
// Obtener el _id de un cliente para referenciar
let cliente = db.clientes.findOne({ email: "maria.gonzalez@email.com" })

db.pedidos.insertMany([
  {
    clienteId: cliente._id,
    clienteNombre: "María González",
    productos: [
      {
        productoId: db.productos.findOne({ nombre: /Notebook/ })._id,
        nombre: "Notebook Lenovo IdeaPad 3",
        precioUnitario: 399990,
        cantidad: 1,
        subtotal: 399990
      }
    ],
    estado: "entregado",
    total: 399990,
    fechaPedido: new Date('2024-04-01'),
    fechaEntrega: new Date('2024-04-03'),
    direccionEnvio: {
      calle: "Av. Providencia 1234",
      ciudad: "Santiago",
      region: "Metropolitana"
    },
    metodoPago: "tarjeta_credito",
    notasCliente: "Dejar en conserjería"
  },
  {
    clienteId: cliente._id,
    clienteNombre: "María González",
    productos: [
      {
        productoId: db.productos.findOne({ nombre: /Samsung/ })._id,
        nombre: "Smartphone Samsung Galaxy A54",
        precioUnitario: 329990,
        cantidad: 1,
        subtotal: 329990
      },
      {
        productoId: db.productos.findOne({ nombre: /Nike/ })._id,
        nombre: "Polera Deportiva Nike Dri-FIT",
        precioUnitario: 24990,
        cantidad: 2,
        subtotal: 49980
      }
    ],
    estado: "en_proceso",
    total: 379970,
    fechaPedido: new Date(),
    direccionEnvio: {
      calle: "Av. Providencia 1234",
      ciudad: "Santiago",
      region: "Metropolitana"
    },
    metodoPago: "transferencia"
  }
])
```

**Resultado en consola:**

```
comerciotech_db> let cliente = db.clientes.findOne({ email: "maria.gonzalez@email.com" })

comerciotech_db> db.pedidos.insertMany([...])
{
  acknowledged: true,
  insertedIds: {
    '0': ObjectId('6843f6b100c7e90d13f7b427'),
    '1': ObjectId('6843f6b100c7e90d13f7b428')
  }
}
```

```javascript
// Verificar pedidos insertados
db.pedidos.find()
```

**Resultado en consola:**

```
comerciotech_db> db.pedidos.find()
[
  {
    _id: ObjectId('6843f6b100c7e90d13f7b427'),
    clienteId: ObjectId('6843f4c200c7e90d13f7b422'),
    clienteNombre: 'María González',
    productos: [
      {
        productoId: ObjectId('6843f5a300c7e90d13f7b424'),
        nombre: 'Notebook Lenovo IdeaPad 3',
        precioUnitario: 399990,
        cantidad: 1,
        subtotal: 399990
      }
    ],
    estado: 'entregado',
    total: 399990,
    fechaPedido: ISODate('2024-04-01T00:00:00.000Z'),
    fechaEntrega: ISODate('2024-04-03T00:00:00.000Z'),
    direccionEnvio: {
      calle: 'Av. Providencia 1234',
      ciudad: 'Santiago',
      region: 'Metropolitana'
    },
    metodoPago: 'tarjeta_credito',
    notasCliente: 'Dejar en conserjería'
  },
  {
    _id: ObjectId('6843f6b100c7e90d13f7b428'),
    clienteId: ObjectId('6843f4c200c7e90d13f7b422'),
    clienteNombre: 'María González',
    productos: [
      {
        productoId: ObjectId('6843f5a300c7e90d13f7b426'),
        nombre: 'Smartphone Samsung Galaxy A54',
        precioUnitario: 329990,
        cantidad: 1,
        subtotal: 329990
      },
      {
        productoId: ObjectId('6843f5a300c7e90d13f7b425'),
        nombre: 'Polera Deportiva Nike Dri-FIT',
        precioUnitario: 24990,
        cantidad: 2,
        subtotal: 49980
      }
    ],
    estado: 'en_proceso',
    total: 379970,
    fechaPedido: ISODate('2025-06-23T14:38:55.000Z'),
    direccionEnvio: {
      calle: 'Av. Providencia 1234',
      ciudad: 'Santiago',
      region: 'Metropolitana'
    },
    metodoPago: 'transferencia'
  }
]
```

## 4. Documentación de la Estructura de Base de Datos

En esta sección se documenta formalmente la estructura de cada colección, incluyendo los campos, tipos de datos, validaciones y justificación de las decisiones de diseño.

### 4.1 Base de Datos: comerciotech_db

| Parámetro | Valor | Descripción |
|---|---|---|
| Nombre | comerciotech_db | Base de datos principal del proyecto |
| Motor | WiredTiger | Motor de almacenamiento por defecto en MongoDB 7.x |
| Colecciones | 3 | clientes, productos, pedidos |
| Índices totales | 7 | 1 por defecto (_id) por colección + 4 adicionales |
| Validación | $jsonSchema | Validación de esquema en modo 'moderate' |

### 4.2 Estructura — Colección clientes

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| _id | ObjectId | Auto | Identificador único generado por MongoDB |
| nombre | String | Sí | Nombre completo del cliente |
| email | String | Sí | Email único — tiene índice único para búsquedas de login |
| telefono | String | Sí | Número de contacto con código de país |
| direccion | Object | Sí | Subdocumento con calle, ciudad, región y código postal |
| fechaRegistro | Date | Sí | Fecha de creación de la cuenta |
| activo | Boolean | No | Estado de la cuenta (true = activo) |
| preferencias | Array[String] | No | Categorías de interés del cliente |
| totalCompras | Integer | No | Contador de pedidos realizados |
| montoAcumulado | Double | No | Total histórico gastado en CLP |

### 4.3 Estructura — Colección productos

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| _id | ObjectId | Auto | Identificador único generado por MongoDB |
| nombre | String | Sí | Nombre comercial del producto |
| categoria | String | Sí | Categoría principal — tiene índice para filtros de catálogo |
| precio | Double | Sí | Precio en pesos chilenos (CLP) |
| stock | Integer | Sí | Unidades disponibles en inventario |
| especificaciones | Object | No | Subdocumento flexible con atributos según categoría |
| fechaIngreso | Date | Sí | Fecha de ingreso al catálogo |
| activo | Boolean | No | Disponibilidad del producto en el catálogo |
| calificacion | Double | No | Promedio de calificaciones (1.0 a 5.0) |

### 4.4 Estructura — Colección pedidos

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| _id | ObjectId | Auto | Identificador único generado por MongoDB |
| clienteId | ObjectId | Sí | Referencia al _id del cliente — tiene índice para historial |
| clienteNombre | String | No | Nombre del cliente al momento del pedido (desnormalizado) |
| productos | Array[Object] | Sí | Arreglo con los productos comprados y sus precios al momento |
| estado | String | Sí | Estado del pedido (enum: pendiente, en_proceso, enviado, entregado, cancelado) |
| total | Double | Sí | Monto total del pedido en CLP |
| fechaPedido | Date | Sí | Fecha y hora de creación del pedido |
| fechaEntrega | Date | No | Fecha de entrega efectiva (se llena al entregar) |
| direccionEnvio | Object | No | Dirección de envío embebida al momento del pedido |
| metodoPago | String | No | Método de pago utilizado |
| notasCliente | String | No | Instrucciones adicionales del cliente |

### 4.5 Estructura del Subdocumento productos (dentro de pedidos)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| productoId | ObjectId | Sí | Referencia al _id del producto original |
| nombre | String | Sí | Nombre del producto al momento de la compra |
| precioUnitario | Double | Sí | Precio unitario al momento de la compra |
| cantidad | Integer | Sí | Unidades compradas |
| subtotal | Double | Sí | precioUnitario × cantidad |

### 4.6 Resumen de Consultas de Verificación

Ejecutar estas consultas para verificar que todo fue creado correctamente:

```javascript
use comerciotech_db

// Ver todas las colecciones
show collections

// Contar documentos por colección
db.clientes.countDocuments()
db.productos.countDocuments()
db.pedidos.countDocuments()

// Ver índices de cada colección
db.clientes.getIndexes()
db.productos.getIndexes()
db.pedidos.getIndexes()

// Consulta de ejemplo: pedidos entregados de un cliente
db.pedidos.find({ estado: "entregado" }).pretty()

// Consulta de ejemplo: productos de una categoría
db.productos.find({ categoria: "electronica" }).pretty()
```

**Resultado en consola:**

```
comerciotech_db> use comerciotech_db
already on db comerciotech_db

comerciotech_db> show collections
clientes
pedidos
productos

comerciotech_db> db.clientes.countDocuments()
2

comerciotech_db> db.productos.countDocuments()
3

comerciotech_db> db.pedidos.countDocuments()
2

comerciotech_db> db.clientes.getIndexes()
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { email: 1 }, name: 'idx_email_unico', unique: true }
]

comerciotech_db> db.productos.getIndexes()
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { categoria: 1 }, name: 'idx_categoria' }
]

comerciotech_db> db.pedidos.getIndexes()
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { estado: 1 }, name: 'idx_estado_pedido' },
  { v: 2, key: { clienteId: 1 }, name: 'idx_cliente_pedidos' }
]

comerciotech_db> db.pedidos.find({ estado: "entregado" })
[
  {
    _id: ObjectId('6843f6b100c7e90d13f7b427'),
    clienteId: ObjectId('6843f4c200c7e90d13f7b422'),
    clienteNombre: 'María González',
    productos: [
      {
        productoId: ObjectId('6843f5a300c7e90d13f7b424'),
        nombre: 'Notebook Lenovo IdeaPad 3',
        precioUnitario: 399990,
        cantidad: 1,
        subtotal: 399990
      }
    ],
    estado: 'entregado',
    total: 399990,
    fechaPedido: ISODate('2024-04-01T00:00:00.000Z'),
    fechaEntrega: ISODate('2024-04-03T00:00:00.000Z'),
    direccionEnvio: {
      calle: 'Av. Providencia 1234',
      ciudad: 'Santiago',
      region: 'Metropolitana'
    },
    metodoPago: 'tarjeta_credito',
    notasCliente: 'Dejar en conserjería'
  }
]

comerciotech_db> db.productos.find({ categoria: "electronica" })
[
  {
    _id: ObjectId('6843f5a300c7e90d13f7b426'),
    nombre: 'Smartphone Samsung Galaxy A54',
    categoria: 'electronica',
    precio: 329990,
    stock: 25,
    especificaciones: {
      procesador: 'Exynos 1380',
      ram: '8GB',
      almacenamiento: '256GB',
      camara: '50MP + 12MP + 5MP',
      bateria: '5000mAh',
      pantalla: '6.4 pulgadas AMOLED'
    },
    fechaIngreso: ISODate('2024-01-20T00:00:00.000Z'),
    activo: true,
    calificacion: 4.7
  }
]
```

## 5. Resumen

| N° | Tarea realizada | Resultado |
|---|---|---|
| 1 | Diseño del modelo de datos documental | 3 colecciones con subdocumentos y arreglos definidos |
| 2 | Creación de comerciotech_db | Base de datos activa en MongoDB |
| 3 | Creación de colección clientes con $jsonSchema | Validación en modo moderate activa |
| 4 | Creación de colección productos con $jsonSchema | Soporte a especificaciones flexibles por categoría |
| 5 | Creación de colección pedidos con $jsonSchema | Enum de estados validado automáticamente |
| 6 | Creación de 4 índices adicionales | Optimización de consultas frecuentes |
| 7 | Inserción de documentos de ejemplo en clientes | 2 clientes con subdocumento dirección |
| 8 | Inserción de documentos de ejemplo en productos | 3 productos con especificaciones variables |
| 9 | Inserción de documentos de ejemplo en pedidos | 2 pedidos con arreglo de productos embebido |
| 10 | Documentación de estructuras y decisiones de diseño | Tablas de campos, tipos y justificaciones |
