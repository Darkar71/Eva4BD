# Avance 2 — Instalación y Configuración de MongoDB en Windows Server (VirtualBox)

**Alumno:** Diego Carvajal
**Asignatura:** Bases de Datos No Estructuradas
**Año:** 2026

---

## 1. Especificaciones Técnicas del Sistema Operativo

Se seleccionó **Windows Server 2022** como sistema operativo para la máquina virtual. Es una versión con soporte oficial vigente, compatible con MongoDB Community Edition, y su administración mediante interfaz gráfica reduce la curva de aprendizaje respecto a un servidor Linux.

### Versión del sistema operativo

| Parámetro | Descripción |
|---|---|
| Sistema operativo | Windows Server 2022 (Standard o Evaluation, 64 bits) |
| Arquitectura | x86_64 (64 bits) |
| Soporte oficial | Hasta octubre de 2031 |
| Interfaz | Interfaz gráfica (GUI) + PowerShell |
| Origen de la imagen | ISO oficial de evaluación de Microsoft Evaluation Center |

> Microsoft ofrece una versión de evaluación de Windows Server 2022 válida por 180 días, sin costo, suficiente para fines académicos.

### Recursos asignados a la máquina virtual

| Parámetro | Valor recomendado |
|---|---|
| vCPU | 2 núcleos |
| RAM | 4 GB (mínimo 2 GB) |
| Almacenamiento | 50 GB en disco virtual dinámico (VDI) |
| Tipo de disco | VDI, asignación dinámica |
| Controlador | SATA |

### Seguridad

- Cuenta de Administrador con contraseña robusta definida durante la instalación.
- Firewall de Windows Defender activo en los tres perfiles (Dominio, Privado, Público).
- Acceso a MongoDB restringido a localhost / red interna de VirtualBox; no se expone a Internet.
- Autenticación habilitada en MongoDB (usuario y contraseña obligatorios para conectarse).

### Configuración de red

| Modo de red | Uso |
|---|---|
| NAT | La VM sale a Internet a través del anfitrión; útil para descargar instaladores. No es accesible desde fuera. |
| Adaptador puente (Bridged) | La VM obtiene IP en la red del anfitrión; permite conectarse desde el equipo físico (ej. RDP). |
| Solo-anfitrión (Host-only) | Comunicación exclusiva anfitrión-VM, sin salir a Internet. |

Se recomienda **Adaptador puente** durante instalación/configuración (para descargar actualizaciones y MongoDB), y opcionalmente **Host-only** una vez finalizada la configuración.

| Servicio | Puerto | Protocolo | Origen permitido |
|---|---|---|---|
| RDP (Escritorio remoto) | 3389 | TCP | Red local del adaptador puente |
| MongoDB | 27017 | TCP | Localhost / red interna VirtualBox (no exponer a Internet) |

---

## 2. Plataforma de Virtualización

Se utilizó **Oracle VirtualBox** como plataforma de virtualización local, en lugar de un proveedor cloud como AWS. VirtualBox es una alternativa académicamente válida: permite crear un entorno aislado y reproducible sin depender de conectividad a Internet ni de costos asociados.

### Comparación de la plataforma seleccionada

| Criterio | Oracle VirtualBox (entorno local) |
|---|---|
| Compatibilidad | Soporta Windows Server 2022 como sistema invitado, con Guest Additions oficiales. |
| Rendimiento | Depende del hardware del anfitrión; suficiente con 4 GB de RAM asignados. |
| Costos | Sin costo: VirtualBox y Windows Server Evaluation son gratuitos. |
| Facilidad de implementación | No requiere cuenta cloud, tarjeta de crédito ni red pública. |
| Persistencia | El estado de la VM se mantiene en el disco del equipo anfitrión. |

### Requisitos previos en el equipo anfitrión

