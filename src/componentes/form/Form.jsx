
import "./Form.css"
import Input from "../inputs/inputs.jsx"
import Boton from "../boton/boton.jsx"
import { useState } from "react"

const form = () => {
  const[formData, setFormData]= useState({
    nombre: "",
    correo: "",
    contraseña: "",
    confirmarcontraseña:""
  })
  const[error,setError]=useState("");
  const handleChange=(e)=>{
    const{name,value}=e.target;
    setFormData({
      ...formData,
      [name]:value,
    })
  }
  const Handlesubmit=(e)=> {
    e.preventDefault();
    if (formData.contraseña !== formData.confirmarcontraseña) {
      setError("las contraseñas no coinciden, Por favor,verificar")
      return;
    }

    setError("");
    alert("Registro exitoso")
    console.log("datos ingresaos:",formData)
  }
  return (
    <section className="register">
       <form onSubmit={Handlesubmit} >
            <h3>REGISTRO</h3>
            <Input
            placeholder ="Nombre y Apellido"
              type="Text"
              required
              name="nombre"
              onChange={handleChange}
            />
            <Input
            placeholder ="Correo"
              type="email"
              required
              name="correo"
              onChange={handleChange}
            />
            <Input
            placeholder ="Contraseña"  
              type="password"
              required
              name="contraseña"
              onChange={handleChange}
            />
            <Input
            placeholder ="Confirma Contraseña" 
              type="password" 
              required
              name="confirmarcontraseña"
              onChange={handleChange}
            />
            {error && <p className="error-mensaje">{error}</p>}
            <Boton type="Submit">Registrar</Boton>
        </form>
    </section>
  )
}

export default form