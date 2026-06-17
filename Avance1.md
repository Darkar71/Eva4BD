# Avance 1 — Análisis de Necesidades y Requisitos Técnicos

**Alumno:** Diego Carvajal  
**Asignatura:** Bases de Datos No Estructuradas  
**Código:** TI3032  
**Año:** 2026

---

## 1. Análisis de las Necesidades del Negocio

### 1.1 Caso de estudio

**ComercioTech** es una empresa de comercio en proceso de expansión que actualmente gestiona clientes, productos y pedidos a través de una base de datos heredada que ya no es capaz de soportar el crecimiento operativo. La empresa necesita modernizar su infraestructura de datos para manejar de forma eficiente el aumento en el volumen de transacciones, la diversidad de productos y la base de clientes en crecimiento. Su rubro es el comercio electrónico y retail, con operaciones que requieren disponibilidad continua y alta capacidad de respuesta.

### 1.2 Procesos operativos vinculados

| Proceso operativo | Necesidad de datos | Vínculo con la base de datos |
|---|---|---|
| Gestión de pedidos | Registrar y consultar pedidos en tiempo real con distintos estados (pendiente, en proceso, entregado) | Documentos con estructura variable según tipo de pedido → ideal para NoSQL |
| Gestión de clientes | Almacenar datos de clientes con perfiles variables (dirección, historial, preferencias) | Documentos flexibles que no requieren esquema fijo → MongoDB |
| Gestión de productos | Mantener catálogo con atributos distintos por categoría de producto | Colecciones con documentos de estructura heterogénea → ventaja de MongoDB sobre SQL |
| Procesamiento de transacciones | Registrar pagos, devoluciones y movimientos con trazabilidad completa | Alto volumen de escritura concurrente → requiere DBMS con buen rendimiento de escritura |

### 1.3 Crecimiento del negocio y objetivos

ComercioTech proyecta expandirse hacia nuevas regiones del país durante los próximos 12 meses, lo que implica incorporar nuevos proveedores, aumentar el catálogo de productos y atraer un mayor volumen de clientes. Este crecimiento genera una presión directa sobre el sistema de datos en tres dimensiones:

- **Volumen:** más transacciones diarias, más registros de clientes y más variantes de productos.
- **Variedad:** los nuevos productos pueden tener atributos completamente distintos, lo que hace inviable un esquema relacional rígido.
- **Velocidad:** en campañas de descuento o fechas especiales (como el CyberMonday), el sistema debe soportar picos de demanda sin degradación del servicio.

Estos factores justifican la necesidad de migrar a una base de datos NoSQL como MongoDB, que soporta esquemas flexibles, escalado horizontal y alto rendimiento de lectura/escritura.

---

## 2. Volúmenes de Datos Actuales y Proyectados

### 2.1 Volumen actual estimado

| Entidad de datos | Cantidad actual | Tamaño aproximado por registro | Volumen total estimado |
|---|---|---|---|
| Clientes | 15.000 | 3 KB | 45 MB |
| Productos | 8.000 | 5 KB | 40 MB |
| Pedidos | 50.000 | 8 KB | 400 MB |
| Transacciones | 120.000 | 2 KB | 240 MB |
| **Total estimado** | | | **~725 MB** |

### 2.2 Proyección de crecimiento

| Horizonte | Supuesto de crecimiento | Volumen proyectado |
|---|---|---|
| 6 meses | Expansión a 2 nuevas regiones, +40% clientes, +60% pedidos | ~1,2 GB |
| 1 año | Consolidación regional, campañas de marketing, +100% clientes, +150% pedidos | ~2,5 GB |
| 3 años | Expansión nacional completa, integración con marketplaces externos, +400% total | ~8 GB |

Los supuestos de crecimiento se basan en la expansión geográfica planificada por ComercioTech y en el comportamiento estacional del comercio electrónico chileno, donde eventos como el CyberMonday y fiestas de fin de año pueden triplicar el volumen de transacciones en periodos cortos. Esto genera una carga operativa intensiva sobre la base de datos en escrituras concurrentes y consultas de estado de pedidos en tiempo real.

