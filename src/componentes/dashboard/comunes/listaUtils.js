import { useState } from "react"

/* ── Opciones de orden por lista ───────────────────────────────────── */
export const OPCIONES_ORDEN = {
  pedidos: [
    { id: "recientes", label: "Más recientes" },
    { id: "entrega", label: "Fecha de entrega" },
    { id: "prioridad", label: "Prioridad" },
    { id: "estado", label: "Estado" },
    { id: "cliente", label: "Cliente (A-Z)" },
  ],
  materiales: [
    { id: "recientes", label: "Más recientes" },
    { id: "nombre", label: "Nombre (A-Z)" },
    { id: "stock", label: "Stock (menor primero)" },
    { id: "estado", label: "Estado" },
  ],
  disenos: [
    { id: "recientes", label: "Más recientes" },
    { id: "cliente", label: "Cliente (A-Z)" },
    { id: "estado", label: "Estado del pedido" },
  ],
}

/* ── Helpers ───────────────────────────────────────────────────────── */
const texto = (t) => String(t ?? "")
const normalizar = (t) =>
  texto(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

const porTexto = (a, b) => texto(a).localeCompare(texto(b), "es", { sensitivity: "base" })
const porFechaDesc = (a, b) => texto(b).localeCompare(texto(a))
const porFechaAsc = (a, b) => {
  if (!a && !b) return 0
  if (!a) return 1 // sin fecha, al final
  if (!b) return -1
  return texto(a).localeCompare(texto(b))
}
const rango = (mapa, v) => mapa[v] ?? 99

const PRIORIDAD = { alta: 0, media: 1, baja: 2 }
const ESTADO_PEDIDO = {
  sin_material: 0,
  pendiente: 1,
  "en_diseño": 2,
  aprobado: 3,
  en_impresion: 4,
  terminado: 5,
}
const ESTADO_MATERIAL = { agotado: 0, bajo_stock: 1, disponible: 2 }

const COMPARADORES = {
  pedidos: {
    recientes: (a, b) => porFechaDesc(a.created_at, b.created_at),
    entrega: (a, b) => porFechaAsc(a.fecha_entrega, b.fecha_entrega),
    prioridad: (a, b) =>
      rango(PRIORIDAD, a.prioridad) - rango(PRIORIDAD, b.prioridad) ||
      porFechaAsc(a.fecha_entrega, b.fecha_entrega),
    estado: (a, b) => rango(ESTADO_PEDIDO, a.estado) - rango(ESTADO_PEDIDO, b.estado),
    cliente: (a, b) => porTexto(a.cliente_nombre, b.cliente_nombre),
  },
  materiales: {
    recientes: (a, b) => porFechaDesc(a.created_at, b.created_at),
    nombre: (a, b) => porTexto(a.nombre, b.nombre),
    stock: (a, b) => Number(a.stock ?? 0) - Number(b.stock ?? 0),
    estado: (a, b) => rango(ESTADO_MATERIAL, a.estado) - rango(ESTADO_MATERIAL, b.estado),
  },
  disenos: {
    recientes: (a, b) => porFechaDesc(a.created_at, b.created_at),
    cliente: (a, b) => porTexto(a.pedidos?.cliente_nombre, b.pedidos?.cliente_nombre),
    estado: (a, b) =>
      rango(ESTADO_PEDIDO, a.pedidos?.estado) - rango(ESTADO_PEDIDO, b.pedidos?.estado),
  },
}

/* Campos donde busca la lupa */
const CAMPOS_BUSQUEDA = {
  pedidos: (p) => [
    p.cliente_nombre, p.cliente_contacto, p.estado, p.prioridad,
    p.perfil_impresion, p.configuracion, p.especificaciones, p.fecha_entrega,
  ],
  materiales: (m) => [m.nombre, m.tipo_material, m.subtipo, m.estado],
  disenos: (d) => [d.pedidos?.cliente_nombre, d.pedidos?.estado],
}

/* ── Filtra (todas las palabras deben aparecer) y ordena ───────────── */
export const filtrarYOrdenar = (lista, tipo, q, orden) => {
  const palabras = normalizar(q).split(/\s+/).filter(Boolean)
  const filtrada = palabras.length
    ? lista.filter((item) => {
        const pajar = normalizar(CAMPOS_BUSQUEDA[tipo](item).join(" "))
        return palabras.every((p) => pajar.includes(p))
      })
    : lista
  const cmp = COMPARADORES[tipo][orden] || COMPARADORES[tipo].recientes
  return [...filtrada].sort(cmp)
}

/* ── Hook: recuerda búsqueda y orden por sección ───────────────────── */
export const useFiltroLista = (seccion) => {
  const [estado, setEstado] = useState({})
  const actual = estado[seccion] || { q: "", orden: "recientes" }

  const setQ = (q) =>
    setEstado((e) => ({ ...e, [seccion]: { orden: "recientes", ...e[seccion], q } }))
  const setOrden = (orden) =>
    setEstado((e) => ({ ...e, [seccion]: { q: "", ...e[seccion], orden } }))

  return { q: actual.q, orden: actual.orden, setQ, setOrden }
}
