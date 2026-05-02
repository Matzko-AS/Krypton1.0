import { useState, useEffect } from "react"
import { supabase } from "../../../supabase/supabaseClient"
import { useNavigate } from "react-router-dom"
import "./diseñador.css"

const DashboardDisenador = () => {
  const [seccion, setSeccion] = useState("pedidos")
  const [pedidos, setPedidos] = useState([])
  const [disenos, setDisenos] = useState([])
  const [materiales, setMateriales] = useState([])
  const [cargando, setCargando] = useState(true)

  // Modales pedidos
  const [mostrarModal, setMostrarModal] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [pedidoEditar, setPedidoEditar] = useState(null)
  const [stockDisponible, setStockDisponible] = useState(null)

  // Modales diseños
  const [mostrarModalDiseno, setMostrarModalDiseno] = useState(false)
  const [archivoDis, setArchivoDis] = useState(null)
  const [pedidoIdDiseno, setPedidoIdDiseno] = useState("")
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const [errorSubida, setErrorSubida] = useState("")

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
    estado: "en_diseño",
    material_id: "",
  }

  const [nuevoPedido, setNuevoPedido] = useState(pedidoInicial)

  useEffect(() => {
    cargarPedidos()
    cargarMateriales()
    cargarDisenos()
  }, [])

  // ─── CARGA ──────────────────────────────────────────────────────────

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

  const cargarDisenos = async () => {
    const { data, error } = await supabase
      .from("disenos")
      .select("*, pedidos(cliente_nombre, estado)")
      .order("created_at", { ascending: false })
    if (error) {
      console.error("Error cargarDisenos:", error.message)
    } else {
      console.log("Diseños cargados:", data)
      setDisenos(data ?? [])
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    navigate("/")
  }

  // ─── PEDIDOS ────────────────────────────────────────────────────────

  const handleChangePedido = (e) => {
    const { name, value, type, checked } = e.target
    const nuevoValor = type === "checkbox" ? checked : value

    if (name === "material_id") {
      setNuevoPedido({ ...nuevoPedido, [name]: nuevoValor })
      verificarStock(nuevoValor)
      return
    }

    if (name === "cantidad") {
      setNuevoPedido({
        ...nuevoPedido,
        cantidad: value,
        descuento: parseInt(value) > 10,
      })
      return
    }

    setNuevoPedido({ ...nuevoPedido, [name]: nuevoValor })
  }

  const agregarPedido = async () => {
    if (!nuevoPedido.cliente_nombre) return

    const { data: userData } = await supabase.auth.getUser()
    const estadoFinal =
      stockDisponible && stockDisponible.stock > 0 ? "en_diseño" : "sin_material"

    const { data: pedidoCreado, error } = await supabase
      .from("pedidos")
      .insert({
        usuario_id: userData.user.id,
        ...nuevoPedido,
        cantidad: parseInt(nuevoPedido.cantidad),
        estado: estadoFinal,
      })
      .select()
      .single()

    if (error) { console.error(error.message); return }

    if (nuevoPedido.material_id && pedidoCreado) {
      await supabase.from("pedido_materiales").insert({
        pedido_id: pedidoCreado.id,
        material_id: nuevoPedido.material_id,
        cantidad: parseInt(nuevoPedido.cantidad),
      })
    }

    setMostrarModal(false)
    setNuevoPedido(pedidoInicial)
    setStockDisponible(null)
    cargarPedidos()
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

  const verificarStock = async (materialId) => {
    if (!materialId) { setStockDisponible(null); return }
    const { data } = await supabase
      .from("materiales")
      .select("stock, nombre, unidad, estado")
      .eq("id", materialId)
      .single()
    if (data) setStockDisponible(data)
  }

  // ─── DISEÑOS ────────────────────────────────────────────────────────

  const handleArchivoChange = (e) => {
    setArchivoDis(e.target.files[0] || null)
  }

  const subirDiseno = async () => {
    if (!pedidoIdDiseno || !archivoDis) return
    setSubiendoArchivo(true)
    setErrorSubida("")

    const { data: userData } = await supabase.auth.getUser()
    const extension = archivoDis.name.split(".").pop()
    // Sin subcarpeta — directo en la raíz del bucket "disenos"
    const nombreUnico = `${Date.now()}_${userData.user.id}.${extension}`

    // 1. Subir al bucket
    const { error: storageError } = await supabase.storage
      .from("disenos")
      .upload(nombreUnico, archivoDis)

    if (storageError) {
      console.error("Error storage:", storageError.message)
      setErrorSubida(`Error al subir archivo: ${storageError.message}`)
      setSubiendoArchivo(false)
      return
    }

    // 2. Obtener URL pública
    const { data: urlData } = supabase.storage
      .from("disenos")
      .getPublicUrl(nombreUnico)

    // 3. Insertar en tabla disenos
    const { error: dbError } = await supabase.from("disenos").insert({
      pedido_id: pedidoIdDiseno,
      archivo_url: urlData.publicUrl,
      hash_archivo: nombreUnico,
    })

    if (dbError) {
      console.error("Error DB:", dbError.message)
      setErrorSubida(`Error al guardar en BD: ${dbError.message}`)
    } else {
      // 4. Actualizar estado del pedido
      await supabase
        .from("pedidos")
        .update({ estado: "en_diseño" })
        .eq("id", pedidoIdDiseno)

      setMostrarModalDiseno(false)
      setPedidoIdDiseno("")
      setArchivoDis(null)
      setErrorSubida("")
      cargarDisenos()
      cargarPedidos()
    }

    setSubiendoArchivo(false)
  }

  const aprobarDiseno = async (diseno) => {
    await supabase
      .from("pedidos")
      .update({ estado: "aprobado" })
      .eq("id", diseno.pedido_id)
    cargarDisenos()
    cargarPedidos()
  }

  const rechazarDiseno = async (diseno) => {
    const confirmar = window.confirm("¿Rechazar este diseño? El pedido volverá a en_diseño.")
    if (!confirmar) return
    await supabase
      .from("pedidos")
      .update({ estado: "en_diseño" })
      .eq("id", diseno.pedido_id)
    cargarDisenos()
    cargarPedidos()
  }

  // ─── HELPERS ────────────────────────────────────────────────────────

  const colorEstado = (estado) => {
    const colores = {
      pendiente: "#f59e0b",
      "en_diseño": "#4f6ef7",
      aprobado: "#22c55e",
      en_impresion: "#8b5cf6",
      sin_material: "#ef4444",
      terminado: "#64748b",
    }
    return colores[estado] || "#ffffff"
  }

  const colorPrioridad = (prioridad) => {
    const colores = { alta: "#ef4444", media: "#f59e0b", baja: "#22c55e" }
    return colores[prioridad] || "#ffffff"
  }

  // ─── RENDER ─────────────────────────────────────────────────────────

  return (
    <div className="dashboard">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>KRYPTON</h2>
          <span>Diseño</span>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${seccion === "pedidos" ? "active" : ""}`}
            onClick={() => setSeccion("pedidos")}
          >
            Pedidos
          </button>
          <button
            className={`nav-item ${seccion === "disenos" ? "active" : ""}`}
            onClick={() => setSeccion("disenos")}
          >
            Diseños
          </button>
        </nav>
        <button className="sidebar-logout" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>{seccion === "pedidos" ? "Pedidos" : "Diseños"}</h1>
          {seccion === "pedidos" && (
            <button className="btn-nuevo" onClick={() => setMostrarModal(true)}>
              + Nuevo Pedido
            </button>
          )}
          {seccion === "disenos" && (
            <button className="btn-nuevo" onClick={() => setMostrarModalDiseno(true)}>
              + Subir Diseño
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
                            <button className="btn-accion" onClick={() => abrirEditar(pedido)}>
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN DISEÑOS */}
          {seccion === "disenos" && (
            <div className="seccion">
              {disenos.length === 0 ? (
                <p className="texto-secondary">No hay diseños subidos aún.</p>
              ) : (
                <div className="tabla-wrapper">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Estado del pedido</th>
                        <th>Fecha</th>
                        <th>Archivo</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disenos.map((d) => (
                        <tr key={d.id}>
                          <td>{d.pedidos?.cliente_nombre || "—"}</td>
                          <td>
                            <span
                              className="badge"
                              style={{ background: colorEstado(d.pedidos?.estado) }}
                            >
                              {d.pedidos?.estado || "—"}
                            </span>
                          </td>
                          <td>{new Date(d.created_at).toLocaleDateString("es-EC")}</td>
                          <td>
                            <a
                              href={d.archivo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-accion"
                            >
                              Ver archivo
                            </a>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              {d.pedidos?.estado === "en_diseño" && (
                                <>
                                  <button
                                    className="btn-accion"
                                    onClick={() => aprobarDiseno(d)}
                                  >
                                    Aprobar
                                  </button>
                                  <button
                                    className="btn-eliminar"
                                    onClick={() => rechazarDiseno(d)}
                                  >
                                    Rechazar
                                  </button>
                                </>
                              )}
                              {d.pedidos?.estado === "aprobado" && (
                                <span style={{ fontSize: "12px", color: "#22c55e" }}>✅ Aprobado</span>
                              )}
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

      {/* ── MODAL NUEVO PEDIDO ────────────────────────────────────── */}
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

              <div className="modal-field modal-field-full">
                <label>Material</label>
                <select
                  name="material_id"
                  value={nuevoPedido.material_id || ""}
                  onChange={handleChangePedido}
                >
                  <option value="">Seleccionar material...</option>
                  {materiales.map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.nombre} {mat.subtipo ? `(${mat.subtipo})` : ""} — Stock: {mat.stock} {mat.unidad}
                    </option>
                  ))}
                </select>
                {stockDisponible && stockDisponible.stock > 0 && (
                  <span style={{ fontSize: "12px", color: "#22c55e", marginTop: "4px" }}>
                    ✅ Stock disponible: {stockDisponible.stock} {stockDisponible.unidad}
                  </span>
                )}
                {stockDisponible && stockDisponible.stock === 0 && (
                  <span style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
                    ⚠️ Sin stock. El pedido se registrará como "sin_material"
                  </span>
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
              <button
                onClick={() => { setMostrarModal(false); setNuevoPedido(pedidoInicial); setStockDisponible(null) }}
                className="btn-cancelar"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR PEDIDO ───────────────────────────────────── */}
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
              <button
                onClick={() => { setModalEditar(false); setPedidoEditar(null) }}
                className="btn-cancelar"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SUBIR DISEÑO ────────────────────────────────────── */}
      {mostrarModalDiseno && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Subir Diseño</h3>
            <div className="modal-grid">

              <div className="modal-field modal-field-full">
                <label>Pedido asociado</label>
                <select
                  value={pedidoIdDiseno}
                  onChange={(e) => setPedidoIdDiseno(e.target.value)}
                >
                  <option value="">Seleccionar pedido...</option>
                  {pedidos
                    .filter((p) => ["pendiente", "en_diseño", "sin_material"].includes(p.estado))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.cliente_nombre} — {p.estado}
                      </option>
                    ))}
                </select>
              </div>

              <div className="modal-field modal-field-full">
                <label>Archivo del diseño</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,.ai,.psd,.svg"
                  onChange={handleArchivoChange}
                  className="input-file"
                />
                {archivoDis && (
                  <span style={{ fontSize: "12px", color: "#22c55e", marginTop: "4px" }}>
                    ✅ {archivoDis.name}
                  </span>
                )}
              </div>

            </div>
            {errorSubida && (
              <p style={{ fontSize: "12px", color: "#ef4444", marginBottom: "12px" }}>
                ⚠️ {errorSubida}
              </p>
            )}
            <div className="modal-buttons">
              <button
                onClick={subirDiseno}
                className="btn-guardar"
                disabled={subiendoArchivo || !pedidoIdDiseno || !archivoDis}
              >
                {subiendoArchivo ? "Subiendo..." : "Subir diseño"}
              </button>
              <button
                onClick={() => {
                  setMostrarModalDiseno(false)
                  setPedidoIdDiseno("")
                  setArchivoDis(null)
                  setErrorSubida("")
                }}
                className="btn-cancelar"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default DashboardDisenador
