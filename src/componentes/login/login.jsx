import Input from "../inputs/inputs.jsx"
import Boton from '../boton/boton'
import { useState } from 'react'
import { supabase } from '../../supabase/supabaseClient.js'
import { useNavigate } from 'react-router-dom'


const Login = () => {
  const [formData, setFormData] = useState({
    correo: "",
    password: "",
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
    setCargando(true)
    setError("")

    // Iniciar sesión con Supabase Auth
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: formData.correo,
      password: formData.password,
    })

    if (authError) {
      setError("Correo o contraseña incorrectos")
      setCargando(false)
      return
    }

    // Obtener el rol del usuario desde la tabla usuarios
    const { data: usuario, error: dbError } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", data.user.id)
      .single()

    if (dbError || !usuario) {
      setError("No se pudo obtener el perfil del usuario")
      setCargando(false)
      return
    }

    // Redirigir según el rol
    if (usuario.rol === "diseñador") {
      navigate("/dashboard/diseñador")
    } else if (usuario.rol === "empleado") {
      navigate("/dashboard/empleado")
    } else if (usuario.rol === "admin") {
      navigate("/dashboard/admin")
    }

    setCargando(false)
  }

  return (
    <section className="register">
      <form onSubmit={handleSubmit}>
        <h3>Inicio de Sesión</h3>
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
        {error && <p className="error-mensaje">{error}</p>}
        <Boton type="submit" disabled={cargando}>
          {cargando ? "Ingresando..." : "Iniciar Sesión"}
        </Boton>
      </form>
    </section>
  )
}

export default Login