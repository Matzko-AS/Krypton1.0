import { useState, useEffect, useMemo } from "react"
import { supabase } from "../../../supabase/supabaseClient"
import "./contabilidad.css"

const hoyISO = () => new Date().toISOString().split("T")[0]

const fmt = (n) =>
  Number(n).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  })

// ── Tabla de precios (solo referencia, sin cálculo) ───────────────────
const PRECIOS_BASE = {
  lona:             { label: "Lona",             precio: 12.00 },
  lona_translucida: { label: "Lona Translúcida", precio: 15.00 },
  vinil:            { label: "Vinil",            precio: 12.00, precioLaminado: 15.00 },
  pvc:              { label: "PVC",              precio: 15.00, precioLaminado: 18.00 },
  acrilico:         { label: "Acrílico",         precio: 18.00 },
}

const MARCOS = {
  madera:   { label: "Madera",   precio: 20.00 },
  metal:    { label: "Metal",    precio: 30.00 },
  luminoso: { label: "Luminoso", precio: 15.00 },
}

const CARAS_LETRERO = {
  lona:             { label: "Lona",             precio: 12.00 },
  lona_translucida: { label: "Lona Translúcida", precio: 15.00 },
}

const TIPOS_LAPIDA = {
  pvc:            { label: "PVC",            precio: 35.00 },
  acrilico:       { label: "Acrílico",       precio: 50.00 },
  pvc_reflectivo: { label: "PVC Reflectivo", precio: 50.00 },
  porcelanato:    { label: "Porcelanato",    precio: 160.00 },
  marmol:         { label: "Mármol",        precio: 200.00 },
}

let idCounter = 0
const nuevoItem = () => ({ id: `it_${Date.now()}_${idCounter++}`, descripcion: "", cantidad: 1, precio: "" })

