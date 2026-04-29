import { useNavigate } from "react-router-dom"
import "./home.css"

const Home = () => {
  const navigate = useNavigate()

  return (
    <section className="home">

      <div className="home-left">
        <div className="home-brand">
          <h2>KRYPTON</h2>
          <p>Sistema de Gestión con Blockchain</p>
        </div>

        <div className="home-preview">
          <div className="preview-card">
            <div className="preview-icon green">📦</div>
            <div>
              <h4>Gestión de Inventario</h4>
              <p>Control de materiales y stock en tiempo real</p>
            </div>
          </div>
          <div className="preview-card">
            <div className="preview-icon blue">📋</div>
            <div>
              <h4>Gestión de Pedidos</h4>
              <p>Seguimiento completo de cada pedido</p>
            </div>
          </div>
          <div className="preview-card">
            <div className="preview-icon purple">🔗</div>
            <div>
              <h4>Trazabilidad Blockchain</h4>
              <p>Registro inmutable de todas las operaciones</p>
            </div>
          </div>
        </div>
      </div>


      <div className="home-right">
        <div className="home-card">
          <h1 className="home-title">Bienvenido</h1>
          <p className="home-subtitle">
            Selecciona una opción para continuar
          </p>
          <div className="home-buttons">
            <button className="home-btn" onClick={() => navigate("/login")}>
              Iniciar Sesión
            </button>
            <button className="home-btn-outline" onClick={() => navigate("/register")}>
              Registrarse
            </button>
          </div>
        </div>
      </div>

    </section>
  )
}

export default Home