import React from 'react'
import "./inputs.css"

const inputs = ({placeholder,type,required}) => {
  const placeholdermodificado=`${placeholder}...`
  return (

    <div className='inputs'>
      <label htmlFor=""></label>
      <input 
      placeholder={placeholdermodificado} 
      type= {type || "text"}
      required={required}
      
      />
      </div>
  )
}

export default inputs