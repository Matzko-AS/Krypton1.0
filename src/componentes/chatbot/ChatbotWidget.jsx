import { useState, useRef, useEffect } from "react";
import { supabase } from "../../supabase/supabaseClient";
import "./chatbotWidget.css";

// rol: "diseñador" | "empleado"
// usuario: objeto de supabase.auth.getUser() (necesita usuario.id)
const ChatbotWidget = ({ usuario, rol }) => {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, cargando]);

  const abrirChat = async () => {
    setAbierto(true);
    if (mensajes.length > 0) return; // ya hay algo cargado en esta sesión

    if (!usuario?.id) {
      setMensajes([
        {
          role: "assistant",
          content: "¡Hola! Soy el asistente de Krypton. ¿En qué te ayudo?",
        },
      ]);
      return;
    }

    setCargando(true);
    const { data, error } = await supabase
      .from("chat_mensajes")
      .select("rol, contenido, created_at")
      .eq("usuario_id", usuario.id)
      .order("created_at", { ascending: false })
      .limit(20);

    setCargando(false);

    if (error || !data || data.length === 0) {
      setMensajes([
        {
          role: "assistant",
          content: "¡Hola! Soy el asistente de Krypton. ¿En qué te ayudo?",
        },
      ]);
      return;
    }

    // vienen en orden descendente (más reciente primero), hay que invertir
    const historialCargado = data
      .reverse()
      .map((m) => ({ role: m.rol, content: m.contenido }));

    setMensajes(historialCargado);
  };

  const cerrarChat = () => {
    setAbierto(false);
  };

  const enviarMensaje = async () => {
    const texto = input.trim();
    if (!texto || cargando) return;
    if (!usuario?.id) {
      setError("No se pudo identificar tu usuario. Recarga la página.");
      return;
    }

    const nuevosMensajes = [...mensajes, { role: "user", content: texto }];
    setMensajes(nuevosMensajes);
    setInput("");
    setCargando(true);
    setError("");

    // Historial que se envía como contexto
    const historialParaApi = nuevosMensajes
      .slice(0, -1)
      .slice(-20) // límite de contexto
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "chatbot",
        {
          body: {
            mensaje: texto,
            rol,
            usuario_id: usuario.id,
            historial: historialParaApi,
          },
        },
      );

      if (fnError) throw fnError;

      const respuesta =
        data?.respuesta || "No obtuve una respuesta, intenta de nuevo.";
      setMensajes((prev) => [
        ...prev,
        { role: "assistant", content: respuesta },
      ]);
    } catch (e) {
      console.error("Error al invocar chatbot:", e);
      setError("No se pudo contactar al asistente. Intenta de nuevo.");
      setMensajes((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Tuve un problema para responder. ¿Puedes intentarlo de nuevo?",
        },
      ]);
    } finally {
      setCargando(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  return (
    <>
      {/* BURBUJA FLOTANTE */}
      {!abierto && (
        <button
          className="chatbot-fab"
          onClick={abrirChat}
          title="Abrir asistente"
        >
          💬
        </button>
      )}

      {/* PANEL DE CHAT */}
      {abierto && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <span className="chatbot-header-dot" />
              <span className="chatbot-header-title">Asistente Krypton</span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                className="chatbot-close"
                onClick={() =>
                  setMensajes([
                    {
                      role: "assistant",
                      content: "Conversación nueva. ¿En qué te ayudo?",
                    },
                  ])
                }
                title="Nueva conversación"
                style={{ fontSize: "13px" }}
              >
                🗑️
              </button>
              <button
                className="chatbot-close"
                onClick={cerrarChat}
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="chatbot-mensajes" ref={scrollRef}>
            {mensajes.map((m, i) => (
              <div
                key={i}
                className={`chatbot-burbuja ${m.role === "user" ? "user" : "assistant"}`}
              >
                {m.content}
              </div>
            ))}
            {cargando && (
              <div className="chatbot-burbuja assistant chatbot-escribiendo">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            )}
          </div>

          {error && <p className="chatbot-error">{error}</p>}

          <div className="chatbot-input-row">
            <textarea
              className="chatbot-input"
              placeholder="Escribe tu pregunta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={cargando}
            />
            <button
              className="chatbot-enviar"
              onClick={enviarMensaje}
              disabled={cargando || !input.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
