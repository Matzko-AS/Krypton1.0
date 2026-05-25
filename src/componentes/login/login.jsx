import Input from "../inputs/inputs.jsx"
import Boton from '../boton/boton'
import { useState } from 'react'
import { supabase } from '../../supabase/supabaseClient.js'
import { useNavigate } from 'react-router-dom'

const Login = () => {
  const [formData, setFormData] = useState({ usuario: "", password: "" })
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

  // 1. Buscar correo por usuario
  const { data: perfiles } = await supabase
    .rpc("buscar_perfil_por_usuario", { p_usuario: formData.usuario.toLowerCase().trim() })

  const perfil = perfiles?.[0]

  if (!perfil?.correo) {
    setError("Usuario o contraseña incorrectos")
    setCargando(false)
    return
  }

  // 2. Autenticar
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email: perfil.correo,
    password: formData.password,
  })

  if (authError || !data.user) {
    setError("Usuario o contraseña incorrectos")
    setCargando(false)
    return
  }

  // 3. Leer rol con sesión activa (RLS ya permite leer el propio registro)
  const { data: usuarioDB } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", data.user.id)
    .single()

  const rol = usuarioDB?.rol

  if (rol === "diseñador") navigate("/dashboard/diseñador")
  else if (rol === "empleado") navigate("/dashboard/empleado")
  else if (rol === "admin") navigate("/dashboard/admin")
  else setError("Rol no reconocido")

  setCargando(false)
}
  const handleOlvidePassword = async () => {
    if (!formData.usuario.trim()) {
      setError("Escribe tu nombre de usuario arriba para recuperar la contraseña")
      return
    }

    setRecuperando(true)
    setError("")
    setMensajeRecuperar("")

    // Buscar correo por usuario
      const { data: perfiles, error: perfilError } = await supabase
        .rpc("buscar_perfil_por_usuario", { p_usuario: formData.usuario.toLowerCase().trim() })

      const perfil = perfiles?.[0]

      if (perfilError || !perfil) {
        setError("Usuario o contraseña incorrectos")
        setCargando(false)
        return
      }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      perfil.correo,
      { redirectTo: `${window.location.origin}/login` }
    )

    if (resetError) {
      setError("No se pudo enviar el correo de recuperación.")
    } else {
      setMensajeRecuperar("Correo de recuperación enviado. Revisa tu bandeja.")
    }

    setRecuperando(false)
  }

  return (
    <section className="register">
      <form onSubmit={handleSubmit}>
        <button type="button" className="btn-volver" onClick={() => navigate("/")}>
          ← Volver
        </button>
        <h3>Inicio de Sesión</h3>

        <Input
          placeholder="Usuario"
          type="password"
          required
          name="usuario"
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
