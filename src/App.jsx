import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Home from "./componentes/home/Home"
import Login from "./componentes/login/login"
import Form from "./componentes/form/Form"
import DashboardEmpleado from "./componentes/dashboard/empleado/empleado"
import DashboardDiseñador from "./componentes/dashboard/diseñador/diseñador"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Form />} />
        <Route path="/dashboard/diseñador" element={<DashboardDiseñador/>}/>
        <Route path="/dashboard/empleado" element={<DashboardEmpleado/>}/>
      </Routes>
    </Router>
  )
}

export default App