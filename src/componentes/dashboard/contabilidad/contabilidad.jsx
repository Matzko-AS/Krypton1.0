import { useState, useEffect, useMemo } from "react"
import { supabase } from "../../../supabase/supabaseClient"
import "./contabilidad.css"

const hoyISO = () => new Date().toISOString().split("T")[0]

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  })

const fmtNumero = (n) => `FACT-${String(n).padStart(6, "0")}`

const detalleVacio = () => ({
  _key: Date.now() + Math.random(),
  descripcion: "",
  cantidad: 1,
  precio_unitario: "",
})

const Contabilidad = ({ usuario }) => {
  // ── Registros ─────────────────────────────────────────────────────
  const [registros, setRegistros]       = useState([])
  const [facturasMapa, setFacturasMapa] = useState({})
  const [fechaVista, setFechaVista]     = useState(hoyISO())
  const [cargando, setCargando]         = useState(false)

  // ── Formulario ────────────────────────────────────────────────────
  const [tipo, setTipo]                         = useState("venta")
  const [tipoCliente, setTipoCliente]           = useState("CONSUMIDOR FINAL")
  const [clienteNombre, setClienteNombre]       = useState("Consumidor Final")
  const [clienteContacto, setClienteContacto]   = useState("")
  const [clienteCedula, setClienteCedula]       = useState("")
  const [clienteDireccion, setClienteDireccion] = useState("")
  const [detalle, setDetalle]                   = useState([detalleVacio()])
  const [guardando, setGuardando]               = useState(false)
  const [error, setError]                       = useState("")

  // ── Modal ─────────────────────────────────────────────────────────
  const [modalVer, setModalVer]           = useState(false)
  const [facturaVer, setFacturaVer]       = useState(null)
  const [detalleVer, setDetalleVer]       = useState([])
  const [cargandoModal, setCargandoModal] = useState(false)

  // ── Carga ─────────────────────────────────────────────────────────
  const cargarRegistros = async () => {
    setCargando(true)
    const { data: regs, error: errRegs } = await supabase
      .from("contabilidad")
      .select(`id, tipo, descripcion, monto, fecha, created_at, usuario_id, usuarios ( nombre )`)
      .eq("fecha", fechaVista)
      .order("created_at", { ascending: false })

    if (errRegs || !regs) { setCargando(false); return }
    setRegistros(regs)

    const ids = regs.map((r) => r.id)
    if (ids.length > 0) {
      const { data: facts } = await supabase
        .from("facturas")
        .select("id, numero, cliente_nombre, cliente_contacto, cliente_cedula, cliente_direccion, tipo_cliente, subtotal, total, fecha, contabilidad_id")
        .in("contabilidad_id", ids)
      const mapa = {}
      ;(facts || []).forEach((f) => { mapa[f.contabilidad_id] = f })
      setFacturasMapa(mapa)
    } else {
      setFacturasMapa({})
    }
    setCargando(false)
  }

  useEffect(() => { cargarRegistros() }, [fechaVista])

  // ── Totales ───────────────────────────────────────────────────────
  const totales = useMemo(() => {
    const ventas = registros.filter((r) => r.tipo === "venta").reduce((s, r) => s + Number(r.monto), 0)
    const gastos = registros.filter((r) => r.tipo === "gasto").reduce((s, r) => s + Number(r.monto), 0)
    return { ventas, gastos, neta: ventas - gastos }
  }, [registros])

  // ── Detalle helpers ───────────────────────────────────────────────
  const actualizarDetalle = (key, campo, valor) =>
    setDetalle((prev) => prev.map((d) => (d._key === key ? { ...d, [campo]: valor } : d)))
  const agregarFila = () => setDetalle((prev) => [...prev, detalleVacio()])
  const eliminarFila = (key) =>
    setDetalle((prev) => (prev.length > 1 ? prev.filter((d) => d._key !== key) : prev))

  const detalleValido = useMemo(
    () => detalle.filter((d) => d.descripcion.trim() && parseFloat(d.cantidad) > 0 && parseFloat(d.precio_unitario) >= 0),
    [detalle]
  )
  const subtotalDetalle = useMemo(
    () => detalleValido.reduce((s, d) => s + parseFloat(d.cantidad) * parseFloat(d.precio_unitario), 0),
    [detalleValido]
  )

  // ── Generar número ────────────────────────────────────────────────
  const generarNumero = async () => {
    const { data } = await supabase.from("facturas").select("numero").order("numero", { ascending: false }).limit(1)
    if (!data || data.length === 0) return 1
    return Number(data[0].numero) + 1
  }

  // ── Cambiar tipo cliente ──────────────────────────────────────────
  const cambiarTipoCliente = (t) => {
    setTipoCliente(t)
    if (t === "CONSUMIDOR FINAL") {
      setClienteNombre("Consumidor Final")
      setClienteContacto("")
      setClienteCedula("")
      setClienteDireccion("")
    } else {
      setClienteNombre("")
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────
  const resetForm = () => {
    setTipo("venta")
    setError("")
    setTipoCliente("CONSUMIDOR FINAL")
    setClienteNombre("Consumidor Final")
    setClienteContacto("")
    setClienteCedula("")
    setClienteDireccion("")
    setDetalle([detalleVacio()])
  }

  // ── Guardar ───────────────────────────────────────────────────────
  // descripcion = nombre del cliente
  // monto       = total del detalle (calculado automáticamente)
  // La factura se genera solo si hay al menos un producto en el detalle.
  const handleGuardar = async () => {
    setError("")
    if (!clienteNombre.trim()) return setError("Escribe el nombre del cliente.")
    if (detalleValido.length === 0) return setError("Agrega al menos un producto con descripción y precio.")
    if (subtotalDetalle <= 0) return setError("El total debe ser mayor a $0.")

    setGuardando(true)
    try {
      // 1. Registro contable — descripcion y monto derivados del detalle
      const descripcionAuto = `${clienteNombre.trim().toUpperCase()}`
      const { data: regCreado, error: errReg } = await supabase
        .from("contabilidad")
        .insert({
          tipo,
          descripcion: descripcionAuto,
          monto: Number(subtotalDetalle.toFixed(2)),
          usuario_id: usuario?.id || null,
          fecha: hoyISO(),
        })
        .select("id")
        .single()
      if (errReg) throw errReg

      // 2. Factura
      const numero = await generarNumero()
      const { data: factCreada, error: errFact } = await supabase
        .from("facturas")
        .insert({
          numero,
          contabilidad_id: regCreado.id,
          usuario_id: usuario?.id || null,
          tipo_cliente: tipoCliente,
          cliente_nombre: clienteNombre.trim(),
          cliente_contacto: clienteContacto.trim() || null,
          cliente_cedula: clienteCedula.trim() || null,
          cliente_direccion: clienteDireccion.trim() || null,
          subtotal: Number(subtotalDetalle.toFixed(2)),
          descuento: 0,
          total: Number(subtotalDetalle.toFixed(2)),
          fecha: hoyISO(),
        })
        .select("id")
        .single()
      if (errFact) throw errFact

      const { error: errDet } = await supabase.from("detalle_factura").insert(
        detalleValido.map((d) => ({
          factura_id: factCreada.id,
          descripcion: d.descripcion.trim(),
          cantidad: parseInt(d.cantidad),
          precio_unitario: Number(parseFloat(d.precio_unitario).toFixed(2)),
          subtotal: Number((parseFloat(d.cantidad) * parseFloat(d.precio_unitario)).toFixed(2)),
        }))
      )
      if (errDet) throw errDet

      resetForm()
      if (fechaVista === hoyISO()) await cargarRegistros()
    } catch (e) {
      setError("Error al guardar: " + e.message)
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar ──────────────────────────────────────────────────────
  const handleEliminar = async (r) => {
    if (r.usuario_id !== usuario?.id) return
    const factura = facturasMapa[r.id]
    if (!window.confirm(`¿Eliminar este registro?${factura ? "\nSe eliminará también la factura vinculada." : ""}`)) return
    if (factura) {
      await supabase.from("detalle_factura").delete().eq("factura_id", factura.id)
      await supabase.from("facturas").delete().eq("id", factura.id)
    }
    await supabase.from("contabilidad").delete().eq("id", r.id)
    setRegistros((prev) => prev.filter((x) => x.id !== r.id))
    setFacturasMapa((prev) => { const n = { ...prev }; delete n[r.id]; return n })
  }

  // ── Ver factura ───────────────────────────────────────────────────
  const abrirVerFactura = async (factura) => {
    setFacturaVer(factura)
    setModalVer(true)
    setCargandoModal(true)
    const { data } = await supabase
      .from("detalle_factura")
      .select("id, descripcion, cantidad, precio_unitario, subtotal")
      .eq("factura_id", factura.id)
      .order("id", { ascending: true })
    setDetalleVer(data || [])
    setCargandoModal(false)
  }
  const cerrarModal = () => { setModalVer(false); setFacturaVer(null); setDetalleVer([]) }

  // ── Fecha ─────────────────────────────────────────────────────────
  const cambiarFecha = (dias) => {
    const d = new Date(fechaVista + "T00:00:00")
    d.setDate(d.getDate() + dias)
    setFechaVista(d.toISOString().split("T")[0])
  }
  const esHoy = fechaVista === hoyISO()
  const labelFecha = () => {
    if (esHoy) return "Hoy"
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
    if (fechaVista === ayer.toISOString().split("T")[0]) return "Ayer"
    return new Date(fechaVista + "T00:00:00").toLocaleDateString("es-EC", {
      weekday: "short", day: "numeric", month: "long", year: "numeric",
    })
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="cont-wrapper">

      <div className="cont-header">
        <h1 className="cont-title">Contabilidad</h1>
        <p className="cont-subtitle">Registro diario de ventas y gastos con factura de respaldo</p>
      </div>

      <div className="cont-body">

        {/* ── COLUMNA IZQUIERDA ── */}
        <div className="cont-col cont-col-form">
          <div className="cont-card">
            <h2 className="cont-card-title">Nuevo registro</h2>

            {/* Tipo */}
            <div className="cont-field">
              <label className="cont-label">Tipo</label>
              <div className="tipo-toggle">
                <button className={`tipo-btn venta ${tipo === "venta" ? "active" : ""}`} onClick={() => setTipo("venta")}>
                  💰 Venta
                </button>
                <button className={`tipo-btn gasto ${tipo === "gasto" ? "active" : ""}`} onClick={() => setTipo("gasto")}>
                  📤 Gasto
                </button>
              </div>
            </div>

            {/* ── FACTURA ── */}
            <div className="factura-bloque">
              <div className="factura-bloque-titulo">🧾 Factura de respaldo</div>

              {/* Tipo cliente */}
              <div className="cont-field">
                <label className="cont-label">Tipo de cliente</label>
                <div className="tipo-toggle">
                  <button
                    className={`tipo-btn cf ${tipoCliente === "CONSUMIDOR FINAL" ? "active" : ""}`}
                    onClick={() => cambiarTipoCliente("CONSUMIDOR FINAL")}
                  >
                    Cons. Final
                  </button>
                  <button
                    className={`tipo-btn cl ${tipoCliente === "CLIENTE" ? "active" : ""}`}
                    onClick={() => cambiarTipoCliente("CLIENTE")}
                  >
                    Cliente
                  </button>
                </div>
              </div>

              {/* Nombre */}
              <div className="cont-field">
                <label className="cont-label">Nombre</label>
                <input
                  type="text"
                  className="cont-input"
                  placeholder="Nombre completo"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                />
              </div>

              {/* Campos extra solo si es CLIENTE */}
              {tipoCliente === "CLIENTE" && (
                <>
                  <div className="cont-field">
                    <label className="cont-label">Teléfono <span className="cont-hint">(opcional)</span></label>
                    <input
                      type="text"
                      className="cont-input"
                      placeholder="099xxxxxxx"
                      value={clienteContacto}
                      onChange={(e) => setClienteContacto(e.target.value)}
                    />
                  </div>
                  <div className="cont-field">
                    <label className="cont-label">Cédula / RUC <span className="cont-hint">(opcional)</span></label>
                    <input
                      type="text"
                      className="cont-input"
                      placeholder="0912345678"
                      value={clienteCedula}
                      onChange={(e) => setClienteCedula(e.target.value)}
                    />
                  </div>
                  <div className="cont-field">
                    <label className="cont-label">Dirección <span className="cont-hint">(opcional)</span></label>
                    <input
                      type="text"
                      className="cont-input"
                      placeholder="Av. Ejemplo 123"
                      value={clienteDireccion}
                      onChange={(e) => setClienteDireccion(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Detalle */}
              <div className="cont-field">
                <label className="cont-label">Productos / servicios</label>
                <div className="detalle-tabla">
                  <div className="detalle-fila detalle-header">
                    <span>Descripción</span>
                    <span>Cant.</span>
                    <span>P.Unit.</span>
                    <span>Subtotal</span>
                    <span />
                  </div>
                  {detalle.map((d) => {
                    const sub = (parseFloat(d.cantidad) || 0) * (parseFloat(d.precio_unitario) || 0)
                    return (
                      <div className="detalle-fila" key={d._key}>
                        <input
                          type="text"
                          className="cont-input detalle-input"
                          placeholder="Producto o servicio"
                          value={d.descripcion}
                          onChange={(e) => actualizarDetalle(d._key, "descripcion", e.target.value)}
                        />
                        <input
                          type="number"
                          className="cont-input detalle-input"
                          min="1"
                          step="1"
                          value={d.cantidad}
                          onChange={(e) => actualizarDetalle(d._key, "cantidad", e.target.value)}
                        />
                        <input
                          type="number"
                          className="cont-input detalle-input"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={d.precio_unitario}
                          onChange={(e) => actualizarDetalle(d._key, "precio_unitario", e.target.value)}
                        />
                        <span className="detalle-subtotal">{sub > 0 ? fmt(sub) : "—"}</span>
                        <button
                          className="btn-quitar-fila"
                          onClick={() => eliminarFila(d._key)}
                          disabled={detalle.length === 1}
                        >✕</button>
                      </div>
                    )
                  })}
                </div>
                <button className="btn-agregar-fila" onClick={agregarFila}>+ Agregar fila</button>
              </div>

              {/* Total */}
              {subtotalDetalle > 0 && (
                <div className="factura-total-row">
                  <span>Total</span>
                  <span className="factura-total-value">{fmt(subtotalDetalle)}</span>
                </div>
              )}
            </div>

            {error && <p className="cont-error">{error}</p>}

            <button className="btn-guardar-cont" onClick={handleGuardar} disabled={guardando}>
              {guardando ? "Guardando…" : `Registrar ${tipo} + emitir factura`}
            </button>
          </div>
        </div>

        {/* ── COLUMNA DERECHA ── */}
        <div className="cont-col cont-col-data">

          <div className="fecha-nav">
            <button className="fecha-btn" onClick={() => cambiarFecha(-1)}>←</button>
            <div className="fecha-centro">
              <span className="fecha-label">{labelFecha()}</span>
              <input
                type="date"
                className="fecha-input"
                value={fechaVista}
                max={hoyISO()}
                onChange={(e) => setFechaVista(e.target.value)}
              />
            </div>
            <button className="fecha-btn" onClick={() => cambiarFecha(1)} disabled={esHoy}>→</button>
          </div>

          <div className="resumen-grid">
            <div className="resumen-card ventas">
              <span className="resumen-icon">💰</span>
              <div>
                <p className="resumen-label">Ventas</p>
                <p className="resumen-monto">{fmt(totales.ventas)}</p>
              </div>
            </div>
            <div className="resumen-card gastos">
              <span className="resumen-icon">📤</span>
              <div>
                <p className="resumen-label">Gastos</p>
                <p className="resumen-monto">{fmt(totales.gastos)}</p>
              </div>
            </div>
            <div className={`resumen-card neta ${totales.neta >= 0 ? "positiva" : "negativa"}`}>
              <span className="resumen-icon">{totales.neta >= 0 ? "📈" : "📉"}</span>
              <div>
                <p className="resumen-label">Ganancia neta</p>
                <p className="resumen-monto">{fmt(totales.neta)}</p>
              </div>
            </div>
          </div>

          <div className="cont-card registros-card">
            <h2 className="cont-card-title">
              Registros del día
              <span className="registros-count">{registros.length}</span>
            </h2>

            {cargando ? (
              <p className="cont-empty">Cargando…</p>
            ) : registros.length === 0 ? (
              <p className="cont-empty">No hay registros para este día.</p>
            ) : (
              <div className="registros-lista">
                {registros.map((r) => {
                  const factura = facturasMapa[r.id] || null
                  return (
                    <div key={r.id} className={`registro-item ${r.tipo}`}>
                      <div className="registro-left">
                        <div className="registro-badges-row">
                          <span className={`registro-badge ${r.tipo}`}>
                            {r.tipo === "venta" ? "💰 Venta" : "📤 Gasto"}
                          </span>
                          {factura && (
                            <span className="registro-badge-factura">
                              🧾 {fmtNumero(factura.numero)}
                            </span>
                          )}
                        </div>
                        <p className="registro-desc">{r.descripcion}</p>
                        <p className="registro-meta">
                          {r.usuarios?.nombre ?? "—"} ·{" "}
                          {new Date(r.created_at).toLocaleTimeString("es-EC", {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="registro-right">
                        <span className={`registro-monto ${r.tipo}`}>
                          {r.tipo === "gasto" ? "−" : "+"}{fmt(r.monto)}
                        </span>
                        <div className="registro-acciones">
                          {factura && (
                            <button className="btn-ver-fact" onClick={() => abrirVerFactura(factura)}>
                              Ver factura
                            </button>
                          )}
                          {r.usuario_id === usuario?.id && (
                            <button className="btn-eliminar-reg" onClick={() => handleEliminar(r)} title="Eliminar">
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL VER FACTURA ─────────────────────────────────────── */}
      {modalVer && facturaVer && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal fact-modal" onClick={(e) => e.stopPropagation()}>

            <div className="fact-modal-header">
              <div>
                <h3>{fmtNumero(facturaVer.numero)}</h3>
                <p className="fact-modal-sub">Documento de respaldo · sin validez fiscal</p>
              </div>
              <div className="fact-modal-fecha-wrap">
                <span className="fact-modal-tipo-badge">{facturaVer.tipo_cliente}</span>
                <span className="fact-modal-fecha">
                  {new Date(facturaVer.fecha + "T00:00:00").toLocaleDateString("es-EC", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </span>
              </div>
            </div>

            <div className="fact-modal-cliente">
              <div>
                <span className="fact-modal-label">Cliente</span>
                <p>{facturaVer.cliente_nombre}</p>
              </div>
              {facturaVer.cliente_contacto && (
                <div>
                  <span className="fact-modal-label">Teléfono</span>
                  <p>{facturaVer.cliente_contacto}</p>
                </div>
              )}
              {facturaVer.cliente_cedula && (
                <div>
                  <span className="fact-modal-label">Cédula / RUC</span>
                  <p>{facturaVer.cliente_cedula}</p>
                </div>
              )}
              {facturaVer.cliente_direccion && (
                <div className="fact-modal-direccion">
                  <span className="fact-modal-label">Dirección</span>
                  <p>{facturaVer.cliente_direccion}</p>
                </div>
              )}
            </div>

            <div className="fact-modal-detalle">
              <div className="detalle-fila detalle-header detalle-header-modal">
                <span>Descripción</span>
                <span>Cant.</span>
                <span>P. Unit.</span>
                <span>Subtotal</span>
              </div>
              {cargandoModal ? (
                <p className="cont-empty">Cargando detalle…</p>
              ) : (
                detalleVer.map((d) => (
                  <div className="detalle-fila detalle-fila-ver" key={d.id}>
                    <span>{d.descripcion}</span>
                    <span>{d.cantidad}</span>
                    <span>{fmt(d.precio_unitario)}</span>
                    <span>{fmt(d.subtotal)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="fact-modal-total">
              <span>TOTAL</span>
              <span>{fmt(facturaVer.total)}</span>
            </div>

            <div className="modal-buttons">
              <button className="btn-cancelar" onClick={cerrarModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Contabilidad