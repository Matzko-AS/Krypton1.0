import { useState, useEffect, useMemo } from "react"
import { supabase } from "../../../supabase/supabaseClient"
import "./contabilidad.css"

// ── Fechas en hora LOCAL (toISOString usa UTC y en Ecuador, después de las
//    19:00, devolvía el día siguiente) ───────────────────────────────────
const aISO = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
const hoyISO = () => aISO(new Date())

const fmt = (n) =>
  Number(n).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  })

const hora = (iso) =>
  new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// ── Tabla de precios (solo referencia) ───────────────────────────────
const TABLAS_PRECIOS = [
  {
    titulo: "Materiales",
    filas: [
      { label: "Lona", precio: 12 },
      { label: "Lona translúcida", precio: 15 },
      { label: "Vinil", precio: 12, laminado: 15 },
      { label: "PVC", precio: 15, laminado: 18 },
      { label: "Acrílico", precio: 18 },
    ],
  },
  {
    titulo: "Letreros · marcos",
    filas: [
      { label: "Madera", precio: 20 },
      { label: "Metal", precio: 30 },
      { label: "Luminoso", precio: 15 },
    ],
  },
  {
    titulo: "Letreros · caras",
    filas: [
      { label: "Lona", precio: 12 },
      { label: "Lona translúcida", precio: 15 },
    ],
  },
  {
    titulo: "Lápidas",
    filas: [
      { label: "PVC", precio: 35 },
      { label: "Acrílico", precio: 50 },
      { label: "PVC reflectivo", precio: 50 },
      { label: "Porcelanato", precio: 160 },
      { label: "Mármol", precio: 200 },
    ],
  },
]

let idCounter = 0
const nuevoItem = () => ({
  id: `it_${Date.now()}_${idCounter++}`,
  descripcion: "",
  cantidad: 1,
  precio: "",
})