- Virtualización habilitada en BIOS/UEFI (Intel VT-x o AMD-V).
- Oracle VirtualBox instalado (versión 7.x) + Extension Pack.
- Espacio libre en disco de al menos 60 GB.
- ISO de Windows Server 2022 descargado previamente.

---

## 3. Configuración de la Máquina Virtual

### Pasos para crear la máquina virtual

1. Abrir Oracle VirtualBox → clic en **Nueva**.
2. Nombre: `WindowsServer-MongoDB`. Tipo: Microsoft Windows. Versión: Windows Server 2022 (64-bit).
3. Asignar memoria RAM: **4096 MB**.
4. Crear disco duro virtual ahora, tipo **VDI**, asignación dinámica, **50 GB**.
5. En Configuración → Sistema → Procesador, asignar **2 CPU**.
6. En Configuración → Almacenamiento, montar la ISO de Windows Server 2022 en la unidad óptica virtual.
7. En Configuración → Red, seleccionar el adaptador (NAT o Puente).
8. Guardar la configuración e **Iniciar** la máquina virtual.

(imagenes![alt text](img/Captura%20de%20pantalla%202026-06-16%20175453.png)
(imagenes![alt text](img/Captura%20de%20pantalla%202026-06-16%20180017.png)
![alt text](img/Captura%20de%20pantalla%202026-06-16%20180150.png)


---

## 4. Instalación del Sistema Operativo

### 4.1 Instalación de Windows Server 2022 (Server Core)

1. Iniciar la VM; arranca desde la ISO montada.
2. Seleccionar idioma, formato de hora y teclado → Siguiente.
3. Clic en **Instalar ahora**.
4. Seleccionar la edición **Windows Server 2022 Standard (sin Desktop Experience)**, es decir, **Server Core**.
5. Aceptar términos de licencia.
6. Tipo de instalación: **Personalizada: instalar solo Windows**.
7. Seleccionar el disco virtual creado; el sistema instala y reinicia automáticamente.
8. Definir la contraseña de la cuenta **Administrador** en el primer inicio (se hace desde la consola azul de configuración inicial).

![alt text](<img/Captura de pantalla 2026-06-16 180809.png>)
![alt text](img/image-1.png)
![alt text](img/image.png)

Server Core no tiene escritorio ni explorador de archivos. Toda la administración se realiza desde la consola de comandos (cmd) o PowerShell, que aparece automáticamente al iniciar sesión.



### 4.2-3 Ajustes iniciales del sistema

Cambio de hostname:

```powershell
Rename-Computer -NewName "MONGODB-SERVER" -Restart
```

![alt text](img/image3.png)

Verificación de actualizaciones (en Server Core, vía PowerShell):

```powershell
Install-Module PSWindowsUpdate -Force
Get-WindowsUpdate
Install-WindowsUpdate -AcceptAll -AutoReboot
```

![alt text](img/image4.png)

### 4.4 Configuración del Firewall de Windows

```powershell

Get-NetFirewallProfile | Select-Object Name, Enabled


New-NetFirewallRule -DisplayName "MongoDB-LAN" -Direction Inbound `
  -Protocol TCP -LocalPort 27017 -RemoteAddress LocalSubnet -Action Allow
```

![alt text](img/image5.png)

### 4.5 Cuentas de usuario del sistema operativo

```powershell
$pass = Read-Host -AsSecureString "Contraseña"
New-LocalUser "adminProyecto" -Password $pass `
  -FullName "Administrador del Proyecto" -Description "Cuenta de gestión del servidor"
Add-LocalGroupMember -Group "Administradores" -Member "adminProyecto"
Get-LocalUser
```

![alt text](img/image6.png)

### 4.6 Servicios innecesarios

```powershell
Get-Service Fax, PrintNotify -ErrorAction SilentlyContinue | Stop-Service -Force
Get-Service Fax, PrintNotify -ErrorAction SilentlyContinue | Set-Service -StartupType Disabled
```

---

## 5. Instalación de MongoDB

Como Server Core no tiene navegador ni interfaz gráfica, MongoDB se descarga e instala completamente por PowerShell.

### 5.1 Descarga e instalación por consola

```powershell

Invoke-WebRequest -Uri "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.14-signed.msi" -OutFile "C:\mongodb-installer.msi"


Start-Process msiexec.exe -ArgumentList '/i C:\mongodb-installer.msi /quiet /norestart ADDLOCAL="ServerService"' -Wait


Get-ChildItem "C:\Program Files\MongoDB\Server\7.0\bin"
```

![alt text](img/image7.png)



### 5.2 Verificación del servicio

```powershell
Get-Service -Name MongoDB


Start-Service MongoDB
```

![alt text](img/image8.png)

### 5.3 Conexión con mongosh

```powershell

Invoke-WebRequest -Uri "https://downloads.mongodb.com/compass/mongosh-2.2.7-win32-x64.zip" -OutFile "C:\mongosh.zip"
Expand-Archive -Path "C:\mongosh.zip" -DestinationPath "C:\mongosh"

C:\mongosh\mongosh-2.2.7-win32-x64\bin\mongosh.exe

db.version()
show dbs
```

![alt text](img/image9.png)
![alt text](img/image10.png)

### 5.4 Creación de usuarios y roles

```javascript

use admin
db.createUser({
  user: "adminTotal",
  pwd: "CAMBIAR_ESTA_CLAVE",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
})


use proyectoDB
db.createUser({
  user: "usuarioDB",
  pwd: "CAMBIAR_ESTA_CLAVE",
  roles: [ { role: "readWrite", db: "proyectoDB" } ]
})


db.createUser({
  user: "usuarioLectura",
  pwd: "CAMBIAR_ESTA_CLAVE",
  roles: [ { role: "read", db: "proyectoDB" } ]
})
```



![alt text](img/image11.png)
![alt text](img/image12.png)
![alt text](img/image13.png)
![alt text](img/image14.png)

### 5.5 Habilitar autenticación

Por defecto, MongoDB se instala sin control de acceso habilitado, lo que significa que cualquier proceso con acceso a la red del servidor podría leer o escribir datos sin autenticarse. Para corregir esto, se habilitó la autenticación en el archivo de configuración `mongod.cfg`.

Ubicación del archivo en Windows:

```
C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg
```

Editar el archivo y agregar (o modificar) la sección `security`:

```yaml
security:
  authorization: enabled
```

Guardar el archivo y reiniciar el servicio para aplicar el cambio:

```powershell
notepad "C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg"

Restart-Service MongoDB
```

A partir de este punto, cualquier conexión a `mongosh` sin usuario y contraseña es rechazada, incluso desde localhost. Esto corresponde directamente a la recomendación de habilitar control de acceso del **CIS MongoDB Benchmark**, en su categoría de Autenticación.

> 📷 *[INSERTAR IMAGEN — mongod.cfg con `security: authorization: enabled`]*
> 📷 *[INSERTAR IMAGEN — mongosh exigiendo autenticación al conectar sin credenciales]*

### 5.6 Política de acceso (resumen)

Se definieron tres niveles de acceso siguiendo el principio de mínimo privilegio, de forma que cada cuenta solo tenga los permisos estrictamente necesarios para su función:

| Usuario | Rol asignado | Alcance | Qué puede hacer | Qué NO puede hacer |
|---|---|---|---|---|
| **adminTotal** | `userAdminAnyDatabase`, `readWriteAnyDatabase` en `admin` | Todo el servidor | Crear/eliminar usuarios y bases de datos, leer y escribir en cualquier colección, tareas de mantenimiento | No debe usarse para operación diaria de la aplicación |
| **usuarioDB** | `readWrite` en `proyectoDB` | Solo `proyectoDB` | Insertar, leer, actualizar y eliminar documentos dentro de esa base de datos | No puede crear usuarios, no puede acceder a otras bases de datos, no puede modificar configuración del servidor |
| **usuarioLectura** | `read` en `proyectoDB` | Solo `proyectoDB` | Consultar documentos (lectura) | No puede insertar, modificar ni eliminar datos; no puede crear usuarios |

Reglas adicionales de la política de acceso:

- Las contraseñas reales no se suben al repositorio de GitHub; en el código se documentan los roles y comandos usando el marcador `CAMBIAR_ESTA_CLAVE`.
- El puerto 27017 de MongoDB no se expone fuera de la red interna de la VM (regla de firewall `MongoDB-LAN`, solo subred local).
- El acceso administrativo (`adminTotal`) se reserva exclusivamente para tareas de gestión del servidor, nunca para que la aplicación se conecte con él.
- Cada conexión queda registrada en el log de MongoDB, lo que permite auditar qué usuario realizó cada operación (ver sección 6.2).

---

## 6. Hardening del S.O. y Base de Datos

El hardening aplicado en este avance sigue como referencia el **CIS MongoDB Benchmark**, guía de configuración segura desarrollada por el Center for Internet Security (CIS) mediante un proceso de consenso entre expertos. Este benchmark organiza sus recomendaciones en categorías como instalación y parches, autenticación, control de acceso, cifrado de datos, auditoría y hardening del sistema operativo, lo que coincide directamente con los puntos solicitados en este avance (cifrado, auditoría, copias de respaldo). Para esta máquina se utilizaron como referencia los controles de la categoría de cifrado y auditoría del benchmark, adaptados a MongoDB 7.x corriendo sobre Windows Server 2022.

### 6.1 Cifrado

**Cifrado en tránsito (TLS/SSL):**

Aunque en este entorno de laboratorio MongoDB solo acepta conexiones desde la red local (no expuesto a Internet), el CIS Benchmark recomienda habilitar TLS para cifrar el tráfico entre el cliente y el servidor. Esto se documenta como medida prevista para el entorno de producción, agregando al `mongod.cfg`:

```yaml
net:
  tls:
    mode: requireTLS
    certificateKeyFile: C:\Program Files\MongoDB\Server\7.0\ssl\mongodb.pem
```

**Cifrado en reposo:**

El motor de almacenamiento WiredTiger de MongoDB soporta cifrado de los archivos de datos en disco mediante una clave maestra y un keyfile local, de forma que los datos solo se leen en texto claro en memoria durante su uso, sin estar nunca expuestos en disco. Para habilitarlo se agrega:

```yaml
security:
  enableEncryption: true
  encryptionKeyFile: C:\mongodb-keys\mongodb-keyfile
```

> 📷 *[INSERTAR IMAGEN — sección `security` del mongod.cfg con la configuración de cifrado]*

### 6.2 Auditoría

El CIS Benchmark recomienda habilitar el registro de auditoría para tener trazabilidad de quién accede a qué datos y qué operaciones realiza. Se activó el módulo de auditoría de MongoDB agregando al `mongod.cfg`:

```yaml
auditLog:
  destination: file
  path: C:\Program Files\MongoDB\Server\7.0\log\audit.json
  format: JSON
```

```powershell
Restart-Service MongoDB

Get-Content "C:\Program Files\MongoDB\Server\7.0\log\audit.json" -Tail 20
```

Adicionalmente, se revisó el log estándar del servicio para verificar intentos de conexión fallidos:

```powershell
Get-Content "C:\Program Files\MongoDB\Server\7.0\log\mongod.log" -Tail 30
```

> 📷 *[INSERTAR IMAGEN — archivo audit.json con eventos de conexión/autenticación registrados]*

### 6.3 Copias de Respaldo

Se configuraron respaldos de la base de datos utilizando `mongodump`, herramienta oficial de MongoDB recomendada por el CIS Benchmark para garantizar la recuperación ante incidentes:

```powershell
New-Item -ItemType Directory -Path "C:\backups\mongodb" -Force

& "C:\Program Files\MongoDB\Server\7.0\bin\mongodump.exe" `
  --username adminTotal --authenticationDatabase admin `
  --db proyectoDB --out "C:\backups\mongodb\backup_$(Get-Date -Format yyyyMMdd)"

Get-ChildItem "C:\backups\mongodb"
```

Para automatizar el respaldo diario, se programó una tarea con el Programador de Tareas de Windows:

```powershell
$action = New-ScheduledTaskAction -Execute "C:\Program Files\MongoDB\Server\7.0\bin\mongodump.exe" `
  -Argument '--username adminTotal --authenticationDatabase admin --db proyectoDB --out C:\backups\mongodb\auto'
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "BackupMongoDB" -Action $action -Trigger $trigger
```

> 📷 *[INSERTAR IMAGEN — carpeta de respaldo generada por mongodump]*
> 📷 *[INSERTAR IMAGEN — tarea programada `BackupMongoDB` en el Programador de Tareas]*

### 6.4 Resumen de controles aplicados (referencia CIS MongoDB Benchmark)

| Categoría CIS | Control aplicado | Estado |
|---|---|---|
| Autenticación | `authorization: enabled` en mongod.cfg | ✅ Aplicado |
| Control de acceso | Roles diferenciados (admin, lectura/escritura, solo lectura) | ✅ Aplicado |
| Cifrado de datos | Configuración de cifrado en reposo (keyfile) y TLS para tránsito | ✅ Documentado |
| Auditoría | Módulo `auditLog` habilitado en formato JSON | ✅ Aplicado |
| Copias de respaldo | `mongodump` programado con tarea diaria | ✅ Aplicado |
| Hardening del S.O. | Firewall con reglas específicas, servicios innecesarios deshabilitados | ✅ Aplicado |

---

## 7. Documentación

### Resumen de lo realizado en este avance

| N° | Procedimiento |
|---|---|
| 1 | Selección de Windows Server 2022 como S.O. |
| 2 | Selección de Oracle VirtualBox como plataforma de virtualización |
| 3 | Creación y configuración de la máquina virtual (CPU, RAM, disco, red) |
| 4 | Instalación de Windows Server 2022 y Guest Additions |
| 5 | Ajustes iniciales: hostname, actualizaciones, firewall, usuario local |
| 6 | Instalación de MongoDB 7.x Community Edition como servicio |
| 7 | Verificación del servicio y conexión con mongosh |
| 8 | Creación de usuarios con tres niveles de rol |
| 9 | Habilitación de autenticación obligatoria en mongod.cfg |
| 10 | Definición de política de acceso por rol (mínimo privilegio) |
| 11 | Hardening: cifrado (TLS y en reposo) según CIS MongoDB Benchmark |
| 12 | Hardening: auditoría con módulo `auditLog` |
| 13 | Hardening: copias de respaldo con `mongodump` y tarea programada |

### Herramientas utilizadas

| Herramienta | Uso |
|---|---|
| Oracle VirtualBox | Plataforma de virtualización para alojar el servidor |
| Windows Server 2022 | Sistema operativo del servidor |
| MongoDB 7.x Community | Motor de base de datos NoSQL |
| mongosh | Consola interactiva de MongoDB |
| mongodump | Respaldo de bases de datos |
| PowerShell | Administración del sistema operativo |
| CIS MongoDB Benchmark | Guía de referencia para hardening de seguridad |
| GitHub | Repositorio para versionar y entregar el proyecto |

### Conclusión

Durante este avance se completó la instalación de Windows Server 2022 en VirtualBox, la instalación de MongoDB como servicio, la creación de usuarios con roles diferenciados y la aplicación de medidas de hardening (cifrado, auditoría y respaldos) basadas en el CIS MongoDB Benchmark. El servidor queda en condiciones de avanzar al siguiente paso del proyecto: el modelado de la base de datos y la implementación de las colecciones.
