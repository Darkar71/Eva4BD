/**
 * app.js — Lógica del frontend de ComercioTech
 * Módulos: UI, Dashboard, Clientes, Productos, Pedidos
 */
'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   AUTH — Sesión y control de acceso por rol
   Roles: 'admin' (adminTotal) | 'editor' (usuarioDB) | 'lectura' (usuarioLectura)
══════════════════════════════════════════════════════════════════════════ */
let ROL = null;
let USUARIO = null;

const Auth = {
  puedeEscribir()  { return ROL === 'admin' || ROL === 'editor'; },
  puedeEliminar()  { return ROL === 'admin'; },

  async verificar() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) { window.location.href = '/login.html'; return false; }
      const data = await res.json();
      ROL = data.rol;
      USUARIO = data.nombre;
      this.aplicarUI();
      return true;
    } catch (e) {
      window.location.href = '/login.html';
      return false;
    }
  },

  aplicarUI() {
    document.getElementById('topbar-user').textContent =
      `${USUARIO} · ${({admin:'Administrador', editor:'Editor', lectura:'Solo lectura'})[ROL] || ROL}`;
    document.getElementById('topbar-avatar').textContent =
      USUARIO.slice(0, 2).toUpperCase();

    // Oculta cualquier botón marcado como data-requiere="editor" si el rol es solo lectura
    document.querySelectorAll('[data-requiere="editor"]').forEach(el => {
      el.style.display = this.puedeEscribir() ? '' : 'none';
    });
  },

  async logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); }
    finally { window.location.href = '/login.html'; }
  },
};

/* ══════════════════════════════════════════════════════════════════════════
   UI — Helpers de interfaz
══════════════════════════════════════════════════════════════════════════ */
const UI = {
  toast(mensaje, tipo = 'success') {
    const el = document.getElementById('toast');
    el.textContent = mensaje;
    el.className = `toast ${tipo}`;
    clearTimeout(this._t);
    this._t = setTimeout(() => el.className = 'toast hidden', 3500);
  },
  abrirModal(id)  { document.getElementById(id).classList.remove('hidden'); },
  cerrarModal(id) { document.getElementById(id).classList.add('hidden'); },
  precio(n) { return '$' + Number(n).toLocaleString('es-CL'); },
  badgeEstado(estado) {
    const icons = { pendiente:'🕐', en_proceso:'⚙️', enviado:'🚚', entregado:'✅', cancelado:'❌' };
    return `<span class="badge badge-${estado}">${icons[estado]||''} ${estado.replace('_',' ')}</span>`;
  },
  setTabla(id, html) { document.getElementById(id).innerHTML = html; },
};

/* ══════════════════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════════════════ */
let chartPedidos = null;
let chartEstados = null;