const Contabilidad = ({ usuario }) => {
  // ── Datos ──────────────────────────────────────────────────────────
  const [registros, setRegistros] = useState([])
  const [fechaVista, setFechaVista] = useState(hoyISO())
  const [cargando, setCargando] = useState(false)
  const [filtro, setFiltro] = useState("todos") // todos | venta | gasto
  const [abierto, setAbierto] = useState(null) // id de factura expandida

  // ── Formulario ─────────────────────────────────────────────────────
  const [tipo, setTipo] = useState("venta")
  const [conFactura, setConFactura] = useState(false)
  const [descripcion, setDescripcion] = useState("")
  const [monto, setMonto] = useState("")
  const [clienteNombre, setClienteNombre] = useState("")
  const [clienteContacto, setClienteContacto] = useState("")
  const [clienteDireccion, setClienteDireccion] = useState("")
  const [items, setItems] = useState([nuevoItem()])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  // ── Paneles ────────────────────────────────────────────────────────
  const [mostrarPrecios, setMostrarPrecios] = useState(false)
  const [menuExport, setMenuExport] = useState(false)

  const esHoy = fechaVista === hoyISO()

  // ── Carga ──────────────────────────────────────────────────────────
  const cargarRegistros = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from("contabilidad")
      .select(
        `id, tipo, descripcion, monto, fecha, created_at, usuario_id,
         cliente_nombre, cliente_contacto, cliente_direccion, detalle,
         usuarios ( nombre )`
      )
      .eq("fecha", fechaVista)
      .order("created_at", { ascending: false })

    if (!error) setRegistros(data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargarRegistros()
    setAbierto(null)
  }, [fechaVista])

  // ── Totales ────────────────────────────────────────────────────────
  const totales = useMemo(() => {
    const suma = (t) =>
      registros.filter((r) => r.tipo === t).reduce((s, r) => s + Number(r.monto), 0)
    const ventas = suma("venta")
    const gastos = suma("gasto")
    return { ventas, gastos, neta: ventas - gastos }
  }, [registros])

  const visibles = useMemo(
    () => (filtro === "todos" ? registros : registros.filter((r) => r.tipo === filtro)),
    [registros, filtro]
  )

  // ── Líneas de factura ──────────────────────────────────────────────
  const actualizarItem = (id, campo, valor) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [campo]: valor } : it)))
  const agregarItem = () => setItems((prev) => [...prev, nuevoItem()])
  const quitarItem = (id) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev))

  const totalFactura = useMemo(
    () =>
      items.reduce(
        (s, it) => s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0),
        0
      ),
    [items]
  )

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

  // ── Guardar ────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    setError("")
    let payload = { tipo, usuario_id: usuario?.id, fecha: hoyISO() }

    if (conFactura) {
      const validos = items.filter((it) => it.descripcion.trim() && Number(it.precio) > 0)
      if (validos.length === 0)
        return setError("Agrega al menos una línea con descripción y precio.")
      if (totalFactura <= 0) return setError("El total debe ser mayor a $0.")

      payload = {
        ...payload,
        descripcion: `Factura — ${clienteNombre.trim() || "Cliente sin nombre"} (${validos.length} línea${validos.length > 1 ? "s" : ""})`,
        monto: Number(totalFactura.toFixed(2)),
        cliente_nombre: clienteNombre.trim() || null,
        cliente_contacto: clienteContacto.trim() || null,
        cliente_direccion: clienteDireccion.trim() || null,
        detalle: validos.map((it) => {
          const cantidad = parseFloat(it.cantidad) || 1
          const precio = parseFloat(it.precio) || 0
          return {
            descripcion: it.descripcion.trim(),
            cantidad,
            precio,
            subtotal: cantidad * precio,
          }
        }),
      }
    } else {
      if (!descripcion.trim()) return setError("Escribe una descripción.")
      if (!monto || isNaN(monto) || Number(monto) <= 0)
        return setError("El monto debe ser mayor a $0.")
      payload = {
        ...payload,
        descripcion: descripcion.trim(),
        monto: Number(parseFloat(monto).toFixed(2)),
      }
    }

    setGuardando(true)
    const { error: err } = await supabase.from("contabilidad").insert(payload)
    setGuardando(false)

    if (err) return setError("Error al guardar: " + err.message)

    resetForm()
    // El registro se guarda con fecha de hoy: si estabas viendo otro día, vuelve a hoy
    if (fechaVista === hoyISO()) await cargarRegistros()
    else setFechaVista(hoyISO())
  }

  const handleEliminar = async (r) => {
    if (r.usuario_id !== usuario?.id) return
    if (!window.confirm("¿Eliminar este registro?")) return
    const { error: err } = await supabase.from("contabilidad").delete().eq("id", r.id)
    if (!err) setRegistros((prev) => prev.filter((x) => x.id !== r.id))
  }

  // ── Fechas ─────────────────────────────────────────────────────────
  const cambiarFecha = (dias) => {
    const d = new Date(fechaVista + "T00:00:00")
    d.setDate(d.getDate() + dias)
    setFechaVista(aISO(d))
  }

  const labelFecha = () => {
    if (esHoy) return "Hoy"
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    if (fechaVista === aISO(ayer)) return "Ayer"
    return new Date(fechaVista + "T00:00:00").toLocaleDateString("es-EC", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
  }

  // ── Exportar ───────────────────────────────────────────────────────
  const exportarCSV = () => {
    const celda = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const filas = [["Tipo", "Descripción", "Monto", "Usuario", "Hora"].map(celda)]
    registros.forEach((r) =>
      filas.push([r.tipo, r.descripcion, r.monto, r.usuarios?.nombre ?? "", hora(r.created_at)].map(celda))
    )
    filas.push([])
    filas.push([celda("Total ventas"), "", totales.ventas.toFixed(2)])
    filas.push([celda("Total gastos"), "", totales.gastos.toFixed(2)])
    filas.push([celda("Ganancia neta"), "", totales.neta.toFixed(2)])

    const csv = "\uFEFF" + filas.map((f) => f.join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `contabilidad_${fechaVista}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setMenuExport(false)
  }

  const exportarPDF = () => {
    const filasHtml = registros
      .map(
        (r) => `<tr>
          <td>${r.tipo === "venta" ? "Venta" : "Gasto"}</td>
          <td>${esc(r.descripcion)}</td>
          <td style="text-align:right">${r.tipo === "gasto" ? "-" : ""}${fmt(r.monto)}</td>
          <td>${esc(r.usuarios?.nombre ?? "—")}</td>
        </tr>`
      )
      .join("")

    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html><head><title>Contabilidad — ${fechaVista}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin-bottom:4px} p.sub{color:#666;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px;text-align:left}
        th{background:#f0f0f0} .tot td{font-weight:bold}
      </style></head><body>
      <h1>Resumen de contabilidad — Krypton</h1>
      <p class="sub">${esc(labelFecha())} (${fechaVista})</p>
      <table><thead><tr><th>Tipo</th><th>Descripción</th><th>Monto</th><th>Usuario</th></tr></thead>
      <tbody>${filasHtml}</tbody></table>
      <table class="tot">
        <tr><td>Total ventas</td><td>${fmt(totales.ventas)}</td></tr>
        <tr><td>Total gastos</td><td>${fmt(totales.gastos)}</td></tr>
        <tr><td>Ganancia neta</td><td>${fmt(totales.neta)}</td></tr>
      </table></body></html>`)
    w.document.close()
    w.focus()
    w.print()
    setMenuExport(false)
  }

  // ─── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="ct">
      {/* ── BARRA SUPERIOR ── */}
      <header className="ct-top">
        <div className="ct-date">
          <button className="ct-icon-btn" onClick={() => cambiarFecha(-1)} aria-label="Día anterior">
            ‹
          </button>
          <div className="ct-date-text">
            <h1>{labelFecha()}</h1>
            <input
              type="date"
              value={fechaVista}
              max={hoyISO()}
              onChange={(e) => e.target.value && setFechaVista(e.target.value)}
              aria-label="Elegir fecha"
            />
          </div>
          <button
            className="ct-icon-btn"
            onClick={() => cambiarFecha(1)}
            disabled={esHoy}
            aria-label="Día siguiente"
          >
            ›
          </button>
        </div>

        <div className="ct-top-actions">
          <button className="ct-ghost" onClick={() => setMostrarPrecios(true)}>
            Tabla de precios
          </button>
          <div className="ct-menu-wrap">
            <button
              className="ct-ghost"
              onClick={() => setMenuExport((v) => !v)}
              disabled={registros.length === 0}
            >
              Exportar
            </button>
            {menuExport && (
              <div className="ct-menu">
                <button onClick={exportarCSV}>Descargar CSV</button>
                <button onClick={exportarPDF}>Imprimir / PDF</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── RESUMEN DEL DÍA ── */}
      <section className="ct-summary" aria-label="Resumen del día">
        <div className="ct-sum-item">
          <span className="ct-sum-label">Ventas</span>
          <span className="ct-sum-value ct-pos">{fmt(totales.ventas)}</span>
        </div>
        <div className="ct-sum-item">
          <span className="ct-sum-label">Gastos</span>
          <span className="ct-sum-value ct-neg">{fmt(totales.gastos)}</span>
        </div>
        <div className="ct-sum-item ct-sum-main">
          <span className="ct-sum-label">Ganancia neta</span>
          <span className={`ct-sum-value ${totales.neta >= 0 ? "ct-net-pos" : "ct-net-neg"}`}>
            {fmt(totales.neta)}
          </span>
        </div>
      </section>

      <div className="ct-body">
        {/* ── LIBRO DIARIO ── */}
        <section className="ct-panel ct-ledger">
          <div className="ct-panel-head">
            <h2>
              Movimientos <span className="ct-count">{registros.length}</span>
            </h2>
            <div className="ct-seg ct-seg-sm" role="tablist">
              {[
                ["todos", "Todos"],
                ["venta", "Ventas"],
                ["gasto", "Gastos"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={filtro === k}
                  className={filtro === k ? "on" : ""}
                  onClick={() => setFiltro(k)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {cargando ? (
            <p className="ct-empty">Cargando…</p>
          ) : visibles.length === 0 ? (
            <p className="ct-empty">
              {registros.length === 0
                ? esHoy
                  ? "Aún no hay movimientos hoy. Registra el primero desde el formulario."
                  : "No hay movimientos en este día."
                : "No hay movimientos de este tipo."}
            </p>
          ) : (
            <ul className="ct-rows">
              {visibles.map((r) => {
                const esFactura = Array.isArray(r.detalle) && r.detalle.length > 0
                const expandido = abierto === r.id
                return (
                  <li key={r.id} className={`ct-row ${r.tipo}`}>
                    <div className="ct-row-main">
                      <span className="ct-time">{hora(r.created_at)}</span>

                      <div className="ct-row-info">
                        <p className="ct-row-desc">{r.descripcion}</p>
                        <p className="ct-row-meta">
                          {r.usuarios?.nombre ?? "—"}
                          {esFactura && <span className="ct-tag">Factura</span>}
                        </p>
                      </div>

                      <span className={`ct-amount ${r.tipo}`}>
                        {r.tipo === "gasto" ? "−" : "+"}
                        {fmt(r.monto)}
                      </span>

                      <div className="ct-row-actions">
                        {esFactura && (
                          <button
                            className="ct-link"
                            onClick={() => setAbierto(expandido ? null : r.id)}
                            aria-expanded={expandido}
                          >
                            {expandido ? "Ocultar" : "Ver detalle"}
                          </button>
                        )}
                        {r.usuario_id === usuario?.id && (
                          <button
                            className="ct-del"
                            title="Eliminar registro"
                            aria-label="Eliminar registro"
                            onClick={() => handleEliminar(r)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {esFactura && expandido && (
                      <div className="ct-invoice">
                        <div className="ct-invoice-client">
                          <div>
                            <span>Cliente</span>
                            <p>{r.cliente_nombre || "Sin nombre"}</p>
                          </div>
                          <div>
                            <span>Contacto</span>
                            <p>{r.cliente_contacto || "—"}</p>
                          </div>
                          {r.cliente_direccion && (
                            <div className="ct-full">
                              <span>Dirección</span>
                              <p>{r.cliente_direccion}</p>
                            </div>
                          )}
                        </div>

                        <table className="ct-table">
                          <thead>
                            <tr>
                              <th>Descripción</th>
                              <th>Cant.</th>
                              <th>Precio</th>
                              <th>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.detalle.map((it, i) => (
                              <tr key={i}>
                                <td>{it.descripcion}</td>
                                <td>{it.cantidad}</td>
                                <td>{fmt(it.precio)}</td>
                                <td>{fmt(it.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={3}>Total</td>
                              <td>{fmt(r.monto)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ── FORMULARIO ── */}
        <aside className="ct-panel ct-form">
          <h2>Nuevo registro</h2>

          <div className="ct-seg" role="tablist" aria-label="Tipo de registro">
            <button
              role="tab"
              aria-selected={tipo === "venta"}
              className={`venta ${tipo === "venta" ? "on" : ""}`}
              onClick={() => setTipo("venta")}
            >
              Venta
            </button>
            <button
              role="tab"
              aria-selected={tipo === "gasto"}
              className={`gasto ${tipo === "gasto" ? "on" : ""}`}
              onClick={() => setTipo("gasto")}
            >
              Gasto
            </button>
          </div>

          <div className="ct-seg" role="tablist" aria-label="Modo de registro">
            <button
              role="tab"
              aria-selected={!conFactura}
              className={!conFactura ? "on" : ""}
              onClick={() => setConFactura(false)}
            >
              Consumidor final
            </button>
            <button
              role="tab"
              aria-selected={conFactura}
              className={conFactura ? "on" : ""}
              onClick={() => setConFactura(true)}
            >
              Con factura
            </button>
          </div>

          {conFactura ? (
            <>
              <div className="ct-field">
                <label htmlFor="ct-cli">Cliente</label>
                <input
                  id="ct-cli"
                  className="ct-input"
                  placeholder="Nombre del cliente"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                />
              </div>
              <div className="ct-field-row">
                <input
                  className="ct-input"
                  placeholder="Teléfono o correo"
                  value={clienteContacto}
                  onChange={(e) => setClienteContacto(e.target.value)}
                  aria-label="Contacto"
                />
                <input
                  className="ct-input"
                  placeholder="Dirección (opcional)"
                  value={clienteDireccion}
                  onChange={(e) => setClienteDireccion(e.target.value)}
                  aria-label="Dirección"
                />
              </div>

              <div className="ct-lines">
                <p className="ct-lines-title">Detalle</p>
                {items.map((it) => (
                  <div className="ct-line" key={it.id}>
                    <input
                      className="ct-input ct-line-desc"
                      placeholder="ej: Impresión lona 3x2"
                      value={it.descripcion}
                      onChange={(e) => actualizarItem(it.id, "descripcion", e.target.value)}
                      aria-label="Descripción de la línea"
                    />
                    <input
                      type="number"
                      min="1"
                      className="ct-input"
                      value={it.cantidad}
                      onChange={(e) => actualizarItem(it.id, "cantidad", e.target.value)}
                      aria-label="Cantidad"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="ct-input"
                      placeholder="0.00"
                      value={it.precio}
                      onChange={(e) => actualizarItem(it.id, "precio", e.target.value)}
                      aria-label="Precio unitario"
                    />
                    <span className="ct-line-sub">
                      {fmt((parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0))}
                    </span>
                    <button
                      className="ct-del"
                      onClick={() => quitarItem(it.id)}
                      disabled={items.length === 1}
                      aria-label="Quitar línea"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button className="ct-add" onClick={agregarItem}>
                  + Agregar línea
                </button>
              </div>

              <div className="ct-total">
                <span>Total factura</span>
                <strong>{fmt(totalFactura)}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="ct-field">
                <label htmlFor="ct-desc">Descripción</label>
                <input
                  id="ct-desc"
                  type="text"
                  className="ct-input"
                  placeholder="ej: Impresión banner cliente X"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGuardar()}
                  maxLength={120}
                />
              </div>
              <div className="ct-field">
                <label htmlFor="ct-monto">Monto</label>
                <div className="ct-money">
                  <span>$</span>
                  <input
                    id="ct-monto"
                    type="number"
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

          {error && <p className="ct-error" role="alert">{error}</p>}

          <button className={`ct-submit ${tipo}`} onClick={handleGuardar} disabled={guardando}>
            {guardando ? "Guardando…" : tipo === "venta" ? "Registrar venta" : "Registrar gasto"}
          </button>
        </aside>
      </div>

      {/* ── MODAL PRECIOS ── */}
      {mostrarPrecios && (
        <div className="ct-overlay" onClick={() => setMostrarPrecios(false)}>
          <div
            className="ct-modal"
            role="dialog"
            aria-label="Tabla de precios"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ct-modal-head">
              <h2>Tabla de precios</h2>
              <span>USD por m²</span>
            </div>

            <div className="ct-price-grid">
              {TABLAS_PRECIOS.map((t) => (
                <div key={t.titulo} className="ct-price-block">
                  <h3>{t.titulo}</h3>
                  {t.filas.map((f) => (
                    <div key={f.label} className="ct-price-row">
                      <span>{f.label}</span>
                      <span>
                        {fmt(f.precio)}
                        {f.laminado != null && (
                          <small> · laminado {fmt(f.laminado)}</small>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="ct-modal-foot">
              <button className="ct-ghost" onClick={() => setMostrarPrecios(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Contabilidad
