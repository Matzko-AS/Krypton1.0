import { useState, useRef, useEffect } from "react"
import { OPCIONES_ORDEN } from "./listaUtils"
import "./buscarOrdenar.css"

const IconoLupa = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

const IconoOrden = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 4v16M7 20l-3-3M7 20l3-3" />
    <path d="M17 20V4M17 4l-3 3M17 4l3 3" />
  </svg>
)

/**
 * Props: tipo ("pedidos" | "materiales" | "disenos"), q, setQ, orden, setOrden
 * (los cuatro últimos vienen de useFiltroLista).
 */
const BuscarOrdenar = ({ tipo, q, setQ, orden, setOrden }) => {
  const [abierto, setAbierto] = useState(false)
  const [menu, setMenu] = useState(false)
  const inputRef = useRef(null)
  const menuRef = useRef(null)
  const opciones = OPCIONES_ORDEN[tipo] || []
  const visible = abierto || q !== ""

  useEffect(() => {
    if (abierto) inputRef.current?.focus()
  }, [abierto])

  useEffect(() => {
    if (!menu) return
    const fuera = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false)
    }
    document.addEventListener("mousedown", fuera)
    return () => document.removeEventListener("mousedown", fuera)
  }, [menu])

  const alternarBusqueda = () => {
    if (visible) {
      setQ("")
      setAbierto(false)
    } else {
      setAbierto(true)
    }
  }

  const etiquetaOrden = opciones.find((o) => o.id === orden)?.label

  return (
    <div className="bo-wrap">
      <div className={`bo-buscador ${visible ? "bo-abierto" : ""}`}>
        <input
          ref={inputRef}
          type="text"
          className="bo-input"
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") alternarBusqueda()
          }}
          tabIndex={visible ? 0 : -1}
          aria-label="Buscar"
        />
        <button
          type="button"
          className={`bo-btn ${visible ? "bo-activo" : ""}`}
          onClick={alternarBusqueda}
          title={visible ? "Cerrar búsqueda" : "Buscar"}
          aria-label={visible ? "Cerrar búsqueda" : "Buscar"}
        >
          {visible ? "✕" : <IconoLupa />}
        </button>
      </div>

      <div className="bo-orden" ref={menuRef}>
        <button
          type="button"
          className={`bo-btn bo-btn-orden ${orden !== "recientes" ? "bo-activo" : ""}`}
          onClick={() => setMenu(!menu)}
          title="Ordenar"
          aria-haspopup="menu"
          aria-expanded={menu}
        >
          <IconoOrden />
          <span className="bo-etiqueta">{etiquetaOrden}</span>
        </button>
        {menu && (
          <ul className="bo-menu" role="menu">
            {opciones.map((o) => (
              <li key={o.id} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={orden === o.id}
                  className={`bo-opcion ${orden === o.id ? "bo-sel" : ""}`}
                  onClick={() => {
                    setOrden(o.id)
                    setMenu(false)
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default BuscarOrdenar
