import Input from "../inputs/inputs.jsx"
import Boton from '../boton/boton'
import { useState } from 'react'
import { supabase } from '../../supabase/supabaseClient.js'
import { useNavigate } from 'react-router-dom'

const Login = () => {
  const [formData, setFormData] = useState({ correo: "", password: "" })
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const [recuperando, setRecuperando] = useState(false)
  const [mensajeRecuperar, setMensajeRecuperar] = useState("")
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setCargando(true)
    setError("")

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: formData.correo,
      password: formData.password,
    })

    if (authError) {
      setError("Correo o contraseña incorrectos")
      setCargando(false)
      return
    }

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

    if (usuario.rol === "diseñador") navigate("/dashboard/diseñador")
    else if (usuario.rol === "empleado") navigate("/dashboard/empleado")
    else if (usuario.rol === "admin") navigate("/dashboard/admin")

    setCargando(false)
  }

  const handleOlvidePassword = async () => {
    if (!formData.correo) {
      setError("Escribe tu correo arriba para recuperar la contraseña")
      return
    }
    setRecuperando(true)
    setError("")
    setMensajeRecuperar("")

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      formData.correo,
      { redirectTo: `${window.location.origin}/login` }
    )

    if (resetError) {
      setError("No se pudo enviar el correo. Verifica el correo ingresado.")
    } else {
      setMensajeRecuperar(`Correo de recuperación enviado a ${formData.correo}. Revisa tu bandeja.`)
    }
    setRecuperando(false)
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
        {mensajeRecuperar && <p className="exito-mensaje">{mensajeRecuperar}</p>}

        <Boton type="submit" disabled={cargando}>
          {cargando ? "Ingresando..." : "Iniciar Sesión"}
        </Boton>

        {/* BOTÓN OLVIDÉ CONTRASEÑA */}
        <button
          type="button"
          className="btn-olvide"
          onClick={handleOlvidePassword}
          disabled={recuperando}
        >
          {recuperando ? "Enviando correo..." : "¿Olvidaste tu contraseña?"}
        </button>

      </form>
    </section>
  )
}

export default Login
