import "./Form.css"
import Input from "../inputs/inputs.jsx"
import Boton from "../boton/boton.jsx"
import { useState, useEffect } from "react"
import { supabase } from "../../supabase/supabaseClient.js"
import { useNavigate } from "react-router-dom"

const generarUsuario = (nombre) => {
  const limpio = nombre
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
  const partes = limpio.split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ""
  const inicial = partes[0][0] || ""
  const apellido = partes[1] || ""
  return inicial + apellido
}

const Form = () => {
  const [formData, setFormData] = useState({
    nombre: "",
    usuario: "",
    correo: "",
    password: "",
    confirmarPassword: "",
    rol: "empleado",
  })
  const [usuarioEditado, setUsuarioEditado] = useState(false)
  const [usuarioDisponible, setUsuarioDisponible] = useState(null)
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  // Auto-generar usuario al cambiar nombre
  useEffect(() => {
    if (!usuarioEditado) {
      const sugerido = generarUsuario(formData.nombre)
      setFormData((prev) => ({ ...prev, usuario: sugerido }))
      setUsuarioDisponible(null)
    }
  }, [formData.nombre, usuarioEditado])

  // Verificar disponibilidad del usuario
  useEffect(() => {
    const verificar = async () => {
      if (!formData.usuario || formData.usuario.length < 2) {
        setUsuarioDisponible(null)
        return
      }
      const { data } = await supabase
        .from("usuarios")
        .select("id")
        .eq("usuario", formData.usuario)
        .maybeSingle()
      setUsuarioDisponible(data === null)
    }
    const timer = setTimeout(verificar, 400)
    return () => clearTimeout(timer)
  }, [formData.usuario])

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === "usuario") {
      setUsuarioEditado(true)
      setFormData({ ...formData, usuario: value.toLowerCase().replace(/[^a-z0-9.]/g, "") })
      return
    }
    if (name === "nombre") {
      setUsuarioEditado(false)
    }
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (formData.password !== formData.confirmarPassword) {
      setError("Las contraseñas no coinciden")
      return
    }
    if (!formData.usuario) {
      setError("El nombre de usuario es requerido")
      return
    }
    if (usuarioDisponible === false) {
      setError("Ese nombre de usuario ya está en uso")
      return
    }

    setCargando(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.correo,
      password: formData.password,
    })

    if (authError) {
      setError(authError.message)
      setCargando(false)
      return
    }

    const { error: dbError } = await supabase.from("usuarios").insert({
      id: data.user.id,
      nombre: formData.nombre,
      usuario: formData.usuario,
      correo: formData.correo,
      rol: formData.rol,
    })

    if (dbError) {
      setError(dbError.message)
      setCargando(false)
      return
    }

    setCargando(false)
    navigate("/login")
  }

  return (
    <section className="register">
      <form onSubmit={handleSubmit}>
        <button type="button" className="btn-volver" onClick={() => navigate("/")}>
          ← Volver
        </button>
        <h3>REGISTRO</h3>

        <Input
          placeholder="Nombre y Apellido"
          type="text"
          required
          name="nombre"
          onChange={handleChange}
        />

        {/* Campo usuario con feedback */}
        <div style={{ position: "relative" }}>
          <Input
            placeholder="Nombre de usuario"
            type="text"
            required
            name="usuario"
            value={formData.usuario}
            onChange={handleChange}
          />
          {formData.usuario && usuarioDisponible === true && (
            <p style={{ fontSize: "12px", color: "#22c55e", margin: "-8px 0 8px 4px" }}>
              ✅ Disponible
            </p>
          )}
          {formData.usuario && usuarioDisponible === false && (
            <p style={{ fontSize: "12px", color: "#ef4444", margin: "-8px 0 8px 4px" }}>
              ✗ Ya está en uso — prueba con {formData.usuario}2
            </p>
          )}
        </div>

        <Input
          placeholder="Correo"
          type="email"
          required
          name="correo"
          onChange={handleChange}
        />
        <Input
          placeholder="Contraseña"
          type="password"
          required
          name="password"
          onChange={handleChange}
        />
        <Input
          placeholder="Confirma Contraseña"
          type="password"
          required
          name="confirmarPassword"
          onChange={handleChange}
        />

        <div className="inputs">
          <select name="rol" value={formData.rol} onChange={handleChange} required>
            <option value="empleado">Empleado</option>
            <option value="diseñador">Diseñador</option>
          </select>
        </div>

        {error && <p className="error-mensaje">{error}</p>}

        <Boton type="submit" disabled={cargando || usuarioDisponible === false}>
          {cargando ? "Registrando..." : "Registrar"}
        </Boton>
      </form>
    </section>
  )
}

export default Form
