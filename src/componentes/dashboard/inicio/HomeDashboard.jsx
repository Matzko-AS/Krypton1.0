import { useState, useEffect } from "react"
import { supabase } from "../../../supabase/supabaseClient"
import "./HomeDashboard.css"

const HomeDashboard = ({ usuario, rol }) => {
  const [pedidos, setPedidos] = useState([])
  const [materiales, setMateriales] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)

    const [{ data: dataPedidos }, { data: dataMateriales }] = await Promise.all([
      supabase.from("pedidos").select("estado"),
      supabase.from("materiales").select("estado"),
    ])

    if (dataPedidos)  setPedidos(dataPedidos)
    if (dataMateriales) setMateriales(dataMateriales)

    setCargando(false)
  }

  const contarPedidos = (estado) =>
    pedidos.filter((p) => p.estado === estado).length

  const contarMateriales = (estado) =>
    materiales.filter((m) => m.estado === estado).length

  const totalPedidos = pedidos.length

  const ahora = new Date().toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Guayaquil",
  })

  const labelRol = rol === "diseñador" ? "Diseño" : "Taller"

  const circulosPedidos = [
    {
      estado: "en_diseño",
      label: "En diseño",
      bg: "#1e2a6e",
      border: "#4f6ef7",
      color: "#818cf8",
    },
    {
      estado: "pendiente",
      label: "Pendientes",
      bg: "#3a2a10",
      border: "#f59e0b",
      color: "#fbbf24",
    },
    {
      estado: "sin_material",
      label: "Sin material",
      bg: "#3a1010",
      border: "#ef4444",
      color: "#f87171",
    },
    {
      estado: "en_impresion",
      label: "En impresión",
      bg: "#1a3a2a",
      border: "#22c55e",
      color: "#4ade80",
    },
    {
      estado: "terminado",
      label: "Terminados",
      bg: "#1e2535",
      border: "#475569",
      color: "#94a3b8",
    },
  ]

  const cardsMateriales = [
    {
      estado: "disponible",
      label: "Disponibles",
      icon: "ti-package",
      bg: "#1a3a2a",
      border: "#22c55e",
      color: "#4ade80",
    },
    {
      estado: "bajo_stock",
      label: "Bajo stock",
      icon: "ti-alert-triangle",
      bg: "#3a2a10",
      border: "#f59e0b",
      color: "#fbbf24",
    },
    {
      estado: "agotado",
      label: "Agotados",
      icon: "ti-circle-x",
      bg: "#3a1010",
      border: "#ef4444",
      color: "#f87171",
    },
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
          <i className="ti ti-refresh" />
        </button>
      </div>

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

      <section className="home-section">
        <div className="home-section-header">
          <span className="home-section-label">Materiales</span>
          <span className="home-total-badge">{materiales.length} registrados</span>
        </div>

        <div className="home-mat-grid">
          {cardsMateriales.map(({ estado, label, icon, bg, border, color }) => {
            const count = contarMateriales(estado)
            return (
              <div
                key={estado}
                className="mat-card"
                style={{ borderLeft: `3px solid ${border}` }}
              >
                <div className="mat-icon-wrap" style={{ background: bg }}>
                  <i className={`ti ${icon}`} style={{ color }} aria-hidden="true" />
                </div>
                <div>
                  <p className="mat-count" style={{ color }}>{count}</p>
                  <p className="mat-label">{label}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}

export default HomeDashboard
