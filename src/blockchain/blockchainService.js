import { supabase } from "../supabase/supabaseClient"

// Genera un hash SHA-256 con la Web Crypto API (sin librerías externas)
const generarHash = async (texto) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(texto)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export const registrarBloque = async ({
  entidad,        // "pedido", "material", "diseno"
  entidad_id,     // uuid del registro
  accion,         // "terminado", "aprobado", "eliminado", etc.
  usuario_id,     // uuid del usuario
  datosExtra = {} // cualquier info adicional para mostrar
}) => {
  try {
    // 1. Obtener el último bloque para encadenar
    const { data: ultimo } = await supabase
      .from("historial")
      .select("numero_bloque, hash_integridad")
      .order("numero_bloque", { ascending: false })
      .limit(1)
      .single()

    const hashAnterior = ultimo?.hash_integridad ?? "0000000000000000000000000000000000000000000000000000000000000000"
    const numeroBloque = (ultimo?.numero_bloque ?? 0) + 1

    // 2. Armar los datos del bloque
    const datos = JSON.stringify({
      entidad,
      entidad_id,
      accion,
      usuario_id,
      timestamp: new Date().toISOString(),
      ...datosExtra
    })

    // 3. Generar el hash propio: hash(datos + hash_anterior)
    const hashPropio = await generarHash(datos + hashAnterior)

    // 4. Insertar el bloque en historial
    const { error } = await supabase.from("historial").insert({
      entidad,
      entidad_id,
      accion,
      usuario_id,
      numero_bloque: numeroBloque,
      hash_anterior: hashAnterior,
      hash_integridad: hashPropio,
      datos,
    })

    if (error) throw error

    return { exito: true, hash: hashPropio, bloque: numeroBloque }

  } catch (e) {
    console.error("Error registrando bloque:", e.message)
    return { exito: false }
  }
}