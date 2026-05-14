import { useState, useEffect } from "react"
import { supabase } from "../../../supabase/supabaseClient"
import { useNavigate } from "react-router-dom"
import Calculadora from "../diseñador/calculadora/Calculadora"
import Contabilidad from "../contabilidad/contabilidad"
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
  const [stockDisponible, setStockDisponible] = useState(null)
  const [usuario, setUsuario] = useState(null)

  // ── NUEVO: modal ver pedido ──────────────────────────────────────────────
  const [modalVerPedido, setModalVerPedido] = useState(false)
  const [pedidoVer, setPedidoVer] = useState(null)

  // ── NUEVO: procesando (deshabilita botones durante operaciones async) ────
  const [procesando, setProcesando] = useState(false)
  const [esLetreroEditar, setEsLetreroEditar] = useState(false)

  const materialInicial = {
    nombre: "",
    tipo_material: "",
    subtipo: "",
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
    material_id: "",
    esLetrero: false,
    letrero_tipo: "",
    letrero_alto: "",
    letrero_largo: "",
  }

  const [nuevoPedido, setNuevoPedido] = useState(pedidoInicial)

  useEffect(() => {
    cargarPedidos()
    cargarMateriales()
    supabase.auth.getUser().then(({ data }) => setUsuario(data?.user))
  }, [])

  // ── MODIFICADO: solo aprobado / en_impresion + join disenos ────────────
  const cargarPedidos = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from("pedidos")
      .select("*, disenos(*)")
      .in("estado", ["en_impresion"])
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

  const cambiarsesion = async()=>{
    await supabase.auth.signOut()
    navigate("/login")
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    navigate("/")
  }

  const handleChangePedido = (e) => {
    const { name, value, type, checked } = e.target
    const nuevoValor = type === "checkbox" ? checked : value

    if (name === "esLetrero") {
      setNuevoPedido({
        ...nuevoPedido,
        esLetrero: checked,
        material_id: checked ? "" : nuevoPedido.material_id,
        letrero_tipo: checked ? nuevoPedido.letrero_tipo : "",
        letrero_alto: checked ? nuevoPedido.letrero_alto : "",
        letrero_largo: checked ? nuevoPedido.letrero_largo : "",
      })
      setStockDisponible(null)
      return
    }

    if (name === "material_id") {
      setNuevoPedido({ ...nuevoPedido, [name]: nuevoValor })
      verificarStock(nuevoValor)
      return
    }

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

    const estadoFinal = stockDisponible && stockDisponible.stock > 0
      ? "pendiente"
      : "sin_material"

    const { data: pedidoCreado, error } = await supabase
      .from("pedidos")
      .insert({
        usuario_id: userData.user.id,
        ...nuevoPedido,
        cantidad: parseInt(nuevoPedido.cantidad),
        estado: estadoFinal,
        material_id: nuevoPedido.esLetrero ? null : (nuevoPedido.material_id || null),
        letrero_tipo: nuevoPedido.esLetrero ? nuevoPedido.letrero_tipo : null,
        letrero_alto: nuevoPedido.esLetrero ? parseFloat(nuevoPedido.letrero_alto) || null : null,
        letrero_largo: nuevoPedido.esLetrero ? parseFloat(nuevoPedido.letrero_largo) || null : null,
        esLetrero: undefined,
      })
      .select()
      .single()

    if (error) {
      console.error(error.message)
      return
    }

    if (nuevoPedido.material_id && pedidoCreado) {
      await supabase
        .from("pedido_materiales")
        .insert({
          pedido_id: pedidoCreado.id,
          material_id: nuevoPedido.material_id,
          cantidad: parseInt(nuevoPedido.cantidad)
        })
    }

    setMostrarModal(false)
    setNuevoPedido(pedidoInicial)
    setStockDisponible(null)
    cargarPedidos()
  }

  const abrirEditar = (pedido) => {
    setPedidoEditar({ ...pedido })
    setEsLetreroEditar(!!(pedido.letrero_tipo))
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
        letrero_tipo: pedidoEditar.letrero_tipo || null,
        letrero_alto: pedidoEditar.letrero_alto ? parseFloat(pedidoEditar.letrero_alto) : null,
        letrero_largo: pedidoEditar.letrero_largo ? parseFloat(pedidoEditar.letrero_largo) : null,
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

  // ── MODIFICADO: limpia bucket + disenos antes de eliminar ───────────────
  const eliminarPedido = async (pedido) => {
    const confirmar = window.confirm("¿Estás seguro de que quieres eliminar este pedido?")
    if (!confirmar) return

    setProcesando(true)
    try {
      const disenos = pedido.disenos || []

      // 1. Eliminar archivos físicos del bucket
      for (const diseno of disenos) {
        if (diseno.hash_archivo) {
          await supabase.storage.from("disenos").remove([diseno.hash_archivo])
        }
      }

      // 2. Eliminar registros de disenos vinculados
      if (disenos.length > 0) {
        await supabase.from("disenos").delete().eq("pedido_id", pedido.id)
      }

      // 3. Eliminar el pedido
      const { error } = await supabase.from("pedidos").delete().eq("id", pedido.id)
      if (error) throw error

      cargarPedidos()
    } catch (e) {
      console.error("Error al eliminar pedido:", e.message)
      alert("Ocurrió un error al eliminar el pedido.")
    } finally {
      setProcesando(false)
    }
  }

  // ── NUEVO: finalizar pedido ──────────────────────────────────────────────
  const finalizarPedido = async (pedido) => {
    const confirmar = window.confirm(
      `¿Finalizar el pedido de "${pedido.cliente_nombre}"?\n\nEsto eliminará el archivo de diseño del storage y ocultará el pedido de esta vista.`
    )
    if (!confirmar) return

    setProcesando(true)
    try {
      const disenos = pedido.disenos || []

      // 1. Eliminar archivos físicos del bucket usando hash_archivo
      for (const diseno of disenos) {
        if (diseno.hash_archivo) {
          const { error: errStorage } = await supabase.storage
            .from("disenos")
            .remove([diseno.hash_archivo])
          if (errStorage) {
            console.warn("No se pudo eliminar archivo del bucket:", errStorage.message)
          }
        }
      }

      // 2. Nullificar archivo_url (conserva el registro histórico en disenos)
      if (disenos.length > 0) {
        const { error: errDiseno } = await supabase
          .from("disenos")
          .update({ archivo_url: null })
          .eq("pedido_id", pedido.id)
        if (errDiseno) throw errDiseno
      }

      // 3. Cambiar estado a "terminado" (se oculta de esta vista)
      const { error: errPedido } = await supabase
        .from("pedidos")
        .update({ estado: "terminado" })
        .eq("id", pedido.id)
      if (errPedido) throw errPedido

      // 4. Registrar en historial
      await supabase.from("historial").insert({
        pedido_id: pedido.id,
        accion: "terminado",
        descripcion: "Pedido terminado por empleado. Archivos de diseño eliminados del bucket.",
      })

      cargarPedidos()
    } catch (e) {
      console.error("Error al finalizar pedido:", e.message)
      alert("Ocurrió un error al finalizar el pedido.")
    } finally {
      setProcesando(false)
    }
  }

  const handleChangeMaterial = (e) => {
    const { name, value } = e.target

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
        subtipo: materialEditar.subtipo || null,
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

    const { error } = await supabase.from("materiales").delete().eq("id", id)
    if (!error) {
      cargarMateriales()
    } else {
      console.error(error.message)
    }
  }

  const verificarStock = async (materialId) => {
    if (!materialId) {
      setStockDisponible(null)
      return
    }
    const { data } = await supabase
      .from("materiales")
      .select("stock, nombre, unidad, estado")
      .eq("id", materialId)
      .single()

    if (data) setStockDisponible(data)
  }

  const colorEstado = (estado) => {
    const colores = {
      pendiente: "#f59e0b",
      en_diseño: "#4f6ef7",
      aprobado: "#22c55e",
      en_impresion: "#f97316",
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
          <button
            className={`nav-item ${seccion === "calculadora" ? "active" : ""}`}
            onClick={() => setSeccion("calculadora")}
          >
            Calculadora
          </button>
          <button
            className={`nav-item ${seccion === "contabilidad" ? "active" : ""}`}
            onClick={() => setSeccion("contabilidad")}
          >
          Contabilidad
          </button>
        </nav>
        <button className="sidebar-logout" onClick={cambiarsesion}>
          Cambiar sesión
          </button>       
        <button className="sidebar-logout" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>
            {seccion === "pedidos" ? "Pedidos en Producción" : seccion === "materiales" ? "Materiales" : seccion === "contabilidad" ? "Contabilidad" : "Calculadora" }
            </h1>
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
                <p className="texto-secondary">No hay pedidos aprobados o en producción.</p>
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
                        <th>Perfil</th>
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
                          <td>{pedido.perfil_impresion || "—"}</td>
                          <td>{pedido.fecha_entrega || "—"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              {/* NUEVO: Ver */}
                              <button
                                className="btn-accion"
                                onClick={() => { setPedidoVer(pedido); setModalVerPedido(true) }}
                              >
                                Ver
                              </button>
                              <button className="btn-accion" onClick={() => abrirEditar(pedido)}>
                                Editar
                              </button>
                              <button
                                className="btn-eliminar"
                                disabled={procesando}
                                onClick={() => eliminarPedido(pedido)}
                              >
                                Eliminar
                              </button>
                              {/* NUEVO: Finalizar */}
                              <button
                                className="btn-finalizar"
                                disabled={procesando}
                                onClick={() => finalizarPedido(pedido)}
                              >
                                ✓ Finalizar
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
                        <th>Tipo Laminacion</th>
                        <th>Estado</th>
                        <th>Opciones</th>
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
                          <td>{mat.subtipo || "—"}</td>
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

          {/* SECCIÓN CALCULADORA */}
          {seccion === "calculadora" && <Calculadora />}
          {seccion === "contabilidad" && <Contabilidad usuario={usuario}/>}

        </div>
      </main>

      {/* ── NUEVO: MODAL VER PEDIDO COMPLETO ────────────────────────────────── */}
      {modalVerPedido && pedidoVer && (
        <div className="modal-overlay" onClick={() => setModalVerPedido(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Pedido — {pedidoVer.cliente_nombre}</h3>

            <div className="modal-grid">
              <div className="modal-field">
                <label>Estado</label>
                <span className="badge" style={{ background: colorEstado(pedidoVer.estado), display: "inline-block" }}>
                  {pedidoVer.estado}
                </span>
              </div>
              <div className="modal-field">
                <label>Prioridad</label>
                <span className="badge" style={{ background: colorPrioridad(pedidoVer.prioridad), display: "inline-block" }}>
                  {pedidoVer.prioridad}
                </span>
              </div>
              <div className="modal-field">
                <label>Contacto</label>
                <p>{pedidoVer.cliente_contacto || "—"}</p>
              </div>
              <div className="modal-field">
                <label>Cantidad</label>
                <p>{pedidoVer.cantidad}{pedidoVer.descuento ? " ✅ (con descuento)" : ""}</p>
              </div>
              <div className="modal-field">
                <label>Perfil de impresión</label>
                <p>{pedidoVer.perfil_impresion || "—"}</p>
              </div>
              <div className="modal-field">
                <label>Configuración</label>
                <p>{pedidoVer.configuracion || "—"}</p>
              </div>
              <div className="modal-field">
                <label>Fecha de entrega</label>
                <p>{pedidoVer.fecha_entrega || "—"}</p>
              </div>
              <div className="modal-field">
                <label>Fecha de creación</label>
                <p>{new Date(pedidoVer.created_at).toLocaleDateString("es-EC")}</p>
              </div>

              {/* Letrero */}
              {pedidoVer.letrero_tipo && (
                <>
                  <div className="modal-field">
                    <label>Tipo de letrero</label>
                    <p>{pedidoVer.letrero_tipo}</p>
                  </div>
                  <div className="modal-field">
                    <label>Dimensiones</label>
                    <p>{pedidoVer.letrero_alto ?? "?"} × {pedidoVer.letrero_largo ?? "?"} cm</p>
                  </div>
                </>
              )}

              {/* Precio total */}
              {pedidoVer.precio_total != null && (
                <div className="modal-field">
                  <label>Precio total</label>
                  <p style={{ color: "#22c55e", fontWeight: 700, fontSize: "16px" }}>
                    ${Number(pedidoVer.precio_total).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Especificaciones */}
              {pedidoVer.especificaciones && (
                <div className="modal-field modal-field-full">
                  <label>Especificaciones</label>
                  <p style={{ whiteSpace: "pre-wrap" }}>{pedidoVer.especificaciones}</p>
                </div>
              )}

              {/* Diseño */}
              {pedidoVer.disenos && pedidoVer.disenos.length > 0 && (
                <div className="modal-field modal-field-full">
                  <label>Diseño</label>
                  {pedidoVer.disenos.map((d) => (
                    <div key={d.id} style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge" style={{
                        background:
                          d.estado === "aprobado" ? "#22c55e" :
                          d.estado === "rechazado" ? "#ef4444" : "#4f6ef7",
                        display: "inline-block"
                      }}>
                        {d.estado}
                      </span>
                      {d.archivo_url ? (
                        <a href={d.archivo_url} target="_blank" rel="noreferrer"
                          style={{ color: "#4f6ef7", fontSize: "13px" }}>
                          Ver archivo ↗
                        </a>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: "13px" }}>Sin archivo / ya eliminado</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-buttons">
              <button onClick={() => setModalVerPedido(false)} className="btn-cancelar">Cerrar</button>
            </div>
          </div>
        </div>
      )}

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

              <div className="modal-field modal-field-full">
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    name="esLetrero"
                    checked={nuevoPedido.esLetrero}
                    onChange={handleChangePedido}
                  />
                  ¿Es letrero?
                </label>
              </div>

              {!nuevoPedido.esLetrero && (
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
                    ⚠️ Sin stock disponible. El pedido se registrará como "sin_material"
                  </span>
                )}
              </div>
              )}

              {nuevoPedido.esLetrero && (
              <>
                <div className="modal-field">
                  <label>Tipo de letrero</label>
                  <select name="letrero_tipo" value={nuevoPedido.letrero_tipo} onChange={handleChangePedido}>
                    <option value="">Seleccionar...</option>
                    <option value="luminoso">Luminoso</option>
                    <option value="no_luminoso">No luminoso</option>
                    <option value="backlight">Backlight</option>
                    <option value="acrilico">Acrílico</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="modal-field">
                  <label>Alto (cm)</label>
                  <input type="number" name="letrero_alto" min="0" placeholder="ej: 60"
                    value={nuevoPedido.letrero_alto} onChange={handleChangePedido} />
                </div>
                <div className="modal-field">
                  <label>Largo (cm)</label>
                  <input type="number" name="letrero_largo" min="0" placeholder="ej: 120"
                    value={nuevoPedido.letrero_largo} onChange={handleChangePedido} />
                </div>
              </>
              )}

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
                  <option value="terminado">terminado</option>
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

              <div className="modal-field modal-field-full">
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={esLetreroEditar}
                    onChange={(e) => {
                      setEsLetreroEditar(e.target.checked)
                      if (!e.target.checked) {
                        setPedidoEditar({ ...pedidoEditar, letrero_tipo: "", letrero_alto: "", letrero_largo: "" })
                      }
                    }}
                  />
                  ¿Es letrero?
                </label>
              </div>

              {esLetreroEditar && (
              <>
                <div className="modal-field">
                  <label>Tipo de letrero</label>
                  <select name="letrero_tipo" value={pedidoEditar.letrero_tipo || ""} onChange={handleChangeEditar}>
                    <option value="">Seleccionar...</option>
                    <option value="luminoso">Luminoso</option>
                    <option value="no_luminoso">No luminoso</option>
                    <option value="backlight">Backlight</option>
                    <option value="acrilico">Acrílico</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="modal-field">
                  <label>Alto (cm)</label>
                  <input type="number" name="letrero_alto" min="0"
                    value={pedidoEditar.letrero_alto || ""} onChange={handleChangeEditar} />
                </div>
                <div className="modal-field">
                  <label>Largo (cm)</label>
                  <input type="number" name="letrero_largo" min="0"
                    value={pedidoEditar.letrero_largo || ""} onChange={handleChangeEditar} />
                </div>
              </>
              )}

            </div>

            <div className="modal-buttons">
              <button onClick={guardarEdicion} className="btn-guardar">Guardar cambios</button>
              <button onClick={() => { setModalEditar(false); setPedidoEditar(null); setEsLetreroEditar(false) }} className="btn-cancelar">
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
                  placeholder="Ej: Lona"
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

              {(nuevoMaterial.tipo_material === "pvc" ||
                nuevoMaterial.tipo_material === "acrilico") && (
                <div className="modal-field">
                  <label>Grosor (mm)</label>
                  <select name="grosor" value={nuevoMaterial.grosor} onChange={handleChangeMaterial}>
                    <option value="">Seleccionar...</option>
                    <option value="2">2 mm</option>
                    <option value="3">3 mm</option>
                    {nuevoMaterial.tipo_material === "pvc" && <option value="4">4 mm</option>}
                  </select>
                </div>
              )}

              {(nuevoMaterial.tipo_material === "lona" ||
                nuevoMaterial.tipo_material === "lona_translucida" ||
                nuevoMaterial.tipo_material === "vinil" ||
                nuevoMaterial.tipo_material === "laminacion") && (
                <div className="modal-field">
                  <label>Rollos disponibles</label>
                  <input type="number" name="stock" min="0" placeholder="Cantidad"
                    value={nuevoMaterial.stock} onChange={handleChangeMaterial} />
                </div>
              )}

              {(nuevoMaterial.tipo_material === "pvc" ||
                nuevoMaterial.tipo_material === "acrilico") && (
                <div className="modal-field">
                  <label>Planchas disponibles</label>
                  <input type="number" name="stock" min="0" placeholder="Cantidad"
                    value={nuevoMaterial.stock} onChange={handleChangeMaterial} />
                </div>
              )}

              {(nuevoMaterial.tipo_material === "vinil" ||
                nuevoMaterial.tipo_material === "laminacion") && (
                <div className="modal-field">
                  <label>Subtipo</label>
                  <select name="subtipo" value={nuevoMaterial.subtipo || ""} onChange={handleChangeMaterial}>
                    <option value="">Seleccionar...</option>
                    <option value="brillo">Brillo</option>
                    <option value="mate">Mate</option>
                  </select>
                </div>
              )}

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
                <input type="text" name="nombre" value={materialEditar.nombre}
                  onChange={handleChangeEditarMaterial} />
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
                <input type="number" name="ancho" value={materialEditar.ancho || ""}
                  onChange={handleChangeEditarMaterial} />
              </div>

              <div className="modal-field">
                <label>Largo</label>
                <input type="number" name="largo" value={materialEditar.largo || ""}
                  onChange={handleChangeEditarMaterial} />
              </div>

              <div className="modal-field">
                <label>Grosor (mm)</label>
                <input type="number" name="grosor" value={materialEditar.grosor || ""}
                  onChange={handleChangeEditarMaterial} />
              </div>

              <div className="modal-field">
                <label>Stock</label>
                <input type="number" name="stock" min="0" value={materialEditar.stock}
                  onChange={handleChangeEditarMaterial} />
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

            {(materialEditar.tipo_material === "vinil" ||
              materialEditar.tipo_material === "laminacion") && (
              <div className="modal-field">
                <label>Subtipo</label>
                <select name="subtipo" value={materialEditar.subtipo || ""} onChange={handleChangeEditarMaterial}>
                  <option value="">Seleccionar...</option>
                  <option value="brillo">Brillo</option>
                  <option value="mate">Mate</option>
                </select>
              </div>
            )}

            <div className="modal-buttons">
              <button onClick={guardarEdicionMaterial} className="btn-guardar">Guardar cambios</button>
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
