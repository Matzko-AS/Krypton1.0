import { useState, useEffect } from "react"
import { supabase } from "../supabase/supabaseClient"
import "./BlockchainViewer.css"

const BlockchainViewer = () => {
  const [bloques, setBloques] = useState([])
  const [cargando, setCargando] = useState(true)
  const [verificacion, setVerificacion] = useState(null)
  const [verificando, setVerificando] = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [timeline, setTimeline] = useState({})
  const [cargandoTimeline, setCargandoTimeline] = useState(null)

  useEffect(() => {
    cargarBloques()
  }, [])

  const cargarBloques = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from("historial")
      .select("*, usuarios(nombre)")
      .order("numero_bloque", { ascending: false })
    if (!error) setBloques(data || [])
    setCargando(false)
  }

  const cargarTimeline = async (entidad_id, bloqueId) => {
    if (timeline[bloqueId]) return
    setCargandoTimeline(bloqueId)
    const { data } = await supabase
      .from("historial")
      .select("*, usuarios(nombre)")
      .eq("entidad_id", entidad_id)
      .order("numero_bloque", { ascending: true })
    setTimeline((prev) => ({ ...prev, [bloqueId]: data || [] }))
    setCargandoTimeline(null)
  }

  const toggleExpandir = async (bloque) => {
    if (expandido === bloque.id) {
      setExpandido(null)
      return
    }
    setExpandido(bloque.id)
    await cargarTimeline(bloque.entidad_id, bloque.id)
  }

  const generarHash = async (texto) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(texto)
    const buffer = await crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  const verificarCadena = async () => {
    setVerificando(true)
    setVerificacion(null)
    const bloquesOrdenados = [...bloques].sort((a, b) => a.numero_bloque - b.numero_bloque)
    let valida = true
    let bloqueRoto = null

    for (let i = 0; i < bloquesOrdenados.length; i++) {
      const bloque = bloquesOrdenados[i]
      const hashRecalculado = await generarHash(bloque.datos + bloque.hash_anterior)
      if (hashRecalculado !== bloque.hash_integridad) {
        valida = false
        bloqueRoto = bloque.numero_bloque
        break
      }
      if (i > 0 && bloque.hash_anterior !== bloquesOrdenados[i - 1].hash_integridad) {
        valida = false
        bloqueRoto = bloque.numero_bloque
        break
      }
    }

    setVerificacion({ valida, bloqueRoto })
    setVerificando(false)
  }

  const colorAccion = (accion) => {
    const colores = {
      terminado: "#22c55e",
      aprobado: "#4f6ef7",
      eliminado: "#ef4444",
      creado: "#f59e0b",
      actualizado: "#8b5cf6",
      diseno_subido: "#06b6d4",
      rechazado: "#f97316",
    }
    return colores[accion] || "#94a3b8"
  }

  const iconoAccion = (accion) => {
    const iconos = {
      terminado: "✅",
      aprobado: "👍",
      eliminado: "🗑️",
      creado: "🆕",
      actualizado: "✏️",
      diseno_subido: "🎨",
      rechazado: "❌",
    }
    return iconos[accion] || "📌"
  }

  const parsearDatos = (datos) => {
    try { return JSON.parse(datos) }
    catch { return {} }
  }

  return (
    <div className="bc-wrapper">

      {/* HEADER */}
      <div className="bc-header">
        <div>
          <h1 className="bc-title">🔗 Cadena de Bloques</h1>
          <p className="bc-subtitle">
            Registro inmutable de operaciones — {bloques.length} bloque{bloques.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="bc-header-actions">
          <button
            className="bc-btn-verificar"
            onClick={verificarCadena}
            disabled={verificando || bloques.length === 0}
          >
            {verificando ? "Verificando..." : "🔍 Verificar integridad"}
          </button>
          <button className="bc-btn-refrescar" onClick={cargarBloques}>
            ↺ Refrescar
          </button>
        </div>
      </div>

      {/* RESULTADO VERIFICACIÓN */}
      {verificacion && (
        <div className={`bc-verificacion ${verificacion.valida ? "valida" : "invalida"}`}>
          {verificacion.valida
            ? "✅ Cadena íntegra — ningún bloque ha sido alterado"
            : `❌ Cadena comprometida — bloque #${verificacion.bloqueRoto} fue alterado`}
        </div>
      )}

      {/* CADENA */}
      {cargando ? (
        <p className="bc-empty">Cargando bloques...</p>
      ) : bloques.length === 0 ? (
        <p className="bc-empty">No hay bloques registrados aún.</p>
      ) : (
        <div className="bc-cadena">
          {bloques.map((bloque, index) => {
            const datos = parsearDatos(bloque.datos)
            const estaExpandido = expandido === bloque.id
            const timelineBloque = timeline[bloque.id] || []

            return (
              <div key={bloque.id} className="bc-bloque-wrap">

                {/* BLOQUE */}
                <div className={`bc-bloque ${estaExpandido ? "expandido" : ""}`}>

                  {/* HEADER BLOQUE */}
                  <div className="bc-bloque-header">
                    <div className="bc-bloque-header-left">
                      <span className="bc-numero">Bloque #{bloque.numero_bloque}</span>
                      <span
                        className="bc-accion-badge"
                        style={{ background: colorAccion(bloque.accion) }}
                      >
                        {iconoAccion(bloque.accion)} {bloque.accion}
                      </span>
                      <span className="bc-entidad-tag">{bloque.entidad}</span>
                    </div>
                    <button
                      className="bc-btn-expandir"
                      onClick={() => toggleExpandir(bloque)}
                    >
                      {estaExpandido ? "▲ Cerrar" : "▼ Ver detalles"}
                    </button>
                  </div>

                  {/* INFO BÁSICA */}
                  <div className="bc-bloque-body">
                    <div className="bc-campo">
                      <span className="bc-campo-label">Usuario</span>
                      <span className="bc-campo-valor">{bloque.usuarios?.nombre ?? "—"}</span>
                    </div>
                    <div className="bc-campo">
                      <span className="bc-campo-label">Timestamp</span>
                      <span className="bc-campo-valor">
                        {new Date().toLocaleString()}
                      </span>
                    </div>
                    {datos.cliente_nombre && (
                      <div className="bc-campo">
                        <span className="bc-campo-label">Cliente</span>
                        <span className="bc-campo-valor">{datos.cliente_nombre}</span>
                      </div>
                    )}
                    {datos.nombre && (
                      <div className="bc-campo">
                        <span className="bc-campo-label">Material</span>
                        <span className="bc-campo-valor">{datos.nombre}</span>
                      </div>
                    )}
                  </div>

                  {/* HASHES RESUMIDOS */}
                  <div className="bc-bloque-hashes">
                    <div className="bc-hash-row">
                      <span className="bc-hash-label">Hash anterior</span>
                      <span className="bc-hash-valor atras">
                        {bloque.hash_anterior?.slice(0, 20)}...
                      </span>
                    </div>
                    <div className="bc-hash-row">
                      <span className="bc-hash-label">Hash propio</span>
                      <span className="bc-hash-valor propio">
                        {bloque.hash_integridad?.slice(0, 20)}...
                      </span>
                    </div>
                  </div>

                  {/* PANEL EXPANDIDO */}
                  {estaExpandido && (
                    <div className="bc-expandido-panel">

                      {/* HASHES COMPLETOS */}
                      <div className="bc-expandido-seccion">
                        <h4 className="bc-expandido-titulo">Hashes completos</h4>
                        <div className="bc-hash-completo-row">
                          <span className="bc-hash-label">Hash anterior</span>
                          <span className="bc-hash-valor atras full">{bloque.hash_anterior}</span>
                        </div>
                        <div className="bc-hash-completo-row">
                          <span className="bc-hash-label">Hash propio</span>
                          <span className="bc-hash-valor propio full">{bloque.hash_integridad}</span>
                        </div>
                      </div>

                      {/* DATOS JSON */}
                      <div className="bc-expandido-seccion">
                        <h4 className="bc-expandido-titulo"> Datos del bloque</h4>
                        <div className="bc-json">
                          {Object.entries(datos).map(([key, val]) => (
                            <div key={key} className="bc-json-row">
                              <span className="bc-json-key">{key}</span>
                              <span className="bc-json-val">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* TIMELINE */}
                      <div className="bc-expandido-seccion">
                        <h4 className="bc-expandido-titulo"> Historial de esta entidad</h4>
                        {cargandoTimeline === bloque.id ? (
                          <p className="bc-empty">Cargando historial...</p>
                        ) : timelineBloque.length === 0 ? (
                          <p className="bc-empty">Sin historial adicional.</p>
                        ) : (
                          <div className="bc-timeline">
                            {timelineBloque.map((evento, i) => (
                              <div key={evento.id} className="bc-timeline-item">
                                <div className="bc-timeline-left">
                                  <div
                                    className="bc-timeline-dot"
                                    style={{ background: colorAccion(evento.accion) }}
                                  />
                                  {i < timelineBloque.length - 1 && (
                                    <div className="bc-timeline-linea" />
                                  )}
                                </div>
                                <div className="bc-timeline-content">
                                  <div className="bc-timeline-accion">
                                    <span
                                      className="bc-accion-badge small"
                                      style={{ background: colorAccion(evento.accion) }}
                                    >
                                      {iconoAccion(evento.accion)} {evento.accion}
                                    </span>
                                    {evento.id === bloque.id && (
                                      <span className="bc-timeline-actual">← este bloque</span>
                                    )}
                                  </div>
                                  <span className="bc-timeline-meta">
                                    {evento.usuarios?.nombre ?? "—"} · {new Date().toLocaleString()}
                                  </span>
                                  <span className="bc-timeline-hash">
                                    #{evento.numero_bloque} · {evento.hash_integridad?.slice(0, 16)}...
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>

                {/* CONECTOR entre bloques */}
                {index < bloques.length - 1 && (
                  <div className="bc-conector">
                    <div className="bc-conector-linea" />
                    <span className="bc-conector-flecha">⬇</span>
                    <div className="bc-conector-linea" />
                  </div>
                )}

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default BlockchainViewer