---

## 3. Requisitos de Rendimiento, Escalabilidad y Disponibilidad

### 3.1 Rendimiento

El sistema debe responder consultas de catálogo y estado de pedidos en menos de 200 ms bajo carga normal. Durante picos de demanda (eventos de descuento), se estima un volumen de hasta 500 consultas concurrentes por minuto. Las operaciones de escritura (registro de pedidos y transacciones) deben completarse en menos de 500 ms para no afectar la experiencia del usuario en el proceso de compra.

### 3.2 Escalabilidad

Se requiere escalado horizontal mediante **sharding** a mediano plazo, dado que el volumen proyectado a 3 años supera los 8 GB y el patrón de crecimiento es sostenido. A corto plazo, el escalado vertical (más RAM y CPU en el mismo servidor) es suficiente para manejar el crecimiento de 6 a 12 meses. MongoDB soporta ambas estrategias de escalado de forma nativa, lo que lo hace adecuado para este caso.

### 3.3 Disponibilidad y continuidad operativa

| Escenario de alta demanda | Requisito de disponibilidad |
|---|---|
| CyberMonday y eventos de descuento | Sin caídas, replicación activa (Replica Set en MongoDB) |
| Operación diaria normal | Disponibilidad mínima del 99,5% |
| Mantenimiento programado | Ventanas de mantenimiento nocturnas, sin impacto en horario comercial |
| Falla de servidor | Failover automático con Replica Set de 3 nodos |

El nivel de disponibilidad requerido es de **99,5% mensual** (~3,6 horas de downtime permitido al mes). Para lograrlo se necesita al menos un Replica Set con nodo primario y dos secundarios, con elección automática de nuevo primario ante fallos.

---

## 4. Requisitos de Seguridad y Cumplimiento Normativo

### 4.1 Riesgos en el tratamiento de datos

| Tipo de dato | Riesgo asociado | Medida de mitigación |
|---|---|---|
| Datos personales de clientes (nombre, dirección, email) | Filtración de información personal | Autenticación obligatoria en MongoDB, roles diferenciados, cifrado en tránsito |
| Historial de transacciones y pagos | Acceso no autorizado a información financiera | Rol de solo lectura para consultas, acceso restringido por IP (bindIp) |
| Credenciales de administración | Compromiso de la cuenta de administrador | Contraseñas robustas, acceso SSH solo por llave, sin login root externo |
| Datos del catálogo de productos | Modificación no autorizada de precios o stock | Separación de roles: solo el sistema de backoffice tiene permisos de escritura |

### 4.2 Cumplimiento normativo

En Chile, el tratamiento de datos personales está regulado por la **Ley N° 19.628 sobre Protección de la Vida Privada** y su futura actualización mediante el proyecto de ley que busca alinearla con estándares internacionales como el GDPR europeo. ComercioTech, al gestionar datos de clientes (nombre, dirección, historial de compras), está obligada a:

- Informar a los titulares sobre el uso de sus datos.
- Garantizar la seguridad de la información almacenada.
- Eliminar los datos cuando el titular lo solicite.
- No compartir datos con terceros sin consentimiento expreso.

A nivel técnico, esto se traduce en implementar controles de acceso, auditoría de accesos y mecanismos de respaldo que garanticen la integridad y disponibilidad de los datos.

### 4.3 Responsabilidades sobre el tratamiento de datos

| Rol | Responsabilidad |
|---|---|
| Administrador de BD (adminTotal) | Gestión completa del servidor MongoDB, creación de usuarios, respaldos |
| Desarrolladores backend (usuarioDB) | Acceso de lectura/escritura solo a las colecciones necesarias para la aplicación |
| Analistas de datos (usuarioLectura) | Solo lectura, sin capacidad de modificar ni eliminar registros |
| Responsable legal de la empresa | Responde ante la autoridad reguladora en caso de brecha de seguridad |

---

## 5. Requisitos Técnicos del DBMS MongoDB

### 5.1 Requisitos de hardware

