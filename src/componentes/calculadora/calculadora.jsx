import { useState, useMemo } from "react"
import "./Calculadora.css"

const PRECIOS_BASE = {
  lona:            4.50,
  lona_translucida: 6.00,
  vinil:           8.00,
  pvc:            15.00,
  acrilico:       18.00,
  laminacion:      3.50,
}

const LABELS_MATERIAL = {
  lona:            "Lona",
  lona_translucida: "Lona Translúcida",
  vinil:           "Vinil",
  pvc:             "PVC",
  acrilico:        "Acrílico",
  laminacion:      "Laminación",
}

const DESCUENTO_VOLUMEN = 0.10 // 10% si cantidad > 10

const Calculadora = () => {
  const [tipoMaterial, setTipoMaterial] = useState("lona")
  const [precioM2, setPrecioM2] = useState(PRECIOS_BASE["lona"])
  const [ancho, setAncho] = useState("")       // en cm
  const [largo, setLargo] = useState("")       // en cm
  const [cantidad, setCantidad] = useState(1)
  const [historial, setHistorial] = useState([])

  // ── Cuando cambia el material, actualiza precio base ──
  const handleMaterialChange = (tipo) => {
    setTipoMaterial(tipo)
    setPrecioM2(PRECIOS_BASE[tipo])
  }

  // ── Cálculo en vivo ──
  const calculo = useMemo(() => {
    const a = parseFloat(ancho) || 0
    const l = parseFloat(largo) || 0
    const cant = parseInt(cantidad) || 1
    const precio = parseFloat(precioM2) || 0

    const areaM2 = (a / 100) * (l / 100)
    const subtotal = areaM2 * precio * cant
    const aplicaDescuento = cant > 10
    const descuento = aplicaDescuento ? subtotal * DESCUENTO_VOLUMEN : 0
    const total = subtotal - descuento

    return { areaM2, subtotal, aplicaDescuento, descuento, total, listo: areaM2 > 0 && precio > 0 }
  }, [ancho, largo, cantidad, precioM2])

  // ── Guardar en historial local ──
  const guardarCalculo = () => {
    if (!calculo.listo) return
    const entrada = {
      id: Date.now(),
      material: LABELS_MATERIAL[tipoMaterial],
      ancho: parseFloat(ancho),
      largo: parseFloat(largo),
      cantidad: parseInt(cantidad),
      precioM2: parseFloat(precioM2),
      area: calculo.areaM2,
      total: calculo.total,
      descuento: calculo.aplicaDescuento,
      hora: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
    }
    setHistorial((prev) => [entrada, ...prev].slice(0, 10))
  }

  const limpiarForm = () => {
    setAncho("")
    setLargo("")
    setCantidad(1)
    setPrecioM2(PRECIOS_BASE[tipoMaterial])
  }

  const fmt = (n) =>
    n.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

  return (
    <div className="calc-wrapper">

      {/* ── HEADER ── */}
      <div className="calc-header">
        <h1 className="calc-title">Calculadora de Precios</h1>
        <p className="calc-subtitle">Calcula el costo por material, dimensiones y cantidad</p>
      </div>

      <div className="calc-body">

        {/* ── PANEL IZQUIERDO: INPUTS ── */}
        <div className="calc-panel calc-panel-inputs">

          {/* Selector de material */}
          <div className="calc-section">
            <label className="calc-label">Tipo de Material</label>
            <div className="material-grid">
              {Object.entries(LABELS_MATERIAL).map(([key, label]) => (
                <button
                  key={key}
                  className={`material-btn ${tipoMaterial === key ? "active" : ""}`}
                  onClick={() => handleMaterialChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Precio por m² editable */}
          <div className="calc-section">
            <label className="calc-label">
              Precio por m²
              <span className="calc-hint">— editable</span>
            </label>
            <div className="input-prefix-wrap">
              <span className="input-prefix">$</span>
              <input
                type="number"
                className="calc-input"
                min="0"
                step="0.01"
                value={precioM2}
                onChange={(e) => setPrecioM2(e.target.value)}
              />
              <button
                className="btn-reset-precio"
                title="Restaurar precio base"
                onClick={() => setPrecioM2(PRECIOS_BASE[tipoMaterial])}
              >
                ↺
              </button>
            </div>
          </div>

          {/* Dimensiones */}
          <div className="calc-section">
            <label className="calc-label">Dimensiones (cm)</label>
            <div className="dims-row">
              <div className="dim-field">
                <span className="dim-tag">Ancho</span>
                <input
                  type="number"
                  className="calc-input"
                  placeholder="ej: 200"
                  min="0"
                  value={ancho}
                  onChange={(e) => setAncho(e.target.value)}
                />
              </div>
              <span className="dim-x">×</span>
              <div className="dim-field">
                <span className="dim-tag">Largo</span>
                <input
                  type="number"
                  className="calc-input"
                  placeholder="ej: 300"
                  min="0"
                  value={largo}
                  onChange={(e) => setLargo(e.target.value)}
                />
              </div>
            </div>
            {calculo.areaM2 > 0 && (
              <span className="area-preview">
                Área: <strong>{calculo.areaM2.toFixed(4)} m²</strong>
              </span>
            )}
          </div>

          {/* Cantidad */}
          <div className="calc-section">
            <label className="calc-label">Cantidad</label>
            <input
              type="number"
              className="calc-input"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
            {parseInt(cantidad) > 10 && (
              <span className="descuento-tag">✅ Aplica descuento por volumen (10%)</span>
            )}
          </div>

          {/* Botones */}
          <div className="calc-actions">
            <button
              className="btn-guardar-calc"
              onClick={guardarCalculo}
              disabled={!calculo.listo}
            >
              Guardar en historial
            </button>
            <button className="btn-limpiar-calc" onClick={limpiarForm}>
              Limpiar
            </button>
          </div>
        </div>

        {/* ── PANEL DERECHO: RESULTADO ── */}
        <div className="calc-panel calc-panel-result">

          <div className="result-card">
            <p className="result-label">Material seleccionado</p>
            <p className="result-material">{LABELS_MATERIAL[tipoMaterial]}</p>
          </div>

          <div className="result-breakdown">
            <div className="breakdown-row">
              <span>Área total</span>
              <span>{calculo.areaM2 > 0 ? `${calculo.areaM2.toFixed(4)} m²` : "—"}</span>
            </div>
            <div className="breakdown-row">
              <span>Precio / m²</span>
              <span>{precioM2 > 0 ? fmt(parseFloat(precioM2)) : "—"}</span>
            </div>
            <div className="breakdown-row">
              <span>Cantidad</span>
              <span>{cantidad}</span>
            </div>
            <div className="breakdown-row">
              <span>Subtotal</span>
              <span>{calculo.listo ? fmt(calculo.subtotal) : "—"}</span>
            </div>
            {calculo.aplicaDescuento && (
              <div className="breakdown-row descuento-row">
                <span>Descuento volumen (10%)</span>
                <span>− {fmt(calculo.descuento)}</span>
              </div>
            )}
            <div className="breakdown-divider" />
            <div className="breakdown-row total-row">
              <span>TOTAL</span>
              <span className="total-value">
                {calculo.listo ? fmt(calculo.total) : "$0.00"}
              </span>
            </div>
          </div>

          {/* Historial */}
          {historial.length > 0 && (
            <div className="historial-section">
              <div className="historial-header">
                <p className="historial-titulo">Historial de cálculos</p>
                <button className="btn-limpiar-hist" onClick={() => setHistorial([])}>
                  Limpiar
                </button>
              </div>
              <div className="historial-lista">
                {historial.map((h) => (
                  <div key={h.id} className="historial-item">
                    <div className="hist-info">
                      <span className="hist-material">{h.material}</span>
                      <span className="hist-dims">
                        {h.ancho}×{h.largo} cm · ×{h.cantidad}
                        {h.descuento && " · desc."}
                      </span>
                    </div>
                    <div className="hist-right">
                      <span className="hist-total">{fmt(h.total)}</span>
                      <span className="hist-hora">{h.hora}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default Calculadora
