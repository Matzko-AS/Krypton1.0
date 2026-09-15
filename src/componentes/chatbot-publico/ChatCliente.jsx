import { useState, useEffect, useRef } from "react"
import { supabase } from "../../supabase/supabaseClient"
import "./ChatCliente.css"

const WHATSAPP_NUMERO = "593997165947"
const WHATSAPP_MENSAJE = "Hola, vengo del chat de Kryptón y quiero hablar con un asesor."
const WHATSAPP_LINK = `https://wa.me/${593997165947}?text=${encodeURIComponent(WHATSAPP_MENSAJE)}`

const ChatCliente = () => {
  const [mensajes, setMensajes] = useState([])
  const [input, setInput] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [conversacionId, setConversacionId] = useState(null)
  const finRef = useRef(null)

  useEffect(() => {
    // Genera o recupera un id de conversación para esta sesión del navegador
    let id = sessionStorage.getItem("krypton_conversacion_id")
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem("krypton_conversacion_id", id)
    }
    setConversacionId(id)

    setMensajes([
      {
        rol: "asistente",
        contenido:
          "¡Hola! Soy el asistente virtual de Kryptón Publicidad. ¿En qué puedo ayudarte? Puedo darte precios, revisar disponibilidad o tomar tu pedido.",
      },
    ])
  }, [])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes])

  const enviarMensaje = async () => {
    if (!input.trim() || enviando) return

    const mensajeUsuario = { rol: "usuario", contenido: input.trim() }
    setMensajes((prev) => [...prev, mensajeUsuario])
    setInput("")
    setEnviando(true)

    try {
      // Convertir el historial local (rol/contenido) al formato que espera Groq (role/content)
      const historialParaGroq = mensajes.map((m) => ({
        role: m.rol === "usuario" ? "user" : "assistant",
        content: m.contenido,
      }))

      const { data, error } = await supabase.functions.invoke("chatbot", {
        body: {
          mensaje: mensajeUsuario.contenido,
          conversacion_id: conversacionId,
          modo: "cliente_publico",
          historial: historialParaGroq,
        },
      })

      if (error) throw error

      setMensajes((prev) => [
        ...prev,
        { rol: "asistente", contenido: data.respuesta },
      ])
    } catch (e) {
      console.error("Error chatbot:", e.message)
      setMensajes((prev) => [
        ...prev,
        {
          rol: "asistente",
          contenido: "Disculpa, tuve un problema para responder. ¿Puedes intentar de nuevo?",
        },
      ])
    } finally {
      setEnviando(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      enviarMensaje()
    }
  }

  return (
    <div className="chat-cliente-wrapper">
      <header className="chat-cliente-header">
        <div className="chat-cliente-brand">
          <h1>KRYPTON</h1>
          <span>Asistente virtual</span>
        </div>
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noreferrer"
          className="chat-cliente-whatsapp"
        >
          💬 Hablar con un asesor
        </a>
      </header>

      <div className="chat-cliente-mensajes">
        {mensajes.map((m, i) => (
          <div key={i} className={`chat-burbuja ${m.rol}`}>
            {m.contenido}
          </div>
        ))}
        {enviando && (
          <div className="chat-burbuja asistente chat-escribiendo">
            <span></span><span></span><span></span>
          </div>
        )}
        <div ref={finRef} />
      </div>

      <div className="chat-cliente-input-bar">
        <textarea
          className="chat-cliente-input"
          placeholder="Escribe tu mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="chat-cliente-enviar"
          onClick={enviarMensaje}
          disabled={enviando || !input.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  )
}

export default ChatCliente
