import "./Form.css"
import Input from "../inputs/inputs.jsx"
import Boton from "../boton/boton.jsx"
import { useState } from "react"
import { supabase } from "../../supabase/supabaseClient.js"
import { useNavigate } from "react-router-dom"

const Form = () => {
  const [formData, setFormData] = useState({
    nombre: "",
    correo: "",
    password: "",
    confirmarPassword: "",
    rol: "empleado"
  })
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.password !== formData.confirmarPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    setCargando(true)
    setError("")

    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.correo,
      password: formData.password,
    })

    if (authError) {
      setError(authError.message)
      setCargando(false)
      return
    }

    const { error: dbError } = await supabase
      .from("usuarios")
      .insert({
        id: data.user.id,
        nombre: formData.nombre,
        correo: formData.correo,
        rol: formData.rol
      })

    if (dbError) {
      setError(dbError.message)
      setCargando(false)
      return
    }

    setCargando(false)
    // Redirigir al login en lugar de alert
    navigate("/login")
  }

  return (
    <section className="register">
      <form onSubmit={handleSubmit}>

        {/* BOTÓN VOLVER */}
        <button
          type="button"
          className="btn-volver"
          onClick={() => navigate("/")}
        >
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
          <select
            name="rol"
            value={formData.rol}
            onChange={handleChange}
            required
          >
            <option value="empleado">Empleado</option>
            <option value="diseñador">Diseñador</option>
          </select>
        </div>

        {error && <p className="error-mensaje">{error}</p>}

        <Boton type="submit" disabled={cargando}>
          {cargando ? "Registrando..." : "Registrar"}
        </Boton>

      </form>
    </section>
  )
}

export default Form
