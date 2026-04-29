import { useState, useEffect } from "react"
import { supabase } from "../../../supabase/supabaseClient"
import { useNavigate } from "react-router-dom"
import "./empleado.css"

const DashboardEmpleado = () => {
  const [seccion, setSeccion] = useState("pedidos")
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [pedidoEditar, setPedidoEditar] = useState(null)
  const navigate = useNavigate()
  const [materiales, setMateriales] = useState([])
  const [mostrarModalMaterial, setMostrarModalMaterial] = useState(false)
  const [modalEditarMaterial, setModalEditarMaterial] = useState(false)
  const [materialEditar, setMaterialEditar] = useState(null)

  const materialInicial = {
  nombre: "",
  tipo_material: "",
  tipo: "",
  ancho: "",
  largo: "",
  grosor: "",
  stock: "",
  unidad: "metros",
  estado: "disponible"
}

const [nuevoMaterial, setNuevoMaterial] = useState(materialInicial)

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
    cargarMateriales()
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
  const cargarMateriales = async () => {
  const { data, error } = await supabase
    .from("materiales")
    .select("*")
    .order("created_at", { ascending: false })
  if (!error) setMateriales(data)
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

  const abrirEditar = (pedido) => {
  setPedidoEditar({ ...pedido })
  setModalEditar(true)
}

const handleChangeEditar = (e) => {
  const { name, value } = e.target
  setPedidoEditar({ ...pedidoEditar, [name]: value })
}

const guardarEdicion = async () => {
  const { error } = await supabase
    .from("pedidos")
    .update({
      estado: pedidoEditar.estado,
      prioridad: pedidoEditar.prioridad,
      fecha_entrega: pedidoEditar.fecha_entrega,
      especificaciones: pedidoEditar.especificaciones,
      perfil_impresion: pedidoEditar.perfil_impresion,
      configuracion: pedidoEditar.configuracion,
      cliente_contacto: pedidoEditar.cliente_contacto,
      cantidad: parseInt(pedidoEditar.cantidad),
      descuento: parseInt(pedidoEditar.cantidad) > 10,
    })
    .eq("id", pedidoEditar.id)

  if (!error) {
    setModalEditar(false)
    setPedidoEditar(null)
    cargarPedidos()
  } else {
    console.error(error.message)
  }
}
const eliminarPedido = async (id) => {
  const confirmar = window.confirm("¿Estás seguro de que quieres eliminar este pedido?")
  if (!confirmar) return

  const { error } = await supabase
    .from("pedidos")
    .delete()
    .eq("id", id)

  if (!error) {
    cargarPedidos()
  } else {
    console.error(error.message)
  }
}
const handleChangeMaterial = (e) => {
  const { name, value } = e.target

  // Cuando cambia el tipo_material, ajusta valores por defecto
  if (name === "tipo_material") {
    let defaults = {}
    if (value === "lona" || value === "vinil" || value === "laminacion") {
      defaults = { largo: 50, unidad: "metros" }
    } else if (value === "pvc" || value === "acrilico") {
      defaults = { largo: 200, ancho: 150, unidad: "cm" }
    }
    setNuevoMaterial({ ...nuevoMaterial, [name]: value, ...defaults })
    return
  }

  setNuevoMaterial({ ...nuevoMaterial, [name]: value })
}

const agregarMaterial = async () => {
  if (!nuevoMaterial.nombre || !nuevoMaterial.tipo_material || !nuevoMaterial.stock) return

  const { error } = await supabase
    .from("materiales")
    .insert({
      ...nuevoMaterial,
      stock: parseFloat(nuevoMaterial.stock),
      ancho: nuevoMaterial.ancho ? parseFloat(nuevoMaterial.ancho) : null,
      largo: nuevoMaterial.largo ? parseFloat(nuevoMaterial.largo) : null,
      grosor: nuevoMaterial.grosor ? parseFloat(nuevoMaterial.grosor) : null,
    })

  if (!error) {
    setMostrarModalMaterial(false)
    setNuevoMaterial(materialInicial)
    cargarMateriales()
  } else {
    console.error(error.message)
  }
}
const abrirEditarMaterial = (material) => {
  setMaterialEditar({ ...material })
  setModalEditarMaterial(true)
}

const handleChangeEditarMaterial = (e) => {
  const { name, value } = e.target
  setMaterialEditar({ ...materialEditar, [name]: value })
}

const guardarEdicionMaterial = async () => {
  const { error } = await supabase
    .from("materiales")
    .update({
      nombre: materialEditar.nombre,
      tipo_material: materialEditar.tipo_material,
      ancho: materialEditar.ancho ? parseFloat(materialEditar.ancho) : null,
      largo: materialEditar.largo ? parseFloat(materialEditar.largo) : null,
      grosor: materialEditar.grosor ? parseFloat(materialEditar.grosor) : null,
      stock: parseFloat(materialEditar.stock),
      unidad: materialEditar.unidad,
      estado: materialEditar.estado,
    })
    .eq("id", materialEditar.id)

  if (!error) {
    setModalEditarMaterial(false)
    setMaterialEditar(null)
    cargarMateriales()
  } else {
    console.error(error.message)
  }
}

const eliminarMaterial = async (id) => {
  const confirmar = window.confirm("¿Estás seguro de que quieres eliminar este material?")
  if (!confirmar) return

  const { error } = await supabase
    .from("materiales")
    .delete()
    .eq("id", id)

  if (!error) {
    cargarMateriales()
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
            {seccion === "materiales" && (
              <button className="btn-nuevo" onClick={() => setMostrarModalMaterial(true)}>
                 + Nuevo Material
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
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button className="btn-accion" onClick={() => abrirEditar(pedido)}>
                                Editar
                              </button>
                              <button className="btn-eliminar" onClick={() => eliminarPedido(pedido.id)}>
                                Eliminar
                              </button>
                            </div>
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
  <div className="seccion">
    {materiales.length === 0 ? (
      <p className="texto-secondary">No hay materiales registrados aún.</p>
    ) : (
      <div className="tabla-wrapper">
        <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Ancho</th>
                <th>Largo</th>
                <th>Grosor</th>
                <th>Stock</th>
                <th>Unidad</th>
                <th>Estado</th>
                <th>Acciones</th> 
              </tr>
            </thead>
          <tbody>
            {materiales.map((mat) => (
              <tr key={mat.id}>
                <td>{mat.nombre}</td>
                <td>{mat.tipo_material}</td>
                <td>{mat.ancho ? `${mat.ancho} cm` : "—"}</td>
                <td>{mat.largo ? `${mat.largo} m` : "—"}</td>
                <td>{mat.grosor ? `${mat.grosor} mm` : "—"}</td>
                <td>{mat.stock}</td>
                <td>{mat.unidad}</td>
                <td>
                  <span className="badge" style={{
                    background:
                      mat.estado === "disponible" ? "#22c55e" :
                      mat.estado === "bajo_stock" ? "#f59e0b" : "#ef4444"
                  }}>
                    {mat.estado}
                  </span>
                </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn-accion" onClick={() => abrirEditarMaterial(mat)}>
                          Editar
                        </button>
                        <button className="btn-eliminar" onClick={() => eliminarMaterial(mat.id)}>
                          Eliminar
                        </button>
                     </div>
                    </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
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
      {/* MODAL EDITAR PEDIDO */}
{modalEditar && pedidoEditar && (
  <div className="modal-overlay">
    <div className="modal">
      <h3>Editar Pedido — {pedidoEditar.cliente_nombre}</h3>

      <div className="modal-grid">
        <div className="modal-field">
          <label>Estado</label>
          <select name="estado" value={pedidoEditar.estado} onChange={handleChangeEditar}>
            <option value="pendiente">Pendiente</option>
            <option value="en_diseño">En diseño</option>
            <option value="aprobado">Aprobado</option>
            <option value="en_impresion">En impresión</option>
            <option value="sin_material">Sin material</option>
            <option value="terminado">Terminado</option>
          </select>
        </div>

        <div className="modal-field">
          <label>Prioridad</label>
          <select name="prioridad" value={pedidoEditar.prioridad} onChange={handleChangeEditar}>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </select>
        </div>

        <div className="modal-field">
          <label>Contacto cliente</label>
          <input
            type="text"
            name="cliente_contacto"
            value={pedidoEditar.cliente_contacto || ""}
            onChange={handleChangeEditar}
          />
        </div>

        <div className="modal-field">
          <label>Cantidad</label>
          <input
            type="number"
            name="cantidad"
            min="1"
            value={pedidoEditar.cantidad || 1}
            onChange={handleChangeEditar}
          />
          {parseInt(pedidoEditar.cantidad) > 10 && (
            <span className="descuento-aviso">✅ Aplica descuento por volumen</span>
          )}
        </div>

        <div className="modal-field">
          <label>Perfil de impresión</label>
          <input
            type="text"
            name="perfil_impresion"
            value={pedidoEditar.perfil_impresion || ""}
            onChange={handleChangeEditar}
          />
        </div>

        <div className="modal-field">
          <label>Configuración</label>
          <select name="configuracion" value={pedidoEditar.configuracion || ""} onChange={handleChangeEditar}>
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
            value={pedidoEditar.fecha_entrega || ""}
            onChange={handleChangeEditar}
          />
        </div>

        <div className="modal-field modal-field-full">
          <label>Especificaciones</label>
          <textarea
            name="especificaciones"
            value={pedidoEditar.especificaciones || ""}
            onChange={handleChangeEditar}
            rows={3}
          />
        </div>
      </div>

      <div className="modal-buttons">
        <button onClick={guardarEdicion} className="btn-guardar">Guardar cambios</button>
        <button onClick={() => { setModalEditar(false); setPedidoEditar(null) }} className="btn-cancelar">
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
{/* MODAL NUEVO MATERIAL */}
{mostrarModalMaterial && (
  <div className="modal-overlay">
    <div className="modal">
      <h3>Nuevo Material</h3>

      <div className="modal-grid">
        <div className="modal-field">
          <label>Nombre</label>
          <input
            type="text"
            name="nombre"
            placeholder="Ej: Lona 160cm"
            value={nuevoMaterial.nombre}
            onChange={handleChangeMaterial}
          />
        </div>

        <div className="modal-field">
          <label>Tipo de material</label>
          <select name="tipo_material" value={nuevoMaterial.tipo_material} onChange={handleChangeMaterial}>
            <option value="">Seleccionar...</option>
            <option value="lona">Lona</option>
            <option value="lona_translucida">Lona Translúcida</option>
            <option value="vinil">Vinil</option>
            <option value="pvc">PVC</option>
            <option value="acrilico">Acrílico</option>
            <option value="laminacion">Laminación</option>
          </select>
        </div>

        {/* Ancho — según tipo */}
        {(nuevoMaterial.tipo_material === "lona" ||
          nuevoMaterial.tipo_material === "lona_translucida" ||
          nuevoMaterial.tipo_material === "vinil" ||
          nuevoMaterial.tipo_material === "laminacion") && (
          <div className="modal-field">
            <label>Ancho (cm)</label>
            <select name="ancho" value={nuevoMaterial.ancho} onChange={handleChangeMaterial}>
              <option value="">Seleccionar...</option>
              {nuevoMaterial.tipo_material === "vinil" || nuevoMaterial.tipo_material === "laminacion" ? (
                <option value="152">152 cm</option>
              ) : (
                <>
                  <option value="85">85 cm</option>
                  <option value="110">110 cm</option>
                  <option value="160">160 cm</option>
                </>
              )}
            </select>
          </div>
        )}

        {/* Grosor — solo PVC y acrílico */}
        {(nuevoMaterial.tipo_material === "pvc" ||
          nuevoMaterial.tipo_material === "acrilico") && (
          <div className="modal-field">
            <label>Grosor (mm)</label>
            <select name="grosor" value={nuevoMaterial.grosor} onChange={handleChangeMaterial}>
              <option value="">Seleccionar...</option>
              <option value="2">2 mm</option>
              <option value="3">3 mm</option>
              {nuevoMaterial.tipo_material === "pvc" && (
                <option value="4">4 mm</option>
              )}
            </select>
          </div>
        )}

        <div className="modal-field">
          <label>Rollos disponibles</label>
          <input
            type="number"
            name="stock"
            min="0"
            placeholder="Cantidad"
            value={nuevoMaterial.stock}
            onChange={handleChangeMaterial}
          />
        </div>

        <div className="modal-field">
          <label>Unidad</label>
          <select name="unidad" value={nuevoMaterial.unidad} onChange={handleChangeMaterial}>
            <option value="metros">Metros</option>
            <option value="unidades">Unidades</option>
            <option value="cm">Centímetros</option>
          </select>
        </div>

        <div className="modal-field">
          <label>Estado</label>
          <select name="estado" value={nuevoMaterial.estado} onChange={handleChangeMaterial}>
            <option value="disponible">Disponible</option>
            <option value="bajo_stock">Bajo stock</option>
            <option value="agotado">Agotado</option>
          </select>
        </div>
      </div>

      <div className="modal-buttons">
        <button onClick={agregarMaterial} className="btn-guardar">Guardar</button>
        <button onClick={() => { setMostrarModalMaterial(false); setNuevoMaterial(materialInicial) }} className="btn-cancelar">
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}

{/* MODAL EDITAR MATERIAL */}
{modalEditarMaterial && materialEditar && (
  <div className="modal-overlay">
    <div className="modal">
      <h3>Editar Material — {materialEditar.nombre}</h3>

      <div className="modal-grid">
        <div className="modal-field">
          <label>Nombre</label>
          <input
            type="text"
            name="nombre"
            value={materialEditar.nombre}
            onChange={handleChangeEditarMaterial}
          />
        </div>

        <div className="modal-field">
          <label>Tipo de material</label>
          <select name="tipo_material" value={materialEditar.tipo_material} onChange={handleChangeEditarMaterial}>
            <option value="lona">Lona</option>
            <option value="lona_translucida">Lona Translúcida</option>
            <option value="vinil">Vinil</option>
            <option value="pvc">PVC</option>
            <option value="acrilico">Acrílico</option>
            <option value="laminacion">Laminación</option>
          </select>
        </div>

        <div className="modal-field">
          <label>Ancho (cm)</label>
          <input
            type="number"
            name="ancho"
            value={materialEditar.ancho || ""}
            onChange={handleChangeEditarMaterial}
          />
        </div>

        <div className="modal-field">
          <label>Largo</label>
          <input
            type="number"
            name="largo"
            value={materialEditar.largo || ""}
            onChange={handleChangeEditarMaterial}
          />
        </div>

        <div className="modal-field">
          <label>Grosor (mm)</label>
          <input
            type="number"
            name="grosor"
            value={materialEditar.grosor || ""}
            onChange={handleChangeEditarMaterial}
          />
        </div>

        <div className="modal-field">
          <label>Stock</label>
          <input
            type="number"
            name="stock"
            min="0"
            value={materialEditar.stock}
            onChange={handleChangeEditarMaterial}
          />
        </div>

        <div className="modal-field">
          <label>Unidad</label>
          <select name="unidad" value={materialEditar.unidad} onChange={handleChangeEditarMaterial}>
            <option value="metros">Metros</option>
            <option value="unidades">Unidades</option>
            <option value="cm">Centímetros</option>
          </select>
        </div>

        <div className="modal-field">
          <label>Estado</label>
          <select name="estado" value={materialEditar.estado} onChange={handleChangeEditarMaterial}>
            <option value="disponible">Disponible</option>
            <option value="bajo_stock">Bajo stock</option>
            <option value="agotado">Agotado</option>
          </select>
        </div>
      </div>

      <div className="modal-buttons">
        <button onClick={guardarEdicionMaterial} className="btn-guardar">
          Guardar cambios
        </button>
        <button onClick={() => { setModalEditarMaterial(false); setMaterialEditar(null) }} className="btn-cancelar">
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}


    </div>
  )
}

export default DashboardEmpleado