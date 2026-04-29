import { useState, useEffect } from "react"
import { supabase } from "../../../supabase/supabaseClient"
import { useNavigate } from "react-router-dom"
import "./empleado.css"

const DashboardEmpleado = () => {
  const [seccion, setSeccion] = useState("pedidos")
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarModal, setMostrarModal] = useState(false)
  const navigate = useNavigate()

  const pedidoInicial = {
    cliente_nombre: "",
    cliente_contacto: "",
    cantidad: 1,
    descuento: false,
    prioridad: "media",
    fecha_entrega: "",
    especificaciones: "",
    perfil_impresion: "",
    configuracion: "",
    estado: "pendiente",
  }

  const [nuevoPedido, setNuevoPedido] = useState(pedidoInicial)

  useEffect(() => {
    cargarPedidos()
  }, [])

  const cargarPedidos = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .order("created_at", { ascending: false })
    if (!error) setPedidos(data)
    setCargando(false)
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    navigate("/")
  }

  const handleChangePedido = (e) => {
    const { name, value, type, checked } = e.target
    const nuevoValor = type === "checkbox" ? checked : value

    // Descuento automático si cantidad > 10
    if (name === "cantidad") {
      setNuevoPedido({
        ...nuevoPedido,
        cantidad: value,
        descuento: parseInt(value) > 10
      })
      return
    }

    setNuevoPedido({ ...nuevoPedido, [name]: nuevoValor })
  }

  const agregarPedido = async () => {
    if (!nuevoPedido.cliente_nombre) return

    const { data: userData } = await supabase.auth.getUser()

    const { error } = await supabase
      .from("pedidos")
      .insert({
        usuario_id: userData.user.id,
        ...nuevoPedido,
        cantidad: parseInt(nuevoPedido.cantidad)
      })

    if (!error) {
      setMostrarModal(false)
      setNuevoPedido(pedidoInicial)
      cargarPedidos()
    } else {
      console.error(error.message)
    }
  }

  const colorEstado = (estado) => {
    const colores = {
      pendiente: "#f59e0b",
      en_diseño: "#4f6ef7",
      aprobado: "#22c55e",
      en_impresion: "#8b5cf6",
      sin_material: "#ef4444",
      terminado: "#64748b",
    }
    return colores[estado] || "#ffffff"
  }

  const colorPrioridad = (prioridad) => {
    const colores = {
      alta: "#ef4444",
      media: "#f59e0b",
      baja: "#22c55e",
    }
    return colores[prioridad] || "#ffffff"
  }

  return (
    <div className="dashboard">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>KRYPTON</h2>
          <span>Taller</span>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${seccion === "pedidos" ? "active" : ""}`}
            onClick={() => setSeccion("pedidos")}
          >
            Pedidos
          </button>
          <button
            className={`nav-item ${seccion === "materiales" ? "active" : ""}`}
            onClick={() => setSeccion("materiales")}
          >
            Materiales
          </button>
        </nav>
        <button className="sidebar-logout" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>{seccion === "pedidos" ? "Pedidos" : "Materiales"}</h1>
          {seccion === "pedidos" && (
            <button className="btn-nuevo" onClick={() => setMostrarModal(true)}>
              + Nuevo Pedido
            </button>
          )}
        </header>

        <div className="dashboard-content">

          {/* SECCIÓN PEDIDOS */}
          {seccion === "pedidos" && (
            <div className="seccion">
              {cargando ? (
                <p className="texto-secondary">Cargando pedidos...</p>
              ) : pedidos.length === 0 ? (
                <p className="texto-secondary">No hay pedidos registrados aún.</p>
              ) : (
                <div className="tabla-wrapper">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Contacto</th>
                        <th>Estado</th>
                        <th>Prioridad</th>
                        <th>Cantidad</th>
                        <th>Descuento</th>
                        <th>Perfil</th>
                        <th>Configuración</th>
                        <th>Entrega</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidos.map((pedido) => (
                        <tr key={pedido.id}>
                          <td>{pedido.cliente_nombre || "—"}</td>
                          <td>{pedido.cliente_contacto || "—"}</td>
                          <td>
                            <span className="badge" style={{ background: colorEstado(pedido.estado) }}>
                              {pedido.estado}
                            </span>
                          </td>
                          <td>
                            <span className="badge" style={{ background: colorPrioridad(pedido.prioridad) }}>
                              {pedido.prioridad}
                            </span>
                          </td>
                          <td>{pedido.cantidad}</td>
                          <td>{pedido.descuento ? "✅ Sí" : "—"}</td>
                          <td>{pedido.perfil_impresion || "—"}</td>
                          <td>{pedido.configuracion || "—"}</td>
                          <td>{pedido.fecha_entrega || "—"}</td>
                          <td>
                            <button className="btn-accion">Editar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN MATERIALES */}
          {seccion === "materiales" && (
            <p className="texto-secondary">Sección de materiales próximamente...</p>
          )}

        </div>
      </main>

      {/* MODAL NUEVO PEDIDO */}
      {mostrarModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Nuevo Pedido</h3>

            <div className="modal-grid">
              <div className="modal-field">
                <label>Nombre del cliente</label>
                <input
                  type="text"
                  name="cliente_nombre"
                  placeholder="Ej: Juan Pérez"
                  value={nuevoPedido.cliente_nombre}
                  onChange={handleChangePedido}
                />
              </div>

              <div className="modal-field">
                <label>Contacto</label>
                <input
                  type="text"
                  name="cliente_contacto"
                  placeholder="Teléfono o correo"
                  value={nuevoPedido.cliente_contacto}
                  onChange={handleChangePedido}
                />
              </div>

              <div className="modal-field">
                <label>Cantidad</label>
                <input
                  type="number"
                  name="cantidad"
                  min="1"
                  value={nuevoPedido.cantidad}
                  onChange={handleChangePedido}
                />
                {nuevoPedido.descuento && (
                  <span className="descuento-aviso">✅ Aplica descuento por volumen</span>
                )}
              </div>

              <div className="modal-field">
                <label>Prioridad</label>
                <select name="prioridad" value={nuevoPedido.prioridad} onChange={handleChangePedido}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Perfil de impresión</label>
                <input
                  type="text"
                  name="perfil_impresion"
                  placeholder="Ej: CMYK, RGB..."
                  value={nuevoPedido.perfil_impresion}
                  onChange={handleChangePedido}
                />
              </div>

              <div className="modal-field">
                <label>Configuración</label>
                <select name="configuracion" value={nuevoPedido.configuracion} onChange={handleChangePedido}>
                  <option value="">Seleccionar...</option>
                  <option value="BIDI">BIDI</option>
                  <option value="ONE WAY">ONE WAY</option>
                  <option value="otra">Otra</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Fecha de entrega</label>
                <input
                  type="date"
                  name="fecha_entrega"
                  value={nuevoPedido.fecha_entrega}
                  onChange={handleChangePedido}
                />
              </div>

              <div className="modal-field modal-field-full">
                <label>Especificaciones</label>
                <textarea
                  name="especificaciones"
                  placeholder="Detalles del trabajo..."
                  value={nuevoPedido.especificaciones}
                  onChange={handleChangePedido}
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-buttons">
              <button onClick={agregarPedido} className="btn-guardar">Guardar</button>
              <button onClick={() => { setMostrarModal(false); setNuevoPedido(pedidoInicial) }} className="btn-cancelar">Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default DashboardEmpleado