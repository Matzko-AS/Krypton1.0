import { useState, useMemo } from "react"
import "./Calculadora.css"

// ── Precios base por material ($/m²) ─────────────────────────────────
const PRECIOS_BASE = {
  lona:             { label: "Lona",             precio: 12.00,  laminado: false },
  lona_translucida: { label: "Lona Translúcida", precio: 15.00,  laminado: false },
  vinil:            { label: "Vinil",            precio: 12.00,  precioLaminado: 15.00, laminado: true },
  pvc:              { label: "PVC",              precio: 15.00, precioLaminado: 18.00, laminado: true },
  acrilico:         { label: "Acrílico",         precio: 18.00, laminado: false },
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

// ── Tipos de lápida ($/m²) ───────────────────────────────────────────
const TIPOS_LAPIDA = {
  pvc:            { label: "PVC",            precio: 35.00 },
  acrilico:       { label: "Acrílico",       precio: 50.00 },
  pvc_reflectivo: { label: "PVC Reflectivo", precio: 50.00 },
  porcelanato:    { label: "Porcelanato",    precio: 160.00 },
  marmol:         { label: "Mármol",        precio: 200.00 },
}

const DESCUENTO_VOLUMEN = 0.10

const Calculadora = () => {
  // ── Modo: "material" | "letrero" | "lapida" ──
  const [modo, setModo] = useState("material")

  // ── Estado modo material ──
  const [tipoMaterial, setTipoMaterial] = useState("lona")
  const [conLaminado, setConLaminado] = useState(false)
  const [precioM2, setPrecioM2] = useState(PRECIOS_BASE["lona"].precio)

  // ── Estado modo letrero ──
  const [tipoMarco, setTipoMarco] = useState("madera")
  const [tipoCaraLetrero, setTipoCaraLetrero] = useState("lona")
  const [precioCara, setPrecioCara] = useState(CARAS_LETRERO["lona"].precio)
  const [precioMarco, setPrecioMarco] = useState(MARCOS["madera"].precio)

  // ── Estado modo lápida ──
  const [tipoLapida, setTipoLapida] = useState("pvc")
  const [precioLapida, setPrecioLapida] = useState(TIPOS_LAPIDA["pvc"].precio)

  // ── Compartidos ──
  const [ancho, setAncho] = useState("")
  const [largo, setLargo] = useState("")
  const [cantidad, setCantidad] = useState(1)
  const [historial, setHistorial] = useState([])

  // ─── HANDLERS MODO MATERIAL ─────────────────────────────────────────

  const handleMaterialChange = (tipo) => {
    setTipoMaterial(tipo)
    setConLaminado(false)
    setPrecioM2(PRECIOS_BASE[tipo].precio)
  }

  const handleLaminadoToggle = (checked) => {
    setConLaminado(checked)
    const base = PRECIOS_BASE[tipoMaterial]
    setPrecioM2(checked ? base.precioLaminado : base.precio)
  }

  // ─── HANDLERS MODO LETRERO ──────────────────────────────────────────

  const handleCaraChange = (tipo) => {
    setTipoCaraLetrero(tipo)
    setPrecioCara(CARAS_LETRERO[tipo].precio)
  }

  const handleMarcoChange = (tipo) => {
    setTipoMarco(tipo)
    setPrecioMarco(MARCOS[tipo].precio)
  }

  // ─── HANDLERS MODO LÁPIDA ───────────────────────────────────────────

  const handleLapidaChange = (tipo) => {
    setTipoLapida(tipo)
    setPrecioLapida(TIPOS_LAPIDA[tipo].precio)
  }

  // ─── RESET MODO ─────────────────────────────────────────────────────

  const handleModoChange = (nuevoModo) => {
    setModo(nuevoModo)
    setAncho("")
    setLargo("")
    setCantidad(1)
  }

  // ─── CÁLCULO EN VIVO ────────────────────────────────────────────────

  const calculo = useMemo(() => {
    const a = parseFloat(ancho) || 0
    const l = parseFloat(largo) || 0
    const cant = parseInt(cantidad) || 1
    const areaM2 = (a / 100) * (l / 100)

    let precioUnitario = 0
    let desglose = {}

    if (modo === "material") {
      precioUnitario = parseFloat(precioM2) || 0
      desglose = { tipo: "material" }
    } else if (modo === "letrero") {
      const pc = parseFloat(precioCara) || 0
      const pm = parseFloat(precioMarco) || 0
      precioUnitario = pc + pm
      desglose = { tipo: "letrero", precioCara: pc, precioMarco: pm }
    } else {
      precioUnitario = parseFloat(precioLapida) || 0
      desglose = { tipo: "lapida" }
    }

    const subtotal = areaM2 * precioUnitario * cant
    const aplicaDescuento = cant >= 10
    const descuento = aplicaDescuento ? subtotal * DESCUENTO_VOLUMEN : 0
    const total = subtotal - descuento

    return {
      areaM2,
      precioUnitario,
      subtotal,
      aplicaDescuento,
      descuento,
      total,
      desglose,
      listo: areaM2 > 0 && precioUnitario > 0,
    }
  }, [ancho, largo, cantidad, precioM2, precioCara, precioMarco, precioLapida, modo])

  // ─── GUARDAR EN HISTORIAL ───────────────────────────────────────────

  const guardarCalculo = () => {
    if (!calculo.listo) return
    let descripcion = ""
    if (modo === "material") {
      descripcion = `${PRECIOS_BASE[tipoMaterial].label}${conLaminado ? " + Laminado" : ""}`
    } else if (modo === "letrero") {
      descripcion = `Letrero: ${CARAS_LETRERO[tipoCaraLetrero].label} + ${MARCOS[tipoMarco].label}`
    } else {
      descripcion = `Lápida: ${TIPOS_LAPIDA[tipoLapida].label}`
    }
    const entrada = {
      id: Date.now(),
      descripcion,
      ancho: parseFloat(ancho),
      largo: parseFloat(largo),
      cantidad: parseInt(cantidad),
      area: calculo.areaM2,
      total: calculo.total,
      conDescuento: calculo.aplicaDescuento,
      hora: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
    }
    setHistorial((prev) => [entrada, ...prev].slice(0, 10))
  }

  const limpiarForm = () => {
    setAncho("")
    setLargo("")
    setCantidad(1)
    if (modo === "material") {
      setConLaminado(false)
      setPrecioM2(PRECIOS_BASE[tipoMaterial].precio)
    } else if (modo === "letrero") {
      setPrecioCara(CARAS_LETRERO[tipoCaraLetrero].precio)
      setPrecioMarco(MARCOS[tipoMarco].precio)
    } else {
      setPrecioLapida(TIPOS_LAPIDA[tipoLapida].precio)
    }
  }

  const fmt = (n) =>
    n.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

  // ─── RENDER ─────────────────────────────────────────────────────────

  return (
    <div className="calc-wrapper">

      {/* HEADER */}
      <div className="calc-header">
        <h1 className="calc-title">Calculadora de Precios</h1>
        <p className="calc-subtitle">Calcula el costo por material, dimensiones y cantidad</p>
      </div>

      {/* SELECTOR DE MODO */}
      <div className="modo-tabs">
        <button
          className={`modo-tab ${modo === "material" ? "active" : ""}`}
          onClick={() => handleModoChange("material")}
        >
          Material
        </button>
        <button
          className={`modo-tab ${modo === "letrero" ? "active" : ""}`}
          onClick={() => handleModoChange("letrero")}
        >
          Letrero
        </button>
        <button
          className={`modo-tab ${modo === "lapida" ? "active" : ""}`}
          onClick={() => handleModoChange("lapida")}
        >
          Lápida
        </button>
      </div>

      <div className="calc-body">

        {/* ── PANEL IZQUIERDO ── */}
        <div className="calc-panel calc-panel-inputs">

          {/* ── MODO MATERIAL ── */}
          {modo === "material" && (
            <>
              <div className="calc-section">
                <label className="calc-label">Tipo de Material</label>
                <div className="material-grid">
                  {Object.entries(PRECIOS_BASE).map(([key, mat]) => (
                    <button
                      key={key}
                      className={`material-btn ${tipoMaterial === key ? "active" : ""}`}
                      onClick={() => handleMaterialChange(key)}
                    >
                      {mat.label}
                    </button>
                  ))}
                </div>
              </div>

              {PRECIOS_BASE[tipoMaterial].laminado && (
                <div className="calc-section">
                  <label className="calc-label">Laminado</label>
                  <div className="laminado-toggle">
                    <button
                      className={`laminado-btn ${!conLaminado ? "active" : ""}`}
                      onClick={() => handleLaminadoToggle(false)}
                    >
                      Sin laminado — {fmt(PRECIOS_BASE[tipoMaterial].precio)}/m²
                    </button>
                    <button
                      className={`laminado-btn ${conLaminado ? "active laminado-active" : ""}`}
                      onClick={() => handleLaminadoToggle(true)}
                    >
                      Con laminado — {fmt(PRECIOS_BASE[tipoMaterial].precioLaminado)}/m²
                    </button>
                  </div>
                </div>
              )}

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
                    onClick={() => {
                      const base = PRECIOS_BASE[tipoMaterial]
                      setPrecioM2(conLaminado ? base.precioLaminado : base.precio)
                    }}
                  >↺</button>
                </div>
              </div>
            </>
          )}

          {/* ── MODO LETRERO ── */}
          {modo === "letrero" && (
            <>
              <div className="calc-section">
                <label className="calc-label">Material de la cara</label>
                <div className="laminado-toggle">
                  {Object.entries(CARAS_LETRERO).map(([key, cara]) => (
                    <button
                      key={key}
                      className={`laminado-btn ${tipoCaraLetrero === key ? "active" : ""}`}
                      onClick={() => handleCaraChange(key)}
                    >
                      {cara.label}
                    </button>
                  ))}
                </div>
                <div className="input-prefix-wrap" style={{ marginTop: "8px" }}>
                  <span className="input-prefix">$</span>
                  <input
                    type="number"
                    className="calc-input"
                    min="0"
                    step="0.01"
                    value={precioCara}
                    onChange={(e) => setPrecioCara(e.target.value)}
                  />
                  <button
                    className="btn-reset-precio"
                    title="Restaurar precio base"
                    onClick={() => setPrecioCara(CARAS_LETRERO[tipoCaraLetrero].precio)}
                  >↺</button>
                </div>
              </div>

              <div className="calc-section">
                <label className="calc-label">Tipo de marco</label>
                <div className="material-grid">
                  {Object.entries(MARCOS).map(([key, marco]) => (
                    <button
                      key={key}
                      className={`material-btn ${tipoMarco === key ? "active" : ""}`}
                      onClick={() => handleMarcoChange(key)}
                    >
                      {marco.label}
                    </button>
                  ))}
                </div>
                <div className="input-prefix-wrap" style={{ marginTop: "8px" }}>
                  <span className="input-prefix">$</span>
                  <input
                    type="number"
                    className="calc-input"
                    min="0"
                    step="0.01"
                    value={precioMarco}
                    onChange={(e) => setPrecioMarco(e.target.value)}
                  />
                  <button
                    className="btn-reset-precio"
                    title="Restaurar precio base"
                    onClick={() => setPrecioMarco(MARCOS[tipoMarco].precio)}
                  >↺</button>
                </div>
              </div>
            </>
          )}

          {/* ── MODO LÁPIDA ── */}
          {modo === "lapida" && (
            <>
              <div className="calc-section">
                <label className="calc-label">Tipo de Lápida</label>
                <div className="material-grid">
                  {Object.entries(TIPOS_LAPIDA).map(([key, lapida]) => (
                    <button
                      key={key}
                      className={`material-btn ${tipoLapida === key ? "active" : ""}`}
                      onClick={() => handleLapidaChange(key)}
                    >
                      {lapida.label}
                    </button>
                  ))}
                </div>
              </div>

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
                    value={precioLapida}
                    onChange={(e) => setPrecioLapida(e.target.value)}
                  />
                  <button
                    className="btn-reset-precio"
                    title="Restaurar precio base"
                    onClick={() => setPrecioLapida(TIPOS_LAPIDA[tipoLapida].precio)}
                  >↺</button>
                </div>
              </div>
            </>
          )}

          {/* ── DIMENSIONES (compartido) ── */}
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

          {/* CANTIDAD */}
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

          {/* BOTONES */}
          <div className="calc-actions">
            <button className="btn-guardar-calc" onClick={guardarCalculo} disabled={!calculo.listo}>
              Guardar en historial
            </button>
            <button className="btn-limpiar-calc" onClick={limpiarForm}>
              Limpiar
            </button>
          </div>
        </div>

        {/* ── PANEL DERECHO: RESULTADO ── */}
        <div className="calc-panel calc-panel-result">

          {/* Resumen del producto */}
          <div className="result-card">
            <p className="result-label">
              {modo === "material" ? "Material seleccionado" : modo === "letrero" ? "Letrero" : "Lápida"}
            </p>
            {modo === "material" && (
              <p className="result-material">
                {PRECIOS_BASE[tipoMaterial].label}
                {PRECIOS_BASE[tipoMaterial].laminado && (
                  <span className={`laminado-badge ${conLaminado ? "con" : "sin"}`}>
                    {conLaminado ? "Con laminado" : "Sin laminado"}
                  </span>
                )}
              </p>
            )}
            {modo === "letrero" && (
              <p className="result-material">
                {CARAS_LETRERO[tipoCaraLetrero].label}
                <span className="laminado-badge con">{MARCOS[tipoMarco].label}</span>
              </p>
            )}
            {modo === "lapida" && (
              <p className="result-material">
                {TIPOS_LAPIDA[tipoLapida].label}
              </p>
            )}
          </div>

          {/* Desglose */}
          <div className="result-breakdown">
            {modo === "letrero" && (
              <>
                <div className="breakdown-row">
                  <span>Precio cara (lona)</span>
                  <span>{fmt(parseFloat(precioCara) || 0)}/m²</span>
                </div>
                <div className="breakdown-row">
                  <span>Precio marco ({MARCOS[tipoMarco].label})</span>
                  <span>{fmt(parseFloat(precioMarco) || 0)}/m²</span>
                </div>
                <div className="breakdown-row" style={{ fontWeight: 600 }}>
                  <span>Precio total/m²</span>
                  <span>{fmt(calculo.precioUnitario)}</span>
                </div>
              </>
            )}
            {(modo === "material" || modo === "lapida") && (
              <div className="breakdown-row">
                <span>Precio / m²</span>
                <span>
                  {calculo.precioUnitario > 0 ? fmt(calculo.precioUnitario) : "—"}
                </span>
              </div>
            )}
            <div className="breakdown-row">
              <span>Área total</span>
              <span>{calculo.areaM2 > 0 ? `${calculo.areaM2.toFixed(4)} m²` : "—"}</span>
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
                      <span className="hist-material">{h.descripcion}</span>
                      <span className="hist-dims">
                        {h.ancho}×{h.largo} cm · ×{h.cantidad}
                        {h.conDescuento && " · desc."}
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
