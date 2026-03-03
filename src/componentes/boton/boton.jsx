import React from 'react'
import "./boton.css"

const Boton=({type="button",children})=> {
  return (
    <button className='Boton'type={type}>
    {children}
    </button>
  )
}

export default Boton