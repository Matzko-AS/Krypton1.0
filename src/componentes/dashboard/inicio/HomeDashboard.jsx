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
    icon: "📦",
    bg: "#1a3a2a",
    border: "#22c55e",
    color: "#4ade80",
  },
  bajo_stock: {
    label: "Bajo stock",
    icon: "⚠️",
    bg: "#3a2a10",
    border: "#f59e0b",
    color: "#fbbf24",
  },
  agotado: {
    label: "Agotados",
    icon: "⛔",
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

const CIRCULOS_PEDIDOS = [
  { estado: "en_diseño", label: "En diseño", bg: "#1e2a6e", border: "#4f6ef7", color: "#818cf8" },
  { estado: "pendiente", label: "Pendientes", bg: "#3a2a10", border: "#f59e0b", color: "#fbbf24" },
  { estado: "sin_material", label: "Sin material", bg: "#3a1010", border: "#ef4444", color: "#f87171" },
  { estado: "en_impresion", label: "En impresión", bg: "#1a3a2a", border: "#22c55e", color: "#4ade80" },
  { estado: "terminado", label: "Terminados", bg: "#1e2535", border: "#475569", color: "#94a3b8" },
]

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

  const contarPedidos = (estado) => pedidos.filter((p) => p.estado === estado).length
  const contarNivel = (nivel) => materiales.filter((m) => nivelMaterial(m) === nivel).length

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

  if (cargando) {
    return (
      <div className="hd-loading">
        <div className="hd-spinner" />
        <p>Cargando resumen...</p>
      </div>
    )
  }

  return (
    <div className="hd">
      {/* ── CABECERA ── */}
      <header className="hd-header">
        <div>
          <h1 className="hd-title">
            Bienvenido, <span className="hd-role">{labelRol}</span>
          </h1>
          <p className="hd-date">{ahora}</p>
        </div>
        <button className="hd-refresh" onClick={cargarDatos} title="Actualizar" aria-label="Actualizar">
          <img src="/iconos/actualizar.svg" alt="" 
          className="nav-icon" />
        </button>
      </header>

      <div className="hd-grid">
        {/* ── IZQUIERDA: PEDIDOS ── */}
        <section className="hd-panel hd-pedidos">
          <div className="hd-panel-head">
            <h2>Pedidos</h2>
            <span className="hd-badge">{totalPedidos} en total</span>
          </div>

          <div className="hd-circles">
            {CIRCULOS_PEDIDOS.map(({ estado, label, bg, border, color }) => (
              <div key={estado} className="hd-circle-wrap">
                <div className="hd-circle" style={{ background: bg, border: `2px solid ${border}` }}>
                  <span style={{ color }}>{contarPedidos(estado)}</span>
                </div>
                <span className="hd-circle-label">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── DERECHA: MATERIALES ── */}
        <section className="hd-panel hd-materiales">
          <div className="hd-panel-head">
            <h2>Materiales</h2>
            <span className="hd-badge">{materiales.length} registrados</span>
          </div>

          {/* Resumen clicable */}
          <div className="hd-niveles">
            {Object.entries(NIVELES).map(([nivel, cfg]) => {
              const activo = filtroNivel === nivel
              return (
                <button
                  key={nivel}
                  type="button"
                  className={`hd-nivel ${activo ? "activo" : ""}`}
                  style={{ "--c": cfg.border }}
                  onClick={() => setFiltroNivel(activo ? null : nivel)}
                  title="Clic para filtrar"
                >
                  <span className="hd-nivel-icon" style={{ background: cfg.bg }}>
                    {cfg.icon}
                  </span>
                  <span className="hd-nivel-text">
                    <strong style={{ color: cfg.color }}>{contarNivel(nivel)}</strong>
                    <small>{cfg.label}</small>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Filtros */}
          <div className="hd-toolbar">
            <div className="hd-chips">
              <button
                className={`hd-chip ${filtroTipo === "todos" ? "activo" : ""}`}
                onClick={() => setFiltroTipo("todos")}
              >
                Todos
              </button>
              {tipos.map((t) => (
                <button
                  key={t}
                  className={`hd-chip ${filtroTipo === t ? "activo" : ""}`}
                  onClick={() => setFiltroTipo(t)}
                >
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <button className="hd-orden" onClick={() => setOrden(orden === "nombre" ? "menos" : "nombre")}>
              {orden === "nombre" ? "Orden: nombre" : "Orden: Menos a más"}
            </button>
          </div>

          {/* Lista */}
          {visibles.length === 0 ? (
            <p className="hd-vacio">No hay materiales con ese filtro.</p>
          ) : (
            <div className="hd-items">
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
                  <article
                    key={m.id}
                    className={`hd-item ${abiertoAhora ? "abierto" : ""}`}
                    style={{ borderLeft: `3px solid ${cfg.border}` }}
                    onClick={() => setAbierto(abiertoAhora ? null : m.id)}
                  >
                    <div className="hd-item-top">
                      <div className="hd-item-info">
                        <span className="hd-item-nombre">{m.nombre}</span>
                        <span className="hd-item-tipo">
                          {(m.tipo_material || "").replace(/_/g, " ")}
                          {m.subtipo ? ` · ${m.subtipo}` : ""}
                          {m.grosor ? ` · ${m.grosor} mm` : ""}
                        </span>
                      </div>
                      <span className="hd-item-valor" style={{ color: cfg.color }}>
                        {formatoDisponible(m)}
                      </span>
                    </div>

                    <div className="hd-bar">
                      <div className="hd-bar-fill" style={{ width: `${pct}%`, background: cfg.border }} />
                    </div>
                    <div className="hd-pct">{pct.toFixed(0)}% restante</div>

                    {abiertoAhora && (
                      <div className="hd-detalle">
                        {m.ancho && (
                          <div className="hd-fila">
                            <span>Ancho</span>
                            <span>{m.ancho} cm</span>
                          </div>
                        )}
                        {rollosEq !== null && (
                          <div className="hd-fila">
                            <span>Equivale a</span>
                            <span>≈ {rollosEq.toFixed(2)} rollos de {m.largo} m</span>
                          </div>
                        )}
                        <div className="hd-fila">
                          <span>Área total restante</span>
                          <span>{m2(m.area_disponible_cm2)} m²</span>
                        </div>
                        <div className="hd-fila">
                          <span>Comprado</span>
                          <span>{m.stock} {esRollo ? "rollos" : "planchas"}</span>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default HomeDashboard
