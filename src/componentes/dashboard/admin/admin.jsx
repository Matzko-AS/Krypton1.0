import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../../supabase/supabaseClient"
import "./admin.css"

/* ── Helpers ───────────────────────────────────────────────────────── */
const TZ = "America/Guayaquil"
const fechaISO = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d)

const sumarDias = (iso, n) => {
  const d = new Date(iso + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-EC", { style: "currency", currency: "USD" })

const fechaCorta = (iso) =>
  iso ? new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("es-EC") : "—"

const numFactura = (n) => `FACT-${String(n ?? 0).padStart(6, "0")}`

const COLOR_ESTADO = {
  pendiente: "#f59e0b",
  en_diseño: "#4f6ef7",
  aprobado: "#22c55e",
  en_impresion: "#8b5cf6",
  sin_material: "#ef4444",
  terminado: "#64748b",
}
const COLOR_PRIORIDAD = { alta: "#ef4444", media: "#f59e0b", baja: "#22c55e" }

const SECCIONES = [
  ["resumen", "Resumen"],
  ["contabilidad", "Contabilidad"],
  ["pedidos", "Pedidos"],
  ["clientes", "Clientes"],
  ["materiales", "Materiales"],
  ["facturas", "Facturas"],
  ["usuarios", "Usuarios"],
  ["actividad", "Actividad"],
]

/* ── Piezas pequeñas ───────────────────────────────────────────────── */
const Kpi = ({ label, valor, nota, color }) => (
  <div className="adm-kpi" style={color ? { borderLeftColor: color } : undefined}>
    <p className="adm-kpi-label">{label}</p>
    <p className="adm-kpi-valor">{valor}</p>
    {nota && <p className="adm-kpi-nota">{nota}</p>}
  </div>
)

const BarrasHorizontales = ({ datos, colores }) => {
  const max = Math.max(1, ...datos.map((d) => d.valor))
  if (datos.every((d) => d.valor === 0)) return <p className="adm-vacio">Sin datos todavía.</p>
  return (
    <div className="adm-hbars">
      {datos.map((d) => (
        <div key={d.nombre} className="adm-hbar-fila">
          <span className="adm-hbar-nombre">{d.nombre}</span>
          <div className="adm-hbar-pista">
            <div
              className="adm-hbar-relleno"
              style={{ width: `${(d.valor / max) * 100}%`, background: colores[d.nombre] || "#4f6ef7" }}
            />
          </div>
          <span className="adm-hbar-valor">{d.valor}</span>
        </div>
      ))}
    </div>
  )
}

const Insignia = ({ texto, color }) => (
  <span className="adm-badge" style={{ background: color || "#334155" }}>{texto || "—"}</span>
)

const Tabla = ({ columnas, filas, vacio }) =>
  filas.length === 0 ? (
    <p className="adm-vacio">{vacio}</p>
  ) : (
    <div className="adm-tabla-wrap">
      <table className="adm-tabla">
        <thead>
          <tr>{columnas.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={f.key ?? i}>{f.celdas.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )

/* ── Componente principal ──────────────────────────────────────────── */
const DashboardAdmin = () => {
  const navigate = useNavigate()
  const [autorizado, setAutorizado] = useState(false)
  const [seccion, setSeccion] = useState("resumen")
  const [cargando, setCargando] = useState(true)
  const [errores, setErrores] = useState([])
  const [procesando, setProcesando] = useState(false)

  const [usuarios, setUsuarios] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [materiales, setMateriales] = useState([])
  const [contabilidad, setContabilidad] = useState([])
  const [facturas, setFacturas] = useState([])
  const [historial, setHistorial] = useState([])

  const [rangoGrafico, setRangoGrafico] = useState(7)
  const [periodo, setPeriodo] = useState("mes")
  const [busqPedido, setBusqPedido] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [busqCliente, setBusqCliente] = useState("")
  const [busqFactura, setBusqFactura] = useState("")

  const hoy = fechaISO()

  /* Carga */
  const cargarTodo = async () => {
    setCargando(true)
    const [u, p, m, c, f, h] = await Promise.all([
      supabase.from("usuarios").select("*"),
      supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
      supabase.from("materiales").select("*").order("nombre"),
      supabase.from("contabilidad").select("*").order("created_at", { ascending: false }),
      supabase.from("facturas").select("*").order("created_at", { ascending: false }),
      supabase.from("historial").select("*").order("created_at", { ascending: false }).limit(200),
    ])
    const errs = [["usuarios", u], ["pedidos", p], ["materiales", m], ["contabilidad", c], ["facturas", f], ["historial", h]]
      .filter(([, r]) => r.error)
      .map(([n, r]) => `${n}: ${r.error.message}`)
    setErrores(errs)
    setUsuarios(u.data || [])
    setPedidos(p.data || [])
    setMateriales(m.data || [])
    setContabilidad(c.data || [])
    setFacturas(f.data || [])
    setHistorial(h.data || [])
    setCargando(false)
  }

  useEffect(() => {
    const verificar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate("/login")
      const { data: perfil } = await supabase.from("usuarios").select("rol").eq("id", user.id).single()
      if (perfil?.rol !== "admin") return navigate("/")
      setAutorizado(true)
      cargarTodo()
    }
    verificar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    navigate("/")
  }

  /* Mapas */
  const nombreUsuario = useMemo(() => {
    const m = {}
    usuarios.forEach((u) => { m[u.id] = u.nombre || u.usuario || u.correo })
    return m
  }, [usuarios])

  /* Contabilidad */
  const desdePeriodo = periodo === "hoy" ? hoy : periodo === "semana" ? sumarDias(hoy, -6) : hoy.slice(0, 8) + "01"

  const resumenContable = (desde) => {
    const filas = contabilidad.filter((r) => r.fecha >= desde && r.fecha <= hoy)
    const ventas = filas.filter((r) => r.tipo === "venta").reduce((s, r) => s + Number(r.monto), 0)
    const gastos = filas.filter((r) => r.tipo === "gasto").reduce((s, r) => s + Number(r.monto), 0)
    return { ventas, gastos, neta: ventas - gastos, filas }
  }

  const contHoy = useMemo(() => resumenContable(hoy), [contabilidad, hoy])
  const contMes = useMemo(() => resumenContable(hoy.slice(0, 8) + "01"), [contabilidad, hoy])
  const contPeriodo = useMemo(() => resumenContable(desdePeriodo), [contabilidad, desdePeriodo, hoy])

  const serieDiaria = useMemo(() => {
    const dias = []
    for (let i = rangoGrafico - 1; i >= 0; i--) dias.push(sumarDias(hoy, -i))
    return dias.map((fecha) => {
      const filas = contabilidad.filter((r) => r.fecha === fecha)
      return {
        fecha,
        ventas: filas.filter((r) => r.tipo === "venta").reduce((s, r) => s + Number(r.monto), 0),
        gastos: filas.filter((r) => r.tipo === "gasto").reduce((s, r) => s + Number(r.monto), 0),
      }
    })
  }, [contabilidad, rangoGrafico, hoy])

  const maxSerie = Math.max(1, ...serieDiaria.flatMap((d) => [d.ventas, d.gastos]))

  /* Pedidos */
  const pedidosPorEstado = useMemo(() => {
    const m = {}
    pedidos.forEach((p) => { m[p.estado] = (m[p.estado] || 0) + 1 })
    return Object.entries(m).map(([nombre, valor]) => ({ nombre, valor }))
  }, [pedidos])

  const pedidosPorPrioridad = useMemo(
    () => ["alta", "media", "baja"].map((nombre) => ({
      nombre,
      valor: pedidos.filter((p) => p.prioridad === nombre && p.estado !== "terminado").length,
    })),
    [pedidos]
  )

  const pedidosActivos = pedidos.filter((p) => p.estado !== "terminado")
  const atrasados = pedidosActivos.filter((p) => p.fecha_entrega && p.fecha_entrega < hoy)
  const materialesCriticos = materiales.filter((m) => m.estado === "bajo_stock" || m.estado === "agotado")

  const pedidosFiltrados = pedidos.filter((p) => {
    const q = busqPedido.toLowerCase().trim()
    const coincide = !q || `${p.cliente_nombre} ${p.cliente_contacto}`.toLowerCase().includes(q)
    return coincide && (filtroEstado === "todos" || p.estado === filtroEstado)
  })

  /* Clientes (pedidos + facturas) */
  const clientes = useMemo(() => {
    const mapa = {}
    const tomar = (nombre) => {
      const clave = (nombre || "").trim().toUpperCase()
      if (!clave) return null
      if (!mapa[clave]) mapa[clave] = { nombre: clave, contactos: new Set(), pedidos: 0, facturas: 0, facturado: 0, ultimo: "" }
      return mapa[clave]
    }
    pedidos.forEach((p) => {
      const c = tomar(p.cliente_nombre)
      if (!c) return
      if (p.cliente_contacto) c.contactos.add(p.cliente_contacto.trim())
      c.pedidos += 1
      const f = (p.created_at || "").slice(0, 10)
      if (f > c.ultimo) c.ultimo = f
    })
    facturas.forEach((f) => {
      const c = tomar(f.cliente_nombre)
      if (!c) return
      if (f.cliente_contacto) c.contactos.add(f.cliente_contacto.trim())
      c.facturas += 1
      c.facturado += Number(f.total || 0)
      if ((f.fecha || "") > c.ultimo) c.ultimo = f.fecha
    })
    return Object.values(mapa).sort((a, b) => b.pedidos + b.facturas - (a.pedidos + a.facturas))
  }, [pedidos, facturas])

  const clientesFiltrados = clientes.filter((c) => {
    const q = busqCliente.toLowerCase().trim()
    return !q || `${c.nombre} ${[...c.contactos].join(" ")}`.toLowerCase().includes(q)
  })

  /* Materiales */
  const restanteMaterial = (m) => {
    const area = Number(m.area_disponible_cm2)
    if (!area && area !== 0) return "—"
    if (m.unidad === "metros" && Number(m.ancho) > 0)
      return `${m.ancho} cm × ${(area / Number(m.ancho) / 100).toFixed(2)} m`
    return `${(area / 10000).toFixed(2)} m²`
  }

  /* Usuarios */
  const usuariosConActividad = useMemo(
    () => usuarios.map((u) => ({
      ...u,
      nPedidos: pedidos.filter((p) => p.usuario_id === u.id).length,
      nRegistros: contabilidad.filter((r) => r.usuario_id === u.id).length,
    })),
    [usuarios, pedidos, contabilidad]
  )

  /* Facturas */
  const facturasFiltradas = facturas.filter((f) => {
    const q = busqFactura.toLowerCase().trim()
    return !q || `${numFactura(f.numero)} ${f.cliente_nombre} ${f.cliente_contacto} ${f.cliente_cedula}`.toLowerCase().includes(q)
  })

  const eliminarFactura = async (f) => {
    if (!window.confirm(`¿Eliminar ${numFactura(f.numero)} de "${f.cliente_nombre}"? Esta acción no se puede deshacer.`)) return
    setProcesando(true)
    const { error: e1 } = await supabase.from("detalle_factura").delete().eq("factura_id", f.id)
    if (e1) {
      alert("No se pudo borrar el detalle: " + e1.message)
      setProcesando(false)
      return
    }
    const { data, error: e2 } = await supabase.from("facturas").delete().eq("id", f.id).select()
    if (e2 || !data?.length) {
      alert("No se pudo eliminar la factura. " + (e2?.message || "Verifica los permisos del administrador."))
    } else {
      setFacturas((prev) => prev.filter((x) => x.id !== f.id))
    }
    setProcesando(false)
  }

  if (!autorizado) return <div className="adm-cargando">Verificando acceso…</div>

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="adm-layout">
      <aside className="adm-sidebar">
        <div className="adm-logo">
          <h2>KRYPTON</h2>
          <span>Administración</span>
        </div>
        <nav className="adm-nav">
          {SECCIONES.map(([id, nombre]) => (
            <button key={id} className={`adm-nav-item ${seccion === id ? "activo" : ""}`} onClick={() => setSeccion(id)}>
              {nombre}
            </button>
          ))}
        </nav>
        <button className="adm-btn-lateral" onClick={cargarTodo} disabled={cargando}>
          {cargando ? "Actualizando…" : "Actualizar datos"}
        </button>
        <button className="adm-btn-lateral adm-salir" onClick={cerrarSesion}>Cerrar sesión</button>
      </aside>

      <main className="adm-main">
        <header className="adm-header">
          <h1>{SECCIONES.find(([id]) => id === seccion)[1]}</h1>
          <span className="adm-fecha">{fechaCorta(hoy)}</span>
        </header>

        {errores.length > 0 && (
          <div className="adm-alerta">
            <strong>Algunas consultas fallaron:</strong>
            <ul>{errores.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        <div className="adm-contenido">
          {/* RESUMEN */}
          {seccion === "resumen" && (
            <>
              <div className="adm-kpis">
                <Kpi label="Ventas de hoy" valor={fmt(contHoy.ventas)} color="#22c55e" />
                <Kpi label="Ventas del mes" valor={fmt(contMes.ventas)} color="#22c55e" />
                <Kpi label="Gastos del mes" valor={fmt(contMes.gastos)} color="#ef4444" />
                <Kpi label="Ganancia neta del mes" valor={fmt(contMes.neta)} color={contMes.neta >= 0 ? "#4f6ef7" : "#f59e0b"} />
                <Kpi label="Pedidos activos" valor={pedidosActivos.length} nota={`${pedidos.length} en total`} color="#8b5cf6" />
                <Kpi label="Pedidos atrasados" valor={atrasados.length} color={atrasados.length ? "#ef4444" : "#22c55e"} />
                <Kpi label="Materiales críticos" valor={materialesCriticos.length} nota={`${materiales.length} registrados`} color="#f59e0b" />
                <Kpi label="Usuarios" valor={usuarios.length} nota={`${clientes.length} clientes`} color="#4f6ef7" />
              </div>

              <div className="adm-grid-2">
                <div className="adm-card">
                  <h2>Pedidos por estado</h2>
                  <BarrasHorizontales datos={pedidosPorEstado} colores={COLOR_ESTADO} />
                </div>
                <div className="adm-card">
                  <h2>Pedidos activos por prioridad</h2>
                  <BarrasHorizontales datos={pedidosPorPrioridad} colores={COLOR_PRIORIDAD} />
                </div>
              </div>

              <div className="adm-grid-2">
                <div className="adm-card">
                  <h2>Pedidos atrasados</h2>
                  <Tabla
                    columnas={["Cliente", "Contacto", "Entrega", "Estado"]}
                    vacio="No hay pedidos atrasados."
                    filas={atrasados.map((p) => ({
                      key: p.id,
                      celdas: [p.cliente_nombre, p.cliente_contacto || "—", fechaCorta(p.fecha_entrega), <Insignia texto={p.estado} color={COLOR_ESTADO[p.estado]} />],
                    }))}
                  />
                </div>
                <div className="adm-card">
                  <h2>Materiales con stock bajo o agotados</h2>
                  <Tabla
                    columnas={["Material", "Stock", "Restante", "Estado"]}
                    vacio="Todos los materiales tienen stock."
                    filas={materialesCriticos.map((m) => ({
                      key: m.id,
                      celdas: [m.nombre, m.stock, restanteMaterial(m), <Insignia texto={m.estado} color={m.estado === "agotado" ? "#ef4444" : "#f59e0b"} />],
                    }))}
                  />
                </div>
              </div>
            </>
          )}

          {/* CONTABILIDAD */}
          {seccion === "contabilidad" && (
            <>
              <div className="adm-barra">
                <div className="adm-seg">
                  {[["hoy", "Hoy"], ["semana", "Últimos 7 días"], ["mes", "Mes actual"]].map(([id, n]) => (
                    <button key={id} className={periodo === id ? "activo" : ""} onClick={() => setPeriodo(id)}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="adm-kpis adm-kpis-3">
                <Kpi label="Ventas" valor={fmt(contPeriodo.ventas)} color="#22c55e" />
                <Kpi label="Gastos" valor={fmt(contPeriodo.gastos)} color="#ef4444" />
                <Kpi label="Ganancia neta" valor={fmt(contPeriodo.neta)} color={contPeriodo.neta >= 0 ? "#4f6ef7" : "#f59e0b"} />
              </div>

              <div className="adm-card">
                <div className="adm-card-cab">
                  <h2>Ventas y gastos por día</h2>
                  <div className="adm-seg">
                    {[7, 14, 30].map((n) => (
                      <button key={n} className={rangoGrafico === n ? "activo" : ""} onClick={() => setRangoGrafico(n)}>{n} días</button>
                    ))}
                  </div>
                </div>
                <div className="adm-leyenda">
                  <span><i style={{ background: "#22c55e" }} /> Ventas</span>
                  <span><i style={{ background: "#ef4444" }} /> Gastos</span>
                </div>
                <div className="adm-vbars">
                  {serieDiaria.map((d) => (
                    <div key={d.fecha} className="adm-vbar-col" title={`${fechaCorta(d.fecha)} — Ventas ${fmt(d.ventas)} · Gastos ${fmt(d.gastos)}`}>
                      <div className="adm-vbar-par">
                        <div className="adm-vbar" style={{ height: `${(d.ventas / maxSerie) * 100}%`, background: "#22c55e" }} />
                        <div className="adm-vbar" style={{ height: `${(d.gastos / maxSerie) * 100}%`, background: "#ef4444" }} />
                      </div>
                      <span className="adm-vbar-dia">{d.fecha.slice(8)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="adm-card">
                <h2>Registros del período ({contPeriodo.filas.length})</h2>
                <Tabla
                  columnas={["Fecha", "Tipo", "Descripción", "Cliente", "Registrado por", "Monto"]}
                  vacio="No hay registros en este período."
                  filas={contPeriodo.filas.map((r) => ({
                    key: r.id,
                    celdas: [
                      fechaCorta(r.fecha),
                      <Insignia texto={r.tipo} color={r.tipo === "venta" ? "#16a34a" : "#dc2626"} />,
                      r.descripcion,
                      r.cliente_nombre || "—",
                      nombreUsuario[r.usuario_id] || "—",
                      <strong style={{ color: r.tipo === "venta" ? "#22c55e" : "#ef4444" }}>{r.tipo === "gasto" ? "−" : "+"}{fmt(r.monto)}</strong>,
                    ],
                  }))}
                />
              </div>
            </>
          )}

          {/* PEDIDOS */}
          {seccion === "pedidos" && (
            <div className="adm-card">
              <div className="adm-barra">
                <input className="adm-input" placeholder="Buscar por cliente o contacto…" value={busqPedido} onChange={(e) => setBusqPedido(e.target.value)} />
                <select className="adm-input adm-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                  <option value="todos">Todos los estados</option>
                  {Object.keys(COLOR_ESTADO).map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <Tabla
                columnas={["Cliente", "Contacto", "Estado", "Prioridad", "Cant.", "Entrega", "Creado por", "Total", "Saldo"]}
                vacio="No hay pedidos con ese filtro."
                filas={pedidosFiltrados.map((p) => ({
                  key: p.id,
                  celdas: [
                    p.cliente_nombre,
                    p.cliente_contacto || "—",
                    <Insignia texto={p.estado} color={COLOR_ESTADO[p.estado]} />,
                    <Insignia texto={p.prioridad} color={COLOR_PRIORIDAD[p.prioridad]} />,
                    p.cantidad,
                    fechaCorta(p.fecha_entrega),
                    nombreUsuario[p.usuario_id] || "—",
                    p.precio_total != null ? fmt(p.precio_total) : "—",
                    p.saldo != null ? fmt(p.saldo) : "—",
                  ],
                }))}
              />
            </div>
          )}

          {/* CLIENTES */}
          {seccion === "clientes" && (
            <div className="adm-card">
              <div className="adm-barra">
                <input className="adm-input" placeholder="Buscar cliente o teléfono…" value={busqCliente} onChange={(e) => setBusqCliente(e.target.value)} />
                <span className="adm-conteo">{clientesFiltrados.length} clientes</span>
              </div>
              <Tabla
                columnas={["Cliente", "Contacto", "Pedidos", "Facturas", "Total facturado", "Última actividad"]}
                vacio="No hay clientes registrados."
                filas={clientesFiltrados.map((c) => ({
                  key: c.nombre,
                  celdas: [c.nombre, [...c.contactos].join(" · ") || "—", c.pedidos, c.facturas, fmt(c.facturado), fechaCorta(c.ultimo)],
                }))}
              />
            </div>
          )}

          {/* MATERIALES */}
          {seccion === "materiales" && (
            <div className="adm-card">
              <Tabla
                columnas={["Material", "Tipo", "Subtipo", "Ancho", "Grosor", "Stock", "Restante", "Estado"]}
                vacio="No hay materiales registrados."
                filas={materiales.map((m) => ({
                  key: m.id,
                  celdas: [
                    m.nombre,
                    m.tipo_material || "—",
                    m.subtipo || "—",
                    m.ancho ? `${m.ancho} cm` : "—",
                    m.grosor ? `${m.grosor} mm` : "—",
                    `${m.stock} ${m.unidad === "metros" ? "rollos" : "uds."}`,
                    restanteMaterial(m),
                    <Insignia texto={m.estado} color={m.estado === "disponible" ? "#16a34a" : m.estado === "bajo_stock" ? "#f59e0b" : "#ef4444"} />,
                  ],
                }))}
              />
            </div>
          )}

          {/* FACTURAS */}
          {seccion === "facturas" && (
            <div className="adm-card">
              <div className="adm-barra">
                <input className="adm-input" placeholder="Buscar por número, cliente, cédula o contacto…" value={busqFactura} onChange={(e) => setBusqFactura(e.target.value)} />
                <span className="adm-conteo">{facturasFiltradas.length} facturas</span>
              </div>
              <Tabla
                columnas={["N.º", "Fecha", "Cliente", "Contacto", "Total", "Abono", "Saldo", "Registrada por", ""]}
                vacio="No hay facturas."
                filas={facturasFiltradas.map((f) => ({
                  key: f.id,
                  celdas: [
                    numFactura(f.numero),
                    fechaCorta(f.fecha),
                    f.cliente_nombre,
                    f.cliente_contacto || "—",
                    fmt(f.total),
                    fmt(f.abono),
                    fmt(f.saldo),
                    nombreUsuario[f.usuario_id] || "—",
                    <button className="adm-btn-borrar" disabled={procesando} onClick={() => eliminarFactura(f)}>Eliminar</button>,
                  ],
                }))}
              />
            </div>
          )}

          {/* USUARIOS */}
          {seccion === "usuarios" && (
            <div className="adm-card">
              <Tabla
                columnas={["Nombre", "Usuario", "Correo", "Rol", "Pedidos creados", "Registros contables"]}
                vacio="No hay usuarios."
                filas={usuariosConActividad.map((u) => ({
                  key: u.id,
                  celdas: [
                    u.nombre || "—",
                    u.usuario || "—",
                    u.correo || "—",
                    <Insignia texto={u.rol} color={u.rol === "admin" ? "#7c3aed" : u.rol === "diseñador" ? "#4f6ef7" : "#0d9488"} />,
                    u.nPedidos,
                    u.nRegistros,
                  ],
                }))}
              />
            </div>
          )}

          {/* ACTIVIDAD */}
          {seccion === "actividad" && (
            <div className="adm-card">
              <h2>Últimos 200 movimientos</h2>
              <Tabla
                columnas={["Fecha", "Usuario", "Entidad", "Acción", "Detalle"]}
                vacio="Todavía no hay actividad registrada."
                filas={historial.map((h) => ({
                  key: h.id,
                  celdas: [
                    new Date(h.created_at).toLocaleString("es-EC", { timeZone: TZ }),
                    nombreUsuario[h.usuario_id] || "—",
                    h.entidad || "—",
                    h.accion || "—",
                    <span className="adm-detalle">{h.datos || "—"}</span>,
                  ],
                }))}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default DashboardAdmin
