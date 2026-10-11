import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "../../../supabase/supabaseClient"
import "./contabilidad.css"
import "./selectorFecha.css"

// ── Fechas en hora LOCAL (toISOString usa UTC y en Ecuador, después de las
//    19:00, devolvía el día siguiente) ───────────────────────────────────
const aISO = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
const hoyISO = () => aISO(new Date())
const parseISO = (s) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
const primerDia = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
const sumarDiasISO = (iso, n) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return aISO(d)
}

const fmt = (n) =>
  Number(n).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  })

const hora = (iso) =>
  new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })

const fechaCorta = (iso) =>
  parseISO(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })

const fechaMedia = (iso) =>
  parseISO(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" })

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// ── Períodos de exportación (semana = lunes a domingo) ───────────────
const rangoPeriodo = (base, periodo) => {
  const d = parseISO(base)
  if (periodo === "dia") return { desde: base, hasta: base }
  if (periodo === "semana") {
    const desdeLunes = (d.getDay() + 6) % 7
    const ini = new Date(d)
    ini.setDate(d.getDate() - desdeLunes)
    const fin = new Date(ini)
    fin.setDate(ini.getDate() + 6)
    return { desde: aISO(ini), hasta: aISO(fin) }
  }
  return {
    desde: aISO(new Date(d.getFullYear(), d.getMonth(), 1)),
    hasta: aISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  }
}

const tituloRango = (rango, periodo) => {
  if (periodo === "dia")
    return parseISO(rango.desde).toLocaleDateString("es-EC", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    })
  if (periodo === "semana")
    return `Semana del ${fechaMedia(rango.desde)} al ${fechaMedia(rango.hasta)}`
  return parseISO(rango.desde).toLocaleDateString("es-EC", { month: "long", year: "numeric" })
}

const nombreArchivo = (rango, periodo) => {
  if (periodo === "dia") return `contabilidad_dia_${rango.desde}`
  if (periodo === "semana") return `contabilidad_semana_${rango.desde}_a_${rango.hasta}`
  return `contabilidad_mes_${rango.desde.slice(0, 7)}`
}

const sumar = (filas) => {
  const ventas = filas.filter((r) => r.tipo === "venta").reduce((s, r) => s + Number(r.monto), 0)
  const gastos = filas.filter((r) => r.tipo === "gasto").reduce((s, r) => s + Number(r.monto), 0)
  return { ventas, gastos, neta: ventas - gastos }
}

const resumenPorDia = (filas) => {
  const mapa = {}
  filas.forEach((r) => {
    ;(mapa[r.fecha] = mapa[r.fecha] || []).push(r)
  })
  return Object.keys(mapa)
    .sort()
    .map((fecha) => ({ fecha, ...sumar(mapa[fecha]) }))
}

// Trae todos los movimientos del rango (pagina de 1000 en 1000)
const obtenerRango = async ({ desde, hasta }) => {
  const filas = []
  const tam = 1000
  for (let ini = 0; ; ini += tam) {
    const { data, error } = await supabase
      .from("contabilidad")
      .select(
        `id, tipo, descripcion, monto, fecha, created_at,
         cliente_nombre, cliente_contacto, usuarios ( nombre )`
      )
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true })
      .range(ini, ini + tam - 1)
    if (error) throw error
    filas.push(...data)
    if (data.length < tam) break
  }
  return filas
}

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

// ── Cierra un popover al hacer clic fuera o con Esc ──────────────────
const useCerrarFuera = (ref, activo, cerrar) => {
  useEffect(() => {
    if (!activo) return
    const fuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) cerrar()
    }
    const tecla = (e) => e.key === "Escape" && cerrar()
    document.addEventListener("mousedown", fuera)
    document.addEventListener("keydown", tecla)
    return () => {
      document.removeEventListener("mousedown", fuera)
      document.removeEventListener("keydown", tecla)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo])
}

// ── Selector de fecha con calendario ─────────────────────────────────
const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"]