const Contabilidad = ({ usuario }) => {
  // ── Datos principales ──────────────────────────────────────────────
  const [registros, setRegistros]   = useState([])
  const [fechaVista, setFechaVista] = useState(hoyISO())
  const [cargando, setCargando]     = useState(false)

  // ── Formulario de factura (visible por defecto) ────────────────────
  const [tipo, setTipo]             = useState("venta")
  const [conFactura, setConFactura] = useState(false)

  // Modo simple
  const [descripcion, setDescripcion] = useState("")
  const [monto, setMonto]             = useState("")

  // Modo con factura detallada
  const [clienteNombre, setClienteNombre]     = useState("")
  const [clienteContacto, setClienteContacto] = useState("")
  const [clienteDireccion, setClienteDireccion] = useState("")
  const [items, setItems]                     = useState([nuevoItem()])

  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState("")

  // ── Paneles secundarios ─────────────────────────────────────────────
  const [mostrarResumenes, setMostrarResumenes]   = useState(false)
  const [mostrarExportMenu, setMostrarExportMenu] = useState(false)
  const [mostrarPrecios, setMostrarPrecios]       = useState(false)
  const [facturaViendo, setFacturaViendo]         = useState(null)

  // ── Cargar registros del día seleccionado ───────────────────────────
  const cargarRegistros = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from("contabilidad")
      .select(`
        id,
        tipo,
        descripcion,
        monto,
        fecha,
        created_at,
        usuario_id,
        cliente_nombre,
        cliente_contacto,
        cliente_direccion,
        detalle,
        usuarios ( nombre )
      `)
      .eq("fecha", fechaVista)
      .order("created_at", { ascending: false })

    if (!error) setRegistros(data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargarRegistros()
  }, [fechaVista])

  // ── Totales del día ──────────────────────────────────────────────────
  const totales = useMemo(() => {
    const ventas = registros
      .filter((r) => r.tipo === "venta")
      .reduce((sum, r) => sum + Number(r.monto), 0)
    const gastos = registros
      .filter((r) => r.tipo === "gasto")
      .reduce((sum, r) => sum + Number(r.monto), 0)
    return { ventas, gastos, neta: ventas - gastos }
  }, [registros])

  // ── Manejo de líneas de factura ──────────────────────────────────────
  const actualizarItem = (id, campo, valor) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [campo]: valor } : it)))
  }
  const agregarItem = () => setItems((prev) => [...prev, nuevoItem()])
  const quitarItem = (id) => setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev))

  const totalFactura = useMemo(
    () => items.reduce((sum, it) => sum + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0), 0),
    [items]
  )

  // ── Reset formulario ─────────────────────────────────────────────────
  const resetForm = () => {
    setTipo("venta")
    setConFactura(false)
    setDescripcion("")
    setMonto("")
    setClienteNombre("")
    setClienteContacto("")
    setClienteDireccion("")
    setItems([nuevoItem()])
    setError("")
  }

  // ── Guardar registro ─────────────────────────────────────────────────
  const handleGuardar = async () => {
    setError("")

    let payload = {
      tipo,
      usuario_id: usuario?.id,
      fecha: hoyISO(),
    }

    if (conFactura) {
      const itemsValidos = items.filter((it) => it.descripcion.trim() && Number(it.precio) > 0)
      if (itemsValidos.length === 0) return setError("Agrega al menos una línea con descripción y precio.")
      if (totalFactura <= 0) return setError("El total de la factura debe ser mayor a $0.")

      payload = {
        ...payload,
        descripcion: `Factura — ${clienteNombre || "Cliente sin nombre"} (${itemsValidos.length} línea${itemsValidos.length > 1 ? "s" : ""})`,
        monto: Number(totalFactura.toFixed(2)),
        cliente_nombre: clienteNombre.trim() || null,
        cliente_contacto: clienteContacto.trim() || null,
        cliente_direccion: clienteDireccion.trim() || null,
        detalle: itemsValidos.map((it) => ({
          descripcion: it.descripcion.trim(),
          cantidad: parseFloat(it.cantidad) || 1,
          precio: parseFloat(it.precio) || 0,
          subtotal: (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0),
        })),
      }
    } else {
      if (!descripcion.trim()) return setError("Escribe una descripción.")
      if (!monto || isNaN(monto) || Number(monto) <= 0) return setError("El monto debe ser mayor a $0.")
      payload = {
        ...payload,
        descripcion: descripcion.trim(),
        monto: Number(parseFloat(monto).toFixed(2)),
      }
    }

    setGuardando(true)
    const { error: err } = await supabase.from("contabilidad").insert(payload)

    if (err) {
      setError("Error al guardar: " + err.message)
    } else {
      resetForm()
      if (fechaVista === hoyISO()) await cargarRegistros()
    }
    setGuardando(false)
  }

  // ── Eliminar registro (solo propio) ──────────────────────────────────
  const handleEliminar = async (id, propietario_id) => {
    if (propietario_id !== usuario?.id) return
    if (!confirm("¿Eliminar este registro?")) return
    await supabase.from("contabilidad").delete().eq("id", id)
    setRegistros((prev) => prev.filter((r) => r.id !== id))
  }

  // ── Navegación por fecha ──────────────────────────────────────────────
  const cambiarFecha = (dias) => {
    const d = new Date(fechaVista + "T00:00:00")
    d.setDate(d.getDate() + dias)
    setFechaVista(d.toISOString().split("T")[0])
  }

  const esHoy = fechaVista === hoyISO()

  const labelFecha = () => {
    const d = new Date(fechaVista + "T00:00:00")
    if (esHoy) return "Hoy"
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    if (fechaVista === ayer.toISOString().split("T")[0]) return "Ayer"
    return d.toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "long", year: "numeric" })
  }

  // ── Exportar CSV ───────────────────────────────────────────────────────
  const exportarCSV = () => {
    const filas = [["Tipo", "Descripción", "Monto", "Usuario", "Hora"]]
    registros.forEach((r) => {
      filas.push([
        r.tipo,
        `"${(r.descripcion || "").replace(/"/g, '""')}"`,
        r.monto,
        r.usuarios?.nombre ?? "",
        new Date(r.created_at).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
      ])
    })
    filas.push([])
    filas.push(["Total ventas", totales.ventas.toFixed(2)])
    filas.push(["Total gastos", totales.gastos.toFixed(2)])
    filas.push(["Ganancia neta", totales.neta.toFixed(2)])

    const csv = filas.map((f) => f.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `contabilidad_${fechaVista}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setMostrarExportMenu(false)
  }

  // ── Exportar / Imprimir PDF simple ──────────────────────────────────────
  const exportarPDF = () => {
    const filasHtml = registros.map((r) => `
      <tr>
        <td>${r.tipo === "venta" ? "Venta" : "Gasto"}</td>
        <td>${r.descripcion || ""}</td>
        <td style="text-align:right">${r.tipo === "gasto" ? "-" : ""}${fmt(r.monto)}</td>
        <td>${r.usuarios?.nombre ?? "—"}</td>
      </tr>
    `).join("")

    const ventana = window.open("", "_blank")
    ventana.document.write(`
      <html>
        <head>
          <title>Contabilidad — ${fechaVista}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            p.sub { color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 6px 10px; font-size: 13px; text-align: left; }
            th { background: #f0f0f0; }
            .totales td { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Resumen de Contabilidad — Krypton</h1>
          <p class="sub">${labelFecha()} (${fechaVista})</p>
          <table>
            <thead><tr><th>Tipo</th><th>Descripción</th><th>Monto</th><th>Usuario</th></tr></thead>
            <tbody>${filasHtml}</tbody>
          </table>
          <table class="totales">
            <tr><td>Total Ventas</td><td>${fmt(totales.ventas)}</td></tr>
            <tr><td>Total Gastos</td><td>${fmt(totales.gastos)}</td></tr>
            <tr><td>Ganancia Neta</td><td>${fmt(totales.neta)}</td></tr>
          </table>
        </body>
      </html>
    `)
    ventana.document.close()
    ventana.focus()
    ventana.print()
    setMostrarExportMenu(false)
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="cont-wrapper">

      {/* HEADER */}
      <div className="cont-header">
        <div>
          <h1 className="cont-title">Contabilidad</h1>
          <p className="cont-subtitle">Registro diario de ventas y gastos</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="cont-calc-toggle" style={{ width: "auto", margin: 0 }} onClick={() => setMostrarPrecios(true)}>
            💲 Ver precios
          </button>
          <button className="cont-calc-toggle" style={{ width: "auto", margin: 0 }} onClick={() => setMostrarResumenes(true)}>
            📊 Ver resúmenes
          </button>
        </div>
      </div>

      {/* ── FORMULARIO DE FACTURA (visible por defecto) ── */}
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

        {/* Toggle factura detallada */}
        <button
          className={`toggle-factura-btn ${conFactura ? "active" : ""}`}
          onClick={() => setConFactura((v) => !v)}
        >
          <span className={`toggle-dot ${conFactura ? "on" : ""}`} />
          {conFactura ? "Factura con detalle (cliente)" : "Registro consumidor final — activar para factura detallada"}
        </button>

        {conFactura ? (
          <div className="factura-bloque">
            <p className="factura-bloque-titulo">Datos del cliente</p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "13px" }}>
              <input
                className="cont-input"
                style={{ flex: 1, minWidth: "140px" }}
                placeholder="Nombre del cliente"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
              />
              <input
                className="cont-input"
                style={{ flex: 1, minWidth: "140px" }}
                placeholder="Contacto (tel/correo)"
                value={clienteContacto}
                onChange={(e) => setClienteContacto(e.target.value)}
              />
            </div>
            <input
              className="cont-input"
              style={{ marginBottom: "16px" }}
              placeholder="Dirección (opcional)"
              value={clienteDireccion}
              onChange={(e) => setClienteDireccion(e.target.value)}
            />

            <p className="factura-bloque-titulo">Detalle</p>
            <div className="detalle-tabla">
              <div className="detalle-fila detalle-header">
                <span>Descripción</span>
                <span>Cant.</span>
                <span>Precio</span>
                <span>Subtotal</span>
                <span></span>
              </div>
              {items.map((it) => (
                <div className="detalle-fila" key={it.id}>
                  <input
                    className="cont-input detalle-input"
                    placeholder="ej: Impresión lona 3x2"
                    value={it.descripcion}
                    onChange={(e) => actualizarItem(it.id, "descripcion", e.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    className="cont-input detalle-input"
                    value={it.cantidad}
                    onChange={(e) => actualizarItem(it.id, "cantidad", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="cont-input detalle-input"
                    placeholder="0.00"
                    value={it.precio}
                    onChange={(e) => actualizarItem(it.id, "precio", e.target.value)}
                  />
                  <span className="detalle-subtotal">
                    {fmt((parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0))}
                  </span>
                  <button
                    className="btn-quitar-fila"
                    onClick={() => quitarItem(it.id)}
                    disabled={items.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-agregar-fila" onClick={agregarItem}>+ Agregar línea</button>

            <div className="factura-total-row">
              <span>TOTAL FACTURA</span>
              <span className="factura-total-value">{fmt(totalFactura)}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="cont-field">
              <label className="cont-label">Descripción</label>
              <input
                type="text"
                className="cont-input"
                placeholder="ej: Impresión banner cliente X"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGuardar()}
                maxLength={120}
              />
            </div>
            <div className="cont-field">
              <label className="cont-label">Monto</label>
              <div className="cont-input-prefix-wrap">
                <span className="cont-input-prefix">$</span>
                <input
                  type="number"
                  className="cont-input"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGuardar()}
                />
              </div>
            </div>
          </>
        )}

        {error && <p className="cont-error">{error}</p>}

        <button className="btn-guardar-cont" onClick={handleGuardar} disabled={guardando}>
          {guardando ? "Guardando…" : `Registrar ${tipo}`}
        </button>
      </div>

      {/* ── MODAL: VER RESÚMENES ── */}
      {mostrarResumenes && (
        <div className="modal-overlay" onClick={() => { setMostrarResumenes(false); setMostrarExportMenu(false) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>

            <div className="fact-modal-header">
              <div>
                <h3>Resúmenes</h3>
                <p className="fact-modal-sub">Ventas, gastos e historial del día</p>
              </div>
              <div style={{ position: "relative" }}>
                <button className="btn-ver-fact" onClick={() => setMostrarExportMenu((v) => !v)}>
                  ⬇ Exportar
                </button>
                {mostrarExportMenu && (
                  <div style={{
                    position: "absolute", right: 0, top: "110%", background: "#161d2c",
                    border: "1px solid #2d3748", borderRadius: "8px", padding: "6px",
                    display: "flex", flexDirection: "column", gap: "4px", zIndex: 10, minWidth: "140px"
                  }}>
                    <button className="btn-agregar-fila" onClick={exportarCSV}>CSV</button>
                    <button className="btn-agregar-fila" onClick={exportarPDF}>Imprimir / PDF</button>
                  </div>
                )}
              </div>
            </div>

            {/* Navegador de fecha */}
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

            {/* Tarjetas resumen */}
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
              <div className={`resumen-card ${totales.neta >= 0 ? "positiva" : "negativa"}`}>
                <span className="resumen-icon">{totales.neta >= 0 ? "📈" : "📉"}</span>
                <div>
                  <p className="resumen-label">Ganancia neta</p>
                  <p className="resumen-monto">{fmt(totales.neta)}</p>
                </div>
              </div>
            </div>

            {/* Lista de registros */}
            <h2 className="cont-card-title">
              Registros del día <span className="registros-count">{registros.length}</span>
            </h2>

            {cargando ? (
              <p className="cont-empty">Cargando…</p>
            ) : registros.length === 0 ? (
              <p className="cont-empty">No hay registros para este día.</p>
            ) : (
              <div className="registros-lista">
                {registros.map((r) => (
                  <div key={r.id} className={`registro-item ${r.tipo}`}>
                    <div className="registro-left">
                      <div className="registro-badges-row">
                        <span className={`registro-badge ${r.tipo}`}>
                          {r.tipo === "venta" ? "💰 Venta" : "📤 Gasto"}
                        </span>
                        {r.detalle && <span className="registro-badge-factura">🧾 Factura</span>}
                      </div>
                      <p className="registro-desc">{r.descripcion}</p>
                      <p className="registro-meta">
                        {r.usuarios?.nombre ?? "—"} ·{" "}
                        {new Date(r.created_at).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="registro-right">
                      <span className={`registro-monto ${r.tipo}`}>
                        {r.tipo === "gasto" ? "−" : "+"}{fmt(r.monto)}
                      </span>
                      <div className="registro-acciones">
                        {r.detalle && (
                          <button className="btn-ver-fact" onClick={() => setFacturaViendo(r)}>Ver factura</button>
                        )}
                        {r.usuario_id === usuario?.id && (
                          <button className="btn-eliminar-reg" title="Eliminar" onClick={() => handleEliminar(r.id, r.usuario_id)}>✕</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-buttons" style={{ marginTop: "16px" }}>
              <button className="btn-cancelar" onClick={() => setMostrarResumenes(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER FACTURA DE UN REGISTRO ── */}
      {facturaViendo && (
        <div className="modal-overlay" onClick={() => setFacturaViendo(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>

            <div className="fact-modal-header">
              <div>
                <h3>Factura — {facturaViendo.cliente_nombre || "Sin nombre"}</h3>
                <p className="fact-modal-sub">Registrada por {facturaViendo.usuarios?.nombre ?? "—"}</p>
              </div>
              <div className="fact-modal-fecha-wrap">
                <span className="fact-modal-tipo-badge">{facturaViendo.tipo}</span>
                <span className="fact-modal-fecha">
                  {new Date(facturaViendo.created_at).toLocaleDateString("es-EC")}
                </span>
              </div>
            </div>

            <div className="fact-modal-cliente">
              <div>
                <span className="fact-modal-label">Contacto</span>
                <p>{facturaViendo.cliente_contacto || "—"}</p>
              </div>
              {facturaViendo.cliente_direccion && (
                <div className="fact-modal-direccion">
                  <span className="fact-modal-label">Dirección</span>
                  <p>{facturaViendo.cliente_direccion}</p>
                </div>
              )}
            </div>

            <div className="fact-modal-detalle">
              <div className="detalle-fila-ver detalle-header detalle-header-modal">
                <span>Descripción</span>
                <span>Cant.</span>
                <span>Precio</span>
                <span>Subtotal</span>
              </div>
              {(facturaViendo.detalle || []).map((it, i) => (
                <div className="detalle-fila-ver" key={i}>
                  <span>{it.descripcion}</span>
                  <span>{it.cantidad}</span>
                  <span>{fmt(it.precio)}</span>
                  <span>{fmt(it.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="fact-modal-total">
              <span>TOTAL</span>
              <span>{fmt(facturaViendo.monto)}</span>
            </div>

            <div className="modal-buttons">
              <button className="btn-cancelar" onClick={() => setFacturaViendo(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER PRECIOS (solo referencia) ── */}
      {mostrarPrecios && (
        <div className="modal-overlay" onClick={() => setMostrarPrecios(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: "16px" }}>Tabla de precios</h3>

            {[
              ["Materiales ($/m²)", PRECIOS_BASE],
              ["Marcos de letrero ($/m²)", MARCOS],
              ["Caras de letrero ($/m²)", CARAS_LETRERO],
              ["Lápidas ($/m²)", TIPOS_LAPIDA],
            ].map(([titulo, tabla]) => (
              <div key={titulo} style={{ marginBottom: "16px" }}>
                <p className="factura-bloque-titulo">{titulo}</p>
                <div className="detalle-tabla">
                  {Object.values(tabla).map((item) => (
                    <div
                      key={item.label}
                      className="detalle-fila-ver"
                      style={{ gridTemplateColumns: "1fr auto" }}
                    >
                      <span>{item.label}{item.precioLaminado ? " (con laminado disponible)" : ""}</span>
                      <span>
                        {fmt(item.precio)}
                        {item.precioLaminado ? ` / ${fmt(item.precioLaminado)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="modal-buttons">
              <button className="btn-cancelar" onClick={() => setMostrarPrecios(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Contabilidad