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

const Contabilidad = ({ usuario }) => {
  // ── Estado principal ──────────────────────────────────────────────
  const [registros, setRegistros]     = useState([])
  const [fechaVista, setFechaVista]   = useState(hoyISO())
  const [cargando, setCargando]       = useState(false)

  // ── Estado formulario ─────────────────────────────────────────────
  const [tipo, setTipo]               = useState("venta")
  const [descripcion, setDescripcion] = useState("")
  const [monto, setMonto]             = useState("")
  const [guardando, setGuardando]     = useState(false)
  const [error, setError]             = useState("")

  // ── Cargar registros del día seleccionado ─────────────────────────
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

  // ── Totales del día ───────────────────────────────────────────────
  const totales = useMemo(() => {
    const ventas = registros
      .filter((r) => r.tipo === "venta")
      .reduce((sum, r) => sum + Number(r.monto), 0)
    const gastos = registros
      .filter((r) => r.tipo === "gasto")
      .reduce((sum, r) => sum + Number(r.monto), 0)
    return { ventas, gastos, neta: ventas - gastos }
  }, [registros])

  // ── Guardar registro ──────────────────────────────────────────────
  const handleGuardar = async () => {
    setError("")
    if (!descripcion.trim()) return setError("Escribe una descripción.")
    if (!monto || isNaN(monto) || Number(monto) <= 0)
      return setError("El monto debe ser mayor a $0.")

    setGuardando(true)
    const { error: err } = await supabase.from("contabilidad").insert({
      tipo,
      descripcion: descripcion.trim(),
      monto: Number(parseFloat(monto).toFixed(2)),
      usuario_id: usuario?.id,
      fecha: hoyISO(),
    })

    if (err) {
      setError("Error al guardar: " + err.message)
    } else {
      setDescripcion("")
      setMonto("")
      setTipo("venta")
      // Si estamos viendo hoy, recargamos
      if (fechaVista === hoyISO()) await cargarRegistros()
    }
    setGuardando(false)
  }

  // ── Eliminar registro (solo propio) ───────────────────────────────
  const handleEliminar = async (id, propietario_id) => {
    if (propietario_id !== usuario?.id) return
    if (!confirm("¿Eliminar este registro?")) return
    await supabase.from("contabilidad").delete().eq("id", id)
    setRegistros((prev) => prev.filter((r) => r.id !== id))
  }

  // ── Navegación por fecha ──────────────────────────────────────────
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
    return d.toLocaleDateString("es-EC", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  // ─── RENDER ───────────────────────────────────────────────────────
  return (
    <div className="cont-wrapper">

      {/* HEADER */}
      <div className="cont-header">
        <h1 className="cont-title">Contabilidad</h1>
        <p className="cont-subtitle">Registro diario de ventas y gastos</p>
      </div>

      <div className="cont-body">

        {/* ── COLUMNA IZQUIERDA: formulario ── */}
        <div className="cont-col cont-col-form">
          <div className="cont-card">
            <h2 className="cont-card-title">Nuevo registro</h2>

            {/* Tipo */}
            <div className="cont-field">
              <label className="cont-label">Tipo</label>
              <div className="tipo-toggle">
                <button
                  className={`tipo-btn venta ${tipo === "venta" ? "active" : ""}`}
                  onClick={() => setTipo("venta")}
                >
                  Venta
                </button>
                <button
                  className={`tipo-btn gasto ${tipo === "gasto" ? "active" : ""}`}
                  onClick={() => setTipo("gasto")}
                >
                   Gasto
                </button>
              </div>
            </div>

            {/* Descripción */}
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

            {/* Monto */}
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

            {error && <p className="cont-error">{error}</p>}

            <button
              className="btn-guardar-cont"
              onClick={handleGuardar}
              disabled={guardando}
            >
              {guardando ? "Guardando…" : `Registrar ${tipo}`}
            </button>
          </div>
        </div>

        {/* ── COLUMNA DERECHA: resumen + historial ── */}
        <div className="cont-col cont-col-data">

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
            <button
              className="fecha-btn"
              onClick={() => cambiarFecha(1)}
              disabled={esHoy}
            >→</button>
          </div>

          {/* Tarjetas de resumen */}
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

          {/* Lista de registros */}
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
                {registros.map((r) => (
                  <div key={r.id} className={`registro-item ${r.tipo}`}>
                    <div className="registro-left">
                      <span className={`registro-badge ${r.tipo}`}>
                        {r.tipo === "venta" ? "💰 Venta" : "📤 Gasto"}
                      </span>
                      <p className="registro-desc">{r.descripcion}</p>
                      <p className="registro-meta">
                        {r.usuarios?.nombre ?? "—"} ·{" "}
                        {new Date(r.created_at).toLocaleTimeString("es-EC", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="registro-right">
                      <span className={`registro-monto ${r.tipo}`}>
                        {r.tipo === "gasto" ? "−" : "+"}{fmt(r.monto)}
                      </span>
                      {r.usuario_id === usuario?.id && (
                        <button
                          className="btn-eliminar-reg"
                          title="Eliminar"
                          onClick={() => handleEliminar(r.id, r.usuario_id)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default Contabilidad