| Recurso | Mínimo | Recomendado para este caso |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU (para manejar consultas concurrentes) |
| RAM | 2 GB | 4 GB (WiredTiger cache usa ~50% de la RAM disponible) |
| Almacenamiento | 10 GB | 50 GB SSD (según volumen proyectado a 1 año + índices + logs) |
| Red | 100 Mbps | 1 Gbps (para replicación y tráfico de aplicación) |

### 5.2 Requisitos de software

- Sistema operativo de 64 bits compatible (Ubuntu Server 22.04 LTS o Windows Server 2022).
- MongoDB Community Edition 7.x.
- Herramientas de administración: `mongosh` (consola), `mongodump`/`mongorestore` (respaldos).
- OpenSSH Server para acceso remoto seguro al servidor.

### 5.3 Compatibilidad y optimización según el volumen de datos del caso

Con un volumen actual de ~725 MB y proyección de ~2,5 GB a 1 año, la configuración de 4 GB de RAM es adecuada porque el motor de almacenamiento WiredTiger de MongoDB utiliza aproximadamente la mitad de la RAM disponible como caché (~2 GB), lo que permite mantener en memoria los índices más consultados (clientes por ID, pedidos por estado, productos por categoría) y reducir las lecturas a disco.

Se requiere crear índices en los campos más consultados:
- `clientes.email` (búsquedas de login)
- `pedidos.estado` (filtros de estado)
- `pedidos.clienteId` (historial de compras por cliente)
- `productos.categoria` (filtros de catálogo)

El sharding no es necesario en la fase inicial, pero la arquitectura de MongoDB lo soporta cuando el volumen supere los 5–8 GB proyectados a 3 años.

---

## 6. Comparación de Sistemas Operativos Compatibles con MongoDB

| Criterio | Windows Server 2022 | Ubuntu Server 22.04 LTS (Linux) |
|---|---|---|
| Compatibilidad con MongoDB | Soporte oficial completo (Community y Enterprise) | Soporte oficial completo (Community y Enterprise) |
| Rendimiento | Adecuado; mayor consumo base de recursos por el sistema operativo (~2 GB RAM solo para el SO) | Generalmente más liviano, menor consumo en reposo (~300–500 MB RAM para el SO) |
| Facilidad de administración | Interfaz gráfica disponible; curva de aprendizaje menor para usuarios con experiencia en Windows | Administración 100% por línea de comandos; requiere familiaridad con Linux |
| Seguridad | Firewall de Windows Defender, actualizaciones vía Windows Update, mayor superficie de ataque por defecto | Menor superficie de ataque por defecto, actualizaciones vía APT, ecosistema robusto de hardening |
| Costos de licenciamiento | Requiere licencia para uso productivo (versión Evaluation gratuita por 180 días para pruebas) | Sin costo de licencia (distribución libre y de código abierto) |
| Soporte a largo plazo | Soporte hasta 2031 (mainstream) | Soporte hasta abril de 2027 (LTS) |

### Justificación de la elección

Se seleccionó **Windows Server 2022** como sistema operativo para este proyecto, considerando los siguientes factores:

1. **Familiaridad:** el equipo tiene experiencia previa administrando entornos Windows, lo que reduce el tiempo de configuración y el riesgo de errores durante la instalación.
2. **Compatibilidad garantizada:** MongoDB Community Edition 8.x tiene soporte oficial completo para Windows Server 2022, incluyendo el instalador MSI que simplifica el proceso de instalación.
3. **Entorno de virtualización:** se usará VirtualBox sobre Windows 11, donde ejecutar Windows Server 2022 como sistema invitado ofrece una integración más fluida con el sistema anfitrión.
4. **Costo en entorno académico:** se utiliza la versión de evaluación de 180 días, que es gratuita y suficiente para los objetivos de este proyecto.

La principal desventaja es el mayor consumo de recursos respecto a Ubuntu, pero dado que se asignarán 4 GB de RAM a la máquina virtual, el rendimiento es suficiente para el entorno de desarrollo y pruebas.

---

