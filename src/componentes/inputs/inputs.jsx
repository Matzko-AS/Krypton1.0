import React from 'react'
import "./inputs.css"

const inputs = ({placeholder,type,required,name,onChange}) => {
  const placeholdermodificado=`${placeholder}...`
  return (

    <div className='inputs'>
      <label htmlFor=""></label>
      <input 
      placeholder={placeholdermodificado} 
      type= {type || "text"}
      required={required}
      name={name}
      onChange={onChange}
      
      />
      </div>
  )
}

export default inputs