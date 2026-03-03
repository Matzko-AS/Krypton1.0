import "./Form.css"
import Input from "../inputs/inputs.jsx"
import Boton from "../boton/boton.jsx"

const form = () => {
  const Handlesubmit=(e)=> {
    e.preventDefault();
    console.log("el boton fue pulsado")
  }
  return (
    <section className="register">
       <form onSubmit={Handlesubmit} >
            <h3>REGISTRO</h3>
            <Input
            placeholder ="Nombre y Apellido"
              type="Text"
              required
            />
            <Input
            placeholder ="Correo"
              type="email"
              required
            />
            <Input
            placeholder ="Telefono"  
            />
            <Input
            placeholder ="Contraseña"  
              type="password"
              required
            />
            <Input
            placeholder ="Confirma Contraseña" 
              type="password" 
              required
            />
            <Boton type="Submit">Registrar</Boton>
        </form>
    </section>
  )
}
export default form 
//     d             D
