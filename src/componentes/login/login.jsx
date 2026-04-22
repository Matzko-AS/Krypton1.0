import React from 'react'
import Input from "../inputs/inputs.jsx"
import Boton from '../boton/boton'
import { useState } from 'react'

const Login = () => {
  const[formData, setFormData]= useState({
      correo: "",
      contraseña: "",
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
    setError("");
    alert("inicio exitoso")
    console.log("inicio bien",formData)
  }

  return (
        <section className="register">
       <form onSubmit={Handlesubmit} >
            <h3>Inicio de sesion</h3>

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

            {error && <p className="error-mensaje">{error}</p>}
            <Boton type="Submit">Iniciar sesion</Boton>
        </form>
    </section>



  )
}

export default Login