const SelectorFecha = ({ valor, max, onChange, titulo }) => {
  const [abierto, setAbierto] = useState(false)
  const [mes, setMes] = useState(() => primerDia(parseISO(valor)))
  const [marcas, setMarcas] = useState({})
  const ref = useRef(null)

  useCerrarFuera(ref, abierto, () => setAbierto(false))

  // Marca los días del mes visible que tienen movimientos
  useEffect(() => {
    if (!abierto) return
    let cancelado = false
    const desde = aISO(mes)
    const hasta = aISO(new Date(mes.getFullYear(), mes.getMonth() + 1, 0))
    supabase
      .from("contabilidad")
      .select("fecha, tipo")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .limit(1000)
      .then(({ data }) => {
        if (cancelado) return
        const m = {}
        ;(data || []).forEach((r) => {
          m[r.fecha] = m[r.fecha] || {}
          m[r.fecha][r.tipo] = true
        })
        setMarcas(m)
      })
    return () => {
      cancelado = true
    }
  }, [abierto, mes])

  const alternar = () => {
    if (!abierto) setMes(primerDia(parseISO(valor)))
    setAbierto((v) => !v)
  }

  const elegir = (iso) => {
    onChange(iso)
    setAbierto(false)
  }

  const hoy = hoyISO()
  const y = mes.getFullYear()
  const m = mes.getMonth()
  const huecos = (mes.getDay() + 6) % 7
  const celdas = [
    ...Array(huecos).fill(null),
    ...Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => aISO(new Date(y, m, i + 1))),
  ]
  const siguienteBloqueado = aISO(new Date(y, m + 1, 1)) > max

  const atajos = [
    ["Hoy", hoy],
    ["Ayer", sumarDiasISO(hoy, -1)],
    ["Hace 7 días", sumarDiasISO(hoy, -7)],
    ["Inicio de mes", hoy.slice(0, 8) + "01"],
  ]

  return (
    <div className="ct-sel" ref={ref}>
      <button
        type="button"
        className="ct-sel-btn"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={abierto}
      >
        <span className="ct-sel-text">
          <span className="ct-sel-title">{titulo}</span>
          <span className="ct-sel-sub">{fechaMedia(valor)}</span>
        </span>
        <span className="ct-sel-caret" aria-hidden="true">▾</span>
      </button>

      {abierto && (
        <div className="ct-cal" role="dialog" aria-label="Elegir fecha">
          <div className="ct-cal-chips">
            {atajos.map(([etiqueta, iso]) => (
              <button
                key={etiqueta}
                type="button"
                className={`ct-chip ${valor === iso ? "on" : ""}`}
                onClick={() => elegir(iso)}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          <div className="ct-cal-head">
            <button
              type="button"
              className="ct-cal-nav"
              onClick={() => setMes(new Date(y, m - 1, 1))}
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <span className="ct-cal-mes">
              {mes.toLocaleDateString("es-EC", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              className="ct-cal-nav"
              onClick={() => setMes(new Date(y, m + 1, 1))}
              disabled={siguienteBloqueado}
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          <div className="ct-cal-grid">
            {DIAS_SEMANA.map((d, i) => (
              <span key={i} className="ct-cal-dow">{d}</span>
            ))}
            {celdas.map((iso, i) =>
              iso === null ? (
                <span key={`v${i}`} />
              ) : (
                <button
                  key={iso}
                  type="button"
                  className={`ct-cal-day ${iso === valor ? "sel" : ""} ${iso === hoy ? "hoy" : ""}`}
                  disabled={iso > max}
                  onClick={() => elegir(iso)}
                >
                  {Number(iso.slice(8))}
                  <span className="ct-dots" aria-hidden="true">
                    {marcas[iso]?.venta && <i className="venta" />}
                    {marcas[iso]?.gasto && <i className="gasto" />}
                  </span>
                </button>
              )
            )}
          </div>

          <p className="ct-cal-leyenda">
            <i className="venta" /> Con ventas <i className="gasto" /> Con gastos
          </p>
        </div>
      )}
    </div>
  )
}

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
  const [periodoExport, setPeriodoExport] = useState("dia")
  const [exportando, setExportando] = useState(false)
  const [errorExport, setErrorExport] = useState("")
  const exportRef = useRef(null)

  useCerrarFuera(exportRef, menuExport, () => setMenuExport(false))

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
  const totales = useMemo(() => sumar(registros), [registros])

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
  const cambiarFecha = (dias) => setFechaVista(sumarDiasISO(fechaVista, dias))

  const labelFecha = () => {
    if (esHoy) return "Hoy"
    if (fechaVista === sumarDiasISO(hoyISO(), -1)) return "Ayer"
    return parseISO(fechaVista).toLocaleDateString("es-EC", { weekday: "long" })
  }

  // ── Exportar (día / semana / mes) ──────────────────────────────────
  const rangoExport = rangoPeriodo(fechaVista, periodoExport)
  const etiquetaRangoExport =
    periodoExport === "dia"
      ? fechaMedia(rangoExport.desde)
      : `${fechaMedia(rangoExport.desde)} – ${fechaMedia(rangoExport.hasta)}`

  const descargarCSV = (filas, rango, periodo) => {
    const celda = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const t = sumar(filas)
    const salida = []

    salida.push([celda(`Contabilidad Krypton — ${tituloRango(rango, periodo)}`)])
    salida.push([])

    if (periodo !== "dia") {
      salida.push(["Fecha", "Ventas", "Gastos", "Neto"].map(celda))
      resumenPorDia(filas).forEach((d) =>
        salida.push([
          fechaCorta(d.fecha),
          d.ventas.toFixed(2),
          d.gastos.toFixed(2),
          d.neta.toFixed(2),
        ].map(celda))
      )
      salida.push([])
    }

    salida.push(["Fecha", "Hora", "Tipo", "Descripción", "Cliente", "Contacto", "Monto", "Usuario"].map(celda))
    filas.forEach((r) =>
      salida.push([
        fechaCorta(r.fecha),
        hora(r.created_at),
        r.tipo === "venta" ? "Venta" : "Gasto",
        r.descripcion,
        r.cliente_nombre ?? "",
        r.cliente_contacto ?? "",
        Number(r.monto).toFixed(2),
        r.usuarios?.nombre ?? "",
      ].map(celda))
    )
    salida.push([])
    salida.push([celda("Total ventas"), "", "", "", "", "", t.ventas.toFixed(2)])
    salida.push([celda("Total gastos"), "", "", "", "", "", t.gastos.toFixed(2)])
    salida.push([celda("Ganancia neta"), "", "", "", "", "", t.neta.toFixed(2)])

    const csv = "\uFEFF" + salida.map((f) => f.join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${nombreArchivo(rango, periodo)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const imprimirPDF = (ventana, filas, rango, periodo) => {
    const t = sumar(filas)

    const resumenHtml =
      periodo === "dia"
        ? ""
        : `<h2>Resumen por día</h2>
           <table><thead><tr><th>Fecha</th><th>Ventas</th><th>Gastos</th><th>Neto</th></tr></thead>
           <tbody>${resumenPorDia(filas)
             .map(
               (d) => `<tr><td>${fechaCorta(d.fecha)}</td>
                 <td class="n">${fmt(d.ventas)}</td><td class="n">${fmt(d.gastos)}</td>
                 <td class="n">${fmt(d.neta)}</td></tr>`
             )
             .join("")}</tbody></table>`

    const filasHtml = filas
      .map(
        (r) => `<tr>
          <td>${fechaCorta(r.fecha)}</td>
          <td>${hora(r.created_at)}</td>
          <td>${r.tipo === "venta" ? "Venta" : "Gasto"}</td>
          <td>${esc(r.descripcion)}</td>
          <td class="n">${r.tipo === "gasto" ? "-" : ""}${fmt(r.monto)}</td>
          <td>${esc(r.usuarios?.nombre ?? "—")}</td>
        </tr>`
      )
      .join("")

    ventana.document.write(`<html><head><title>${esc(nombreArchivo(rango, periodo))}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin-bottom:4px} h2{font-size:14px;margin:18px 0 8px}
        p.sub{color:#666;margin-bottom:20px;text-transform:capitalize}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th,td{border:1px solid #ccc;padding:6px 10px;font-size:12px;text-align:left}
        th{background:#f0f0f0} td.n{text-align:right} .tot td{font-weight:bold}
      </style></head><body>
      <h1>Resumen de contabilidad — Krypton</h1>
      <p class="sub">${esc(tituloRango(rango, periodo))}</p>
      ${resumenHtml}
      <h2>Movimientos</h2>
      <table><thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Descripción</th><th>Monto</th><th>Usuario</th></tr></thead>
      <tbody>${filasHtml}</tbody></table>
      <table class="tot">
        <tr><td>Total ventas</td><td class="n">${fmt(t.ventas)}</td></tr>
        <tr><td>Total gastos</td><td class="n">${fmt(t.gastos)}</td></tr>
        <tr><td>Ganancia neta</td><td class="n">${fmt(t.neta)}</td></tr>
      </table></body></html>`)
    ventana.document.close()
    ventana.focus()
    ventana.print()
  }

  const exportar = async (formato) => {
    setErrorExport("")
    const rango = rangoPeriodo(fechaVista, periodoExport)

    // La ventana del PDF se abre ya, dentro del clic, para que el navegador no la bloquee
    let ventana = null
    if (formato === "pdf") {
      ventana = window.open("", "_blank")
      if (!ventana) {
        setErrorExport("El navegador bloqueó la ventana. Permite las ventanas emergentes.")
        return
      }
    }

    setExportando(true)
    try {
      const filas = await obtenerRango(rango)
      if (filas.length === 0) {
        ventana?.close()
        setErrorExport("No hay movimientos en este período.")
        return
      }
      if (formato === "csv") descargarCSV(filas, rango, periodoExport)
      else imprimirPDF(ventana, filas, rango, periodoExport)
      setMenuExport(false)
    } catch (e) {
      ventana?.close()
      setErrorExport("No se pudo exportar: " + e.message)
    } finally {
      setExportando(false)
    }
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
          <SelectorFecha
            valor={fechaVista}
            max={hoyISO()}
            onChange={setFechaVista}
            titulo={labelFecha()}
          />
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
          <div className="ct-menu-wrap" ref={exportRef}>
            <button
              className="ct-ghost"
              onClick={() => {
                setErrorExport("")
                setMenuExport((v) => !v)
              }}
              aria-haspopup="dialog"
              aria-expanded={menuExport}
            >
              Exportar
            </button>
            {menuExport && (
              <div className="ct-pop" role="dialog" aria-label="Exportar movimientos">
                <p className="ct-pop-title">Exportar movimientos</p>

                <div className="ct-seg ct-seg-sm" role="tablist" aria-label="Período">
                  {[
                    ["dia", "Día"],
                    ["semana", "Semana"],
                    ["mes", "Mes"],
                  ].map(([k, l]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={periodoExport === k}
                      className={periodoExport === k ? "on" : ""}
                      onClick={() => {
                        setPeriodoExport(k)
                        setErrorExport("")
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                <p className="ct-pop-range">{etiquetaRangoExport}</p>
                {periodoExport !== "dia" && (
                  <p className="ct-pop-hint">
                    {periodoExport === "semana"
                      ? "Semana de lunes a domingo que incluye el día seleccionado."
                      : "Mes completo del día seleccionado."}
                  </p>
                )}

                {errorExport && <p className="ct-error" role="alert">{errorExport}</p>}

                <div className="ct-pop-actions">
                  <button className="ct-ghost" disabled={exportando} onClick={() => exportar("csv")}>
                    {exportando ? "Preparando…" : "Descargar CSV"}
                  </button>
                  <button className="ct-ghost" disabled={exportando} onClick={() => exportar("pdf")}>
                    Imprimir / PDF
                  </button>
                </div>
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
