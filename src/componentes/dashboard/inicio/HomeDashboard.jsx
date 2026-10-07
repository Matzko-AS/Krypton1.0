import { useState, useEffect } from "react"
import { supabase } from "../../../supabase/supabaseClient"
import {
  tipoMat,
  m2,
  formatoDisponible,
  porcentajeDisponible,
} from "../../../utils/materiales"
import "./HomeDashboard.css"

const NIVELES = {
  disponible: {
    label: "Disponibles",
    icon: "ti-package",
    bg: "#1a3a2a",
    border: "#22c55e",
    color: "#4ade80",
  },
  bajo_stock: {
    label: "Bajo stock",
    icon: "ti-alert-triangle",
    bg: "#3a2a10",
    border: "#f59e0b",
    color: "#fbbf24",
  },
  agotado: {
    label: "Agotados",
    icon: "ti-circle-x",
    bg: "#3a1010",
    border: "#ef4444",
    color: "#f87171",
  },
}

// Nivel según lo que realmente queda, no según el campo "estado" escrito a mano
const nivelMaterial = (m) => {
  const area = Number(m.area_disponible_cm2) || 0
  if (area <= 0) return "agotado"
  return porcentajeDisponible(m) < 25 ? "bajo_stock" : "disponible"
}

const HomeDashboard = ({ usuario, rol }) => {
  const [pedidos, setPedidos] = useState([])
  const [materiales, setMateriales] = useState([])
  const [cargando, setCargando] = useState(true)

  const [filtroTipo, setFiltroTipo] = useState("todos")
  const [filtroNivel, setFiltroNivel] = useState(null)
  const [orden, setOrden] = useState("nombre")
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)

    const [{ data: dataPedidos }, { data: dataMateriales }] = await Promise.all([
      supabase.from("pedidos").select("estado"),
      supabase.from("materiales").select("*"),
    ])

    if (dataPedidos) setPedidos(dataPedidos)
    if (dataMateriales) setMateriales(dataMateriales)

    setCargando(false)
  }

  const contarPedidos = (estado) =>
    pedidos.filter((p) => p.estado === estado).length

  const contarNivel = (nivel) =>
    materiales.filter((m) => nivelMaterial(m) === nivel).length

  const totalPedidos = pedidos.length

  const tipos = [...new Set(materiales.map(tipoMat))].filter(Boolean)

  const visibles = materiales
    .filter((m) => filtroTipo === "todos" || tipoMat(m) === filtroTipo)
    .filter((m) => !filtroNivel || nivelMaterial(m) === filtroNivel)
    .sort((a, b) =>
      orden === "menos"
        ? porcentajeDisponible(a) - porcentajeDisponible(b)
        : (a.nombre || "").localeCompare(b.nombre || ""),
    )

  const ahora = new Date().toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Guayaquil",
  })

  const labelRol = rol === "diseñador" ? "Diseño" : "Taller"

  const circulosPedidos = [
    { estado: "en_diseño", label: "En diseño", bg: "#1e2a6e", border: "#4f6ef7", color: "#818cf8" },
    { estado: "pendiente", label: "Pendientes", bg: "#3a2a10", border: "#f59e0b", color: "#fbbf24" },
    { estado: "sin_material", label: "Sin material", bg: "#3a1010", border: "#ef4444", color: "#f87171" },
    { estado: "en_impresion", label: "En impresión", bg: "#1a3a2a", border: "#22c55e", color: "#4ade80" },
    { estado: "terminado", label: "Terminados", bg: "#1e2535", border: "#475569", color: "#94a3b8" },
  ]

  if (cargando) {
    return (
      <div className="home-loading">
        <div className="home-loading-spinner" />
        <p>Cargando resumen...</p>
      </div>
    )
  }

  return (
    <div className="home-wrapper">

      <div className="home-header">
        <div>
          <h1 className="home-title">
            Bienvenido, <span className="home-role">{labelRol}</span>
          </h1>
          <p className="home-date">{ahora}</p>
        </div>
        <button className="home-refresh" onClick={cargarDatos} title="Actualizar">
          <img src="/iconos/actualizar.svg" alt="" />
          <i className="ti ti-refresh" />
        </button>
      </div>

      {/* ── PEDIDOS ── */}
      <section className="home-section">
        <div className="home-section-header">
          <span className="home-section-label">Pedidos</span>
          <span className="home-total-badge">{totalPedidos} en total</span>
        </div>

        <div className="home-circles">
          {circulosPedidos.map(({ estado, label, bg, border, color }) => {
            const count = contarPedidos(estado)
            return (
              <div key={estado} className="circle-wrap">
                <div
                  className="circle-ring"
                  style={{ background: bg, border: `2px solid ${border}` }}
                >
                  <span className="circle-num" style={{ color }}>
                    {count}
                  </span>
                </div>
                <span className="circle-label">{label}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── MATERIALES ── */}
      <section className="home-section">
        <div className="home-section-header">
          <span className="home-section-label">Materiales</span>
          <span className="home-total-badge">{materiales.length} registrados</span>
        </div>

        {/* Resumen clicable */}
        <div className="home-mat-grid">
          {Object.entries(NIVELES).map(([nivel, cfg]) => {
            const activo = filtroNivel === nivel
            return (
              <div
                key={nivel}
                className="mat-card"
                style={{
                  borderLeft: `3px solid ${cfg.border}`,
                  cursor: "pointer",
                  outline: activo ? `2px solid ${cfg.border}` : "none",
                }}
                onClick={() => setFiltroNivel(activo ? null : nivel)}
                title="Clic para filtrar"
              >
                <div className="mat-icon-wrap" style={{ background: cfg.bg }}>
                  <i className={`ti ${cfg.icon}`} style={{ color: cfg.color }} aria-hidden="true" />
                </div>
                <div>
                  <p className="mat-count" style={{ color: cfg.color }}>
                    {contarNivel(nivel)}
                  </p>
                  <p className="mat-label">{cfg.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Filtros */}
        <div className="inv-toolbar">
          <div className="inv-chips">
            <button
              className={`inv-chip ${filtroTipo === "todos" ? "activo" : ""}`}
              onClick={() => setFiltroTipo("todos")}
            >
              Todos
            </button>
            {tipos.map((t) => (
              <button
                key={t}
                className={`inv-chip ${filtroTipo === t ? "activo" : ""}`}
                onClick={() => setFiltroTipo(t)}
              >
                {t.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <button
            className="inv-orden"
            onClick={() => setOrden(orden === "nombre" ? "menos" : "nombre")}
          >
            {orden === "nombre" ? "Orden: nombre" : "Orden: los que menos quedan"}
          </button>
        </div>

        {/* Lista de materiales */}
        {visibles.length === 0 ? (
          <p className="inv-vacio">No hay materiales con ese filtro.</p>
        ) : (
          <div className="inv-grid">
            {visibles.map((m) => {
              const nivel = nivelMaterial(m)
              const cfg = NIVELES[nivel]
              const pct = porcentajeDisponible(m)
              const esRollo = (m.unidad || "").toLowerCase() === "metros"
              const rollosEq =
                esRollo && m.ancho && m.largo
                  ? (Number(m.area_disponible_cm2) || 0) / (m.ancho * m.largo * 100)
                  : null
              const abiertoAhora = abierto === m.id

              return (
                <div
                  key={m.id}
                  className={`inv-item ${abiertoAhora ? "abierto" : ""}`}
                  style={{ borderLeft: `3px solid ${cfg.border}` }}
                  onClick={() => setAbierto(abiertoAhora ? null : m.id)}
                >
                  <div className="inv-top">
                    <div className="inv-info">
                      <span className="inv-nombre">{m.nombre}</span>
                      <span className="inv-tipo">
                        {(m.tipo_material || "").replace(/_/g, " ")}
                        {m.subtipo ? ` · ${m.subtipo}` : ""}
                        {m.grosor ? ` · ${m.grosor} mm` : ""}
                      </span>
                    </div>
                    <span className="inv-valor" style={{ color: cfg.color }}>
                      {formatoDisponible(m)}
                    </span>
                  </div>

                  <div className="inv-bar">
                    <div
                      className="inv-bar-fill"
                      style={{ width: `${pct}%`, background: cfg.border }}
                    />
                  </div>
                  <div className="inv-pct">{pct.toFixed(0)}% restante</div>

                  {abiertoAhora && (
                    <div className="inv-detalle">
                      {m.ancho && (
                        <div className="inv-fila">
                          <span>Ancho</span>
                          <span>{m.ancho} cm</span>
                        </div>
                      )}
                      {rollosEq !== null && (
                        <div className="inv-fila">
                          <span>Equivale a</span>
                          <span>≈ {rollosEq.toFixed(2)} rollos de {m.largo} m</span>
                        </div>
                      )}
                      <div className="inv-fila">
                        <span>Área total restante</span>
                        <span>{m2(m.area_disponible_cm2)} m²</span>
                      </div>
                      <div className="inv-fila">
                        <span>Comprado</span>
                        <span>{m.stock} {esRollo ? "rollos" : "planchas"}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}

export default HomeDashboard