const Dashboard = {
  async cargar() {
    try {
      const [resC, resP, resPed] = await Promise.all([
        fetch('/api/clientes'), fetch('/api/productos'), fetch('/api/pedidos')
      ]);
      const clientes  = await resC.json();
      const productos = await resP.json();
      const pedidos   = await resPed.json();

      // KPIs
      document.getElementById('kpi-clientes').textContent  = clientes.length;
      document.getElementById('kpi-productos').textContent = productos.length;
      document.getElementById('kpi-pedidos').textContent   = pedidos.length;
      const ingresos = pedidos.reduce((s, p) => s + (p.total || 0), 0);
      document.getElementById('kpi-ingresos').textContent  = UI.precio(ingresos);

      // Gráfico de línea: pedidos por mes
      this.renderLineChart(pedidos);

      // Gráfico donut: estados
      this.renderDonutChart(pedidos);

      // Pedidos recientes (últimos 5)
      this.renderRecientes(pedidos.slice(-5).reverse());

    } catch(e) {
      console.error('Dashboard error:', e);
    }
  },

  renderLineChart(pedidos) {
    // Agrupar pedidos por mes (últimos 6 meses)
    const ahora = new Date();
    const meses = [];
    const labels = [];
    const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      labels.push(MESES[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2));
      meses.push({ year: d.getFullYear(), month: d.getMonth(), count: 0, total: 0 });
    }

    pedidos.forEach(p => {
      const f = new Date(p.fechaPedido);
      const m = meses.find(m => m.year === f.getFullYear() && m.month === f.getMonth());
      if (m) { m.count++; m.total += (p.total || 0); }
    });

    const counts = meses.map(m => m.count);

    const ctx = document.getElementById('chart-pedidos').getContext('2d');
    if (chartPedidos) chartPedidos.destroy();

    chartPedidos = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Pedidos',
          data: counts,
          borderColor: '#4f8ef7',
          backgroundColor: 'rgba(79,142,247,.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#4f8ef7',
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e2436',
            borderColor: '#2a3350',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            callbacks: {
              label: ctx => ` ${ctx.raw} pedido${ctx.raw !== 1 ? 's' : ''}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,.05)' },
            ticks: { color: '#64748b', font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,.05)' },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              stepSize: 1,
              precision: 0
            }
          }
        }
      }
    });
  },

  renderDonutChart(pedidos) {
    const estados = { pendiente:0, en_proceso:0, enviado:0, entregado:0, cancelado:0 };
    pedidos.forEach(p => { if (estados[p.estado] !== undefined) estados[p.estado]++; });

    const labels = Object.keys(estados);
    const data   = Object.values(estados);
    const colors = ['#f59e0b','#4f8ef7','#8b5cf6','#10b981','#ef4444'];

    const ctx = document.getElementById('chart-estados').getContext('2d');
    if (chartEstados) chartEstados.destroy();

    chartEstados = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e2436',
            borderColor: '#2a3350',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
          }
        }
      }
    });

    // Leyenda manual
    const leg = document.getElementById('chart-estados-legend');
    leg.innerHTML = labels.map((l, i) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span>${l.replace('_',' ')} (${data[i]})</span>
      </div>`).join('');
  },

  renderRecientes(pedidos) {
    const el = document.getElementById('recent-pedidos');
    if (!pedidos.length) { el.innerHTML = '<p class="hint">Sin pedidos aún.</p>'; return; }
    el.innerHTML = `
      <table class="recent-table">
        <thead><tr>
          <th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th>
        </tr></thead>
        <tbody>
          ${pedidos.map(p => `<tr>
            <td>${p.clienteNombre || '—'}</td>
            <td class="precio">${UI.precio(p.total)}</td>
            <td>${UI.badgeEstado(p.estado)}</td>
            <td>${p.fechaPedido ? new Date(p.fechaPedido).toLocaleDateString('es-CL') : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   CLIENTES
══════════════════════════════════════════════════════════════════════════ */
const Clientes = {
  _datos: [],

  async listar() {
    UI.setTabla('tabla-clientes', '<p class="hint">Cargando...</p>');
    try {
      const res  = await fetch('/api/clientes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this._datos = data;
      this.renderTabla(data);
    } catch(e) {
      UI.setTabla('tabla-clientes', `<p class="hint" style="color:var(--danger)">Error: ${e.message}</p>`);
    }
  },

  filtrar() {
    const q = document.getElementById('search-clientes').value.toLowerCase();
    const filtrados = this._datos.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.direccion?.ciudad || '').toLowerCase().includes(q)
    );
    this.renderTabla(filtrados);
  },

  renderTabla(data) {
    if (!data.length) { UI.setTabla('tabla-clientes', '<p class="hint">No hay clientes.</p>'); return; }
    const filas = data.map(c => {
      const acciones = [
        Auth.puedeEscribir()  ? `<button class="btn btn-sm btn-warn"   onclick="Clientes.editar('${c._id}')">✏️ Editar</button>` : '',
        Auth.puedeEliminar()  ? `<button class="btn btn-sm btn-danger" onclick="Clientes.eliminar('${c._id}','${c.nombre.replace(/'/g,"\\'")}')">🗑️</button>` : '',
      ].join('') || '<span class="hint">—</span>';
      return `<tr>
      <td class="mono">${String(c._id).slice(-8)}</td>
      <td><strong>${c.nombre}</strong></td>
      <td>${c.email}</td>
      <td>${c.telefono}</td>
      <td>${c.direccion?.ciudad || '—'}</td>
      <td>${c.activo ? '<span class="badge badge-entregado">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
      <td><div class="actions">${acciones}</div></td>
    </tr>`;
    }).join('');
    UI.setTabla('tabla-clientes', `
      <table><thead><tr>
        <th>ID</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Ciudad</th><th>Estado</th><th>Acciones</th>
      </tr></thead><tbody>${filas}</tbody></table>`);
  },

  nuevo() {
    ['cliente-id','cliente-nombre','cliente-email','cliente-telefono',
     'cliente-calle','cliente-ciudad','cliente-region'].forEach(id =>
      document.getElementById(id).value = '');
    document.getElementById('modal-cliente-titulo').textContent = 'Nuevo Cliente';
    UI.abrirModal('modal-cliente');
  },

  async editar(id) {
    try {
      const res  = await fetch(`/api/clientes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      document.getElementById('cliente-id').value       = data._id;
      document.getElementById('cliente-nombre').value    = data.nombre;
      document.getElementById('cliente-email').value     = data.email;
      document.getElementById('cliente-telefono').value  = data.telefono;
      document.getElementById('cliente-calle').value     = data.direccion?.calle    || '';
      document.getElementById('cliente-ciudad').value    = data.direccion?.ciudad   || '';
      document.getElementById('cliente-region').value    = data.direccion?.region   || '';
      document.getElementById('modal-cliente-titulo').textContent = 'Editar Cliente';
      UI.abrirModal('modal-cliente');
    } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
  },

  async guardar() {
    const id       = document.getElementById('cliente-id').value;
    const nombre   = document.getElementById('cliente-nombre').value.trim();
    const email    = document.getElementById('cliente-email').value.trim();
    const telefono = document.getElementById('cliente-telefono').value.trim();
    if (!nombre || !email || !telefono) { UI.toast('Nombre, email y teléfono son obligatorios', 'error'); return; }
    const body = {
      nombre, email, telefono,
      calle:  document.getElementById('cliente-calle').value.trim(),
      ciudad: document.getElementById('cliente-ciudad').value.trim(),
      region: document.getElementById('cliente-region').value.trim(),
    };
    try {
      const res  = await fetch(id ? `/api/clientes/${id}` : '/api/clientes', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      UI.cerrarModal('modal-cliente');
      UI.toast(id ? 'Cliente actualizado ✅' : 'Cliente creado ✅');
      this.listar();
    } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
  },

  async eliminar(id, nombre) {
    if (!confirm(`¿Eliminar a "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res  = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      UI.toast('Cliente eliminado');
      this.listar();
    } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   PRODUCTOS
══════════════════════════════════════════════════════════════════════════ */
const Productos = {
  _datos: [],

  async listar() {
    UI.setTabla('tabla-productos', '<p class="hint">Cargando...</p>');
    const cat = document.getElementById('filtro-categoria').value;
    const qs  = cat ? `?categoria=${encodeURIComponent(cat)}` : '';
    try {
      const res  = await fetch(`/api/productos${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this._datos = data;
      this.renderTabla(data);
    } catch(e) {
      UI.setTabla('tabla-productos', `<p class="hint" style="color:var(--danger)">Error: ${e.message}</p>`);
    }
  },

  filtrar() {
    const q = document.getElementById('search-productos').value.toLowerCase();
    const filtrados = this._datos.filter(p =>
      p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
    );
    this.renderTabla(filtrados);
  },

  renderTabla(data) {
    if (!data.length) { UI.setTabla('tabla-productos', '<p class="hint">No hay productos.</p>'); return; }
    const filas = data.map(p => {
      const acciones = [
        Auth.puedeEscribir()  ? `<button class="btn btn-sm btn-warn"   onclick="Productos.editar('${p._id}')">✏️ Editar</button>` : '',
        Auth.puedeEliminar()  ? `<button class="btn btn-sm btn-danger" onclick="Productos.eliminar('${p._id}','${p.nombre.replace(/'/g,"\\'")}')">🗑️</button>` : '',
      ].join('') || '<span class="hint">—</span>';
      return `<tr>
      <td class="mono">${String(p._id).slice(-8)}</td>
      <td><strong>${p.nombre}</strong></td>
      <td><span class="badge badge-cat">${p.categoria}</span></td>
      <td class="precio">${UI.precio(p.precio)}</td>
      <td>${p.stock} uds.</td>
      <td>⭐ ${p.calificacion ?? '—'}</td>
      <td><div class="actions">${acciones}</div></td>
    </tr>`;
    }).join('');
    UI.setTabla('tabla-productos', `
      <table><thead><tr>
        <th>ID</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Calif.</th><th>Acciones</th>
      </tr></thead><tbody>${filas}</tbody></table>`);
  },

  async editar(id) {
    try {
      const res  = await fetch(`/api/productos/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      document.getElementById('producto-id').value       = data._id;
      document.getElementById('producto-nombre').value    = data.nombre;
      document.getElementById('producto-categoria').value = data.categoria;
      document.getElementById('producto-precio').value    = data.precio;
      document.getElementById('producto-stock').value     = data.stock;
      document.getElementById('modal-producto-titulo').textContent = 'Editar Producto';
      UI.abrirModal('modal-producto');
    } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
  },

  async guardar() {
    const id        = document.getElementById('producto-id').value;
    const nombre    = document.getElementById('producto-nombre').value.trim();
    const categoria = document.getElementById('producto-categoria').value;
    const precio    = document.getElementById('producto-precio').value;
    const stock     = document.getElementById('producto-stock').value;
    if (!nombre || !precio || stock === '') { UI.toast('Nombre, precio y stock son obligatorios', 'error'); return; }
    try {
      const res  = await fetch(id ? `/api/productos/${id}` : '/api/productos', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, categoria, precio, stock })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      UI.cerrarModal('modal-producto');
      UI.toast(id ? 'Producto actualizado ✅' : 'Producto creado ✅');
      this.listar();
    } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
  },

  async eliminar(id, nombre) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
      const res  = await fetch(`/api/productos/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      UI.toast('Producto eliminado');
      this.listar();
    } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   PEDIDOS
══════════════════════════════════════════════════════════════════════════ */
const Pedidos = {
  _clientes: [],
  _productos: [],

  async listar() {
    UI.setTabla('tabla-pedidos', '<p class="hint">Cargando...</p>');
    const estado = document.getElementById('filtro-estado').value;
    const qs = estado ? `?estado=${encodeURIComponent(estado)}` : '';
    try {
      const res  = await fetch(`/api/pedidos${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.length) { UI.setTabla('tabla-pedidos', '<p class="hint">No hay pedidos.</p>'); return; }
      const filas = data.map(p => {
        const acciones = [
          Auth.puedeEscribir()  ? `<button class="btn btn-sm btn-warn"   onclick="Pedidos.abrirCambioEstado('${p._id}','${p.estado}')">🔄 Estado</button>` : '',
          Auth.puedeEliminar()  ? `<button class="btn btn-sm btn-danger" onclick="Pedidos.eliminar('${p._id}')">🗑️</button>` : '',
        ].join('') || '<span class="hint">—</span>';
        return `<tr>
        <td class="mono">${String(p._id).slice(-8)}</td>
        <td><strong>${p.clienteNombre}</strong></td>
        <td>${p.productos?.length ?? 0} ítem(s)</td>
        <td class="precio">${UI.precio(p.total)}</td>
        <td>${UI.badgeEstado(p.estado)}</td>
        <td>${p.metodoPago?.replace('_',' ') || '—'}</td>
        <td>${p.fechaPedido ? new Date(p.fechaPedido).toLocaleDateString('es-CL') : '—'}</td>
        <td><div class="actions">${acciones}</div></td>
      </tr>`;
      }).join('');
      UI.setTabla('tabla-pedidos', `
        <table><thead><tr>
          <th>ID</th><th>Cliente</th><th>Ítems</th><th>Total</th><th>Estado</th><th>Pago</th><th>Fecha</th><th>Acciones</th>
        </tr></thead><tbody>${filas}</tbody></table>`);
    } catch(e) {
      UI.setTabla('tabla-pedidos', `<p class="hint" style="color:var(--danger)">Error: ${e.message}</p>`);
    }
  },

  async abrirNuevo() {
    try {
      const [resC, resP] = await Promise.all([fetch('/api/clientes'), fetch('/api/productos')]);
      this._clientes  = await resC.json();
      this._productos = await resP.json();
      document.getElementById('pedido-clienteId').innerHTML =
        this._clientes.map(c => `<option value="${c._id}">${c.nombre}</option>`).join('');
      document.getElementById('pedido-productoId').innerHTML =
        this._productos.map(p => `<option value="${p._id}" data-precio="${p.precio}">${p.nombre} — ${UI.precio(p.precio)}</option>`).join('');
      this.actualizarPrecio();
      UI.abrirModal('modal-pedido');
    } catch(e) { UI.toast('Error al cargar datos: ' + e.message, 'error'); }
  },

  actualizarPrecio() {
    const sel      = document.getElementById('pedido-productoId');
    const cantidad = parseInt(document.getElementById('pedido-cantidad').value) || 1;
    const precio   = parseFloat(sel.options[sel.selectedIndex]?.dataset.precio || 0);
    document.getElementById('pedido-subtotal').value = UI.precio(precio * cantidad);
  },

  async guardar() {
    const clienteId  = document.getElementById('pedido-clienteId').value;
    const productoId = document.getElementById('pedido-productoId').value;
    const cantidad   = parseInt(document.getElementById('pedido-cantidad').value);
    const metodoPago = document.getElementById('pedido-metodoPago').value;
    const notas      = document.getElementById('pedido-notas').value.trim();
    if (!clienteId || !productoId || cantidad < 1) { UI.toast('Completa todos los campos', 'error'); return; }
    const prod = this._productos.find(p => p._id === productoId);
    if (!prod) { UI.toast('Producto no encontrado', 'error'); return; }
    try {
      const res  = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId, metodoPago, notasCliente: notas,
          productos: [{ productoId, nombre: prod.nombre, precioUnitario: prod.precio, cantidad }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      UI.cerrarModal('modal-pedido');
      UI.toast('Pedido creado ✅');
      this.listar();
      Dashboard.cargar(); // actualiza gráficos
    } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
  },

  abrirCambioEstado(id, estadoActual) {
    document.getElementById('estado-pedido-id').value = id;
    document.getElementById('estado-nuevo').value     = estadoActual;
    UI.abrirModal('modal-estado');
  },

  async cambiarEstado() {
    const id     = document.getElementById('estado-pedido-id').value;
    const estado = document.getElementById('estado-nuevo').value;
    try {
      const res  = await fetch(`/api/pedidos/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      UI.cerrarModal('modal-estado');
      UI.toast(`Estado → "${estado}" ✅`);
      this.listar();
      Dashboard.cargar();
    } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
  },

  async eliminar(id) {
    if (!confirm('¿Eliminar este pedido?')) return;
    try {
      const res  = await fetch(`/api/pedidos/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      UI.toast('Pedido eliminado');
      this.listar();
      Dashboard.cargar();
    } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   NAVEGACIÓN
══════════════════════════════════════════════════════════════════════════ */
function activarTab(tab) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  const panel = document.getElementById(`tab-${tab}`);
  if (panel) panel.classList.add('active');
  document.getElementById('page-title').textContent =
    { dashboard:'Dashboard', clientes:'Clientes', productos:'Productos', pedidos:'Pedidos' }[tab] || tab;
  if (tab === 'clientes')  Clientes.listar();
  if (tab === 'productos') Productos.listar();
  if (tab === 'pedidos')   Pedidos.listar();
  if (tab === 'dashboard') Dashboard.cargar();
}

/* ══════════════════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {

  // Verifica sesión antes de mostrar cualquier dato; redirige a /login.html si no hay sesión
  const autenticado = await Auth.verificar();
  if (!autenticado) return;

  // Fecha en topbar
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // Tabs
  document.querySelectorAll('.nav-item').forEach(btn =>
    btn.addEventListener('click', () => activarTab(btn.dataset.tab))
  );

  // Cerrar modales al hacer clic en fondo
  document.querySelectorAll('.modal').forEach(modal =>
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); })
  );

  // Carga inicial
  Dashboard.cargar();
});
