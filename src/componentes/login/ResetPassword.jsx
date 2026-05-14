import { useState, useEffect } from "react"
import { supabase } from "../../supabase/supabaseClient.js"
import { useNavigate } from "react-router-dom"
import "../form/Form.css"

const ResetPassword = () => {
  const [password, setPassword] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const [listo, setListo] = useState(false)
  const [sesionValida, setSesionValida] = useState(false)
  const navigate = useNavigate()

  // Supabase detecta automáticamente el token del enlace
  // y dispara el evento PASSWORD_RECOVERY
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSesionValida(true)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (password !== confirmar) {
      setError("Las contraseñas no coinciden")
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }

    setCargando(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    })

    if (updateError) {
      setError("No se pudo actualizar la contraseña. Intenta solicitar el enlace de nuevo.")
      setCargando(false)
      return
    }

    setListo(true)
    setCargando(false)

    // Redirigir al login después de 2 segundos
    setTimeout(() => navigate("/login"), 2000)
  }

  // Enlace inválido o expirado
  if (!sesionValida) {
    return (
      <section className="register">
        <div style={{ textAlign: "center", padding: "20px" }}>
          <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
            Verificando enlace...
          </p>
          <p style={{ color: "#475569", fontSize: "12px" }}>
            Si ves esto por más de unos segundos, el enlace puede haber expirado.
          </p>
          <button
            className="btn-olvide"
            style={{ marginTop: "16px", display: "block" }}
            onClick={() => navigate("/login")}
          >
            Volver al login
          </button>
        </div>
      </section>
    )
  }

  // Contraseña actualizada
  if (listo) {
    return (
      <section className="register">
        <div style={{ textAlign: "center", padding: "20px" }}>
          <p style={{ color: "#22c55e", fontSize: "16px", fontWeight: 600 }}>
            ✅ Contraseña actualizada
          </p>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "8px" }}>
            Redirigiendo al login...
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="register">
      <form onSubmit={handleSubmit}>

        <button
          type="button"
          className="btn-volver"
          onClick={() => navigate("/login")}
        >
          ← Volver
        </button>

        <h3>Nueva Contraseña</h3>
        <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "16px" }}>
          Escribe tu nueva contraseña a continuación.
        </p>

        <input
          type="password"
          placeholder="Nueva contraseña"
          className="input-reset"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <input
          type="password"
          placeholder="Confirmar contraseña"
          className="input-reset"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          required
          minLength={6}
        />

        {error && <p className="error-mensaje">{error}</p>}

        <button type="submit" className="btn-submit-reset" disabled={cargando}>
          {cargando ? "Guardando..." : "Guardar nueva contraseña"}
        </button>

      </form>
    </section>
  )
}

export default ResetPassword
