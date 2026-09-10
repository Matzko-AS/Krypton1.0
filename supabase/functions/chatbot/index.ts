import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Cliente con service role: ignora RLS, ve todo (pedidos/stock son datos
// compartidos de la empresa, ver justificación en la conversación).
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Precios base (mismos valores que src/componentes/dashboard/diseñador/calculadora/Calculadora.jsx) ──
const PRECIOS_BASE = {
  lona:             { label: "Lona",             precio: 12.00 },
  lona_translucida: { label: "Lona Translúcida", precio: 15.00 },
  vinil:            { label: "Vinil",            precio: 12.00, precioLaminado: 15.00 },
  pvc:              { label: "PVC",              precio: 15.00, precioLaminado: 18.00 },
  acrilico:         { label: "Acrílico",         precio: 18.00 },
};

const MARCOS = {
  madera:   { label: "Madera",   precio: 20.00 },
  metal:    { label: "Metal",    precio: 30.00 },
  luminoso: { label: "Luminoso", precio: 15.00 },
};

const CARAS_LETRERO = {
  lona:             { label: "Lona",             precio: 12.00 },
  lona_translucida: { label: "Lona Translúcida", precio: 15.00 },
};

const TIPOS_LAPIDA = {
  pvc:            { label: "PVC",            precio: 35.00 },
  acrilico:       { label: "Acrílico",       precio: 50.00 },
  pvc_reflectivo: { label: "PVC Reflectivo", precio: 50.00 },
  porcelanato:    { label: "Porcelanato",    precio: 160.00 },
  marmol:         { label: "Mármol",         precio: 200.00 },
};

const DESCUENTO_VOLUMEN = 0.10;

// ── Definición de las tools para Groq (formato compatible OpenAI function calling) ──
const TOOLS = [
  {
    type: "function",
    function: {
      name: "consultar_stock",
      description: "Busca el stock disponible de un material por nombre o tipo (lona, vinil, pvc, acrílico, etc).",
      parameters: {
        type: "object",
        properties: {
          nombre_material: { type: "string", description: "Nombre o tipo de material a buscar, ej: 'lona', 'vinil brillo'" },
        },
        required: ["nombre_material"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_pedido",
      description: "Busca pedidos por nombre de cliente y/o estado (pendiente, en_diseño, en_impresion, sin_material, terminado).",
      parameters: {
        type: "object",
        properties: {
          cliente_nombre: { type: "string", description: "Nombre del cliente a buscar (búsqueda parcial permitida)" },
          estado: { type: "string", description: "Estado del pedido a filtrar, opcional" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calcular_cotizacion",
      description: "Calcula el precio de un trabajo (material, letrero o lápida) dado ancho, largo y cantidad en cm.",
      parameters: {
        type: "object",
        properties: {
          tipo_trabajo: { type: "string", enum: ["material", "letrero", "lapida"] },
          material_o_tipo: { type: "string", description: "Clave del material (lona, vinil, pvc, acrilico...), tipo de lápida, o tipo de marco+cara si es letrero" },
          con_laminado: { type: "boolean", description: "Solo aplica si tipo_trabajo es material y el material admite laminado" },
          ancho_cm: { type: "number" },
          largo_cm: { type: "number" },
          cantidad: { type: "number" },
        },
        required: ["tipo_trabajo", "ancho_cm", "largo_cm", "cantidad"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_lista_precios",
      description: "Devuelve la lista completa de precios base por m² de materiales, marcos de letrero y tipos de lápida.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "resumen_contabilidad_dia",
      description: "Devuelve el resumen de ventas y gastos registrados el día de hoy.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_material",
      description: "Busca materiales disponibles por nombre o tipo. Úsala SIEMPRE antes de crear_pedido cuando el usuario mencione un material, para mostrarle las opciones exactas y evitar elegir uno incorrecto.",
      parameters: {
        type: "object",
        properties: {
          termino: {
            type: "string",
            description: "Palabra clave del material que el usuario mencionó, ej: 'lona', 'vinil', 'pvc'"
          }
        },
        required: ["termino"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "crear_pedido",
      description: "Crea un nuevo pedido en el sistema. SOLO llama esta función después de tener: cliente_nombre, cantidad, y (material_id exacto de buscar_material) O (datos de letrero). El pedido quedará pendiente de validación humana, nunca se confirma solo.",
      parameters: {
        type: "object",
        properties: {
          cliente_nombre: { type: "string" },
          cliente_contacto: { type: "string", description: "Teléfono o correo, opcional" },
          cantidad: { type: "integer" },
          material_id: { type: "string", description: "UUID exacto obtenido de buscar_material. Solo si NO es letrero." },
          es_letrero: { type: "boolean" },
          letrero_tipo: { type: "string", enum: ["luminoso", "no_luminoso", "backlight", "acrilico", "otro"] },
          letrero_alto: { type: "number" },
          letrero_largo: { type: "number" },
          fecha_entrega: { type: "string", description: "Formato YYYY-MM-DD" },
          especificaciones: { type: "string" }
        },
        required: ["cliente_nombre", "cantidad"]
      }
    }
  }
];

const TOOLS_PUBLICAS_PERMITIDAS = new Set([
  "consultar_lista_precios",
  "calcular_cotizacion",
  "buscar_material",
  "crear_pedido",
]);

function filtrarTools(modo: string | undefined) {
  if (modo === "cliente_publico") {
    return TOOLS.filter((t) => TOOLS_PUBLICAS_PERMITIDAS.has(t.function.name));
  }
  return TOOLS;
}

async function ejecutarTool(nombre: string, args: Record<string, unknown>, usuarioId: string | null) {
  switch (nombre) {
    case "consultar_stock": {
      const { data, error } = await supabaseAdmin
        .from("materiales")
        .select("nombre, tipo_material, subtipo, stock, unidad, estado")
        .or(`nombre.ilike.%${args.nombre_material}%,tipo_material.ilike.%${args.nombre_material}%`)
        .limit(10);
      if (error) return { error: error.message };
      return { resultados: data };
    }

    case "consultar_pedido": {
      let query = supabaseAdmin
        .from("pedidos")
        .select("cliente_nombre, cliente_contacto, estado, prioridad, cantidad, fecha_entrega, especificaciones")
        .order("created_at", { ascending: false })
        .limit(10);
      if (args.cliente_nombre) query = query.ilike("cliente_nombre", `%${args.cliente_nombre}%`);
      if (args.estado) query = query.eq("estado", args.estado);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { resultados: data };
    }

    case "calcular_cotizacion": {
      const ancho = Number(args.ancho_cm) || 0;
      const largo = Number(args.largo_cm) || 0;
      const cantidad = Number(args.cantidad) || 1;
      const areaM2 = (ancho / 100) * (largo / 100);
      let precioUnitario = 0;
      let detalle = "";

      if (args.tipo_trabajo === "material") {
        const mat = PRECIOS_BASE[args.material_o_tipo as string];
        if (!mat) return { error: "Material no reconocido" };
        precioUnitario = args.con_laminado && mat.precioLaminado ? mat.precioLaminado : mat.precio;
        detalle = `${mat.label}${args.con_laminado ? " + laminado" : ""}`;
      } else if (args.tipo_trabajo === "lapida") {
        const lap = TIPOS_LAPIDA[args.material_o_tipo as string];
        if (!lap) return { error: "Tipo de lápida no reconocido" };
        precioUnitario = lap.precio;
        detalle = lap.label;
      } else if (args.tipo_trabajo === "letrero") {
        const [claveCara, claveMarco] = String(args.material_o_tipo || "lona:madera").split(":");
        const cara = CARAS_LETRERO[claveCara] ?? CARAS_LETRERO.lona;
        const marco = MARCOS[claveMarco] ?? MARCOS.madera;
        precioUnitario = cara.precio + marco.precio;
        detalle = `${cara.label} + marco ${marco.label}`;
      } else {
        return { error: "tipo_trabajo no reconocido" };
      }

      const subtotal = areaM2 * precioUnitario * cantidad;
      const aplicaDescuento = cantidad >= 10;
      const descuento = aplicaDescuento ? subtotal * DESCUENTO_VOLUMEN : 0;
      const total = subtotal - descuento;

      return {
        detalle,
        area_m2: Number(areaM2.toFixed(4)),
        precio_por_m2: precioUnitario,
        subtotal: Number(subtotal.toFixed(2)),
        descuento_aplicado: Number(descuento.toFixed(2)),
        total: Number(total.toFixed(2)),
      };
    }

    case "consultar_lista_precios": {
      return { materiales: PRECIOS_BASE, marcos_letrero: MARCOS, caras_letrero: CARAS_LETRERO, lapidas: TIPOS_LAPIDA };
    }

    case "resumen_contabilidad_dia": {
      const hoy = new Date().toISOString().split("T")[0];
      const { data, error } = await supabaseAdmin
        .from("contabilidad")
        .select("tipo, monto")
        .eq("fecha", hoy);
      if (error) return { error: error.message };
      const ventas = data.filter((r) => r.tipo === "venta").reduce((s, r) => s + Number(r.monto), 0);
      const gastos = data.filter((r) => r.tipo === "gasto").reduce((s, r) => s + Number(r.monto), 0);
      return { ventas, gastos, neta: ventas - gastos, registros: data.length };
    }

    case "buscar_material": {
      const { termino } = args as { termino: string };
      const { data, error } = await supabaseAdmin
        .from("materiales")
        .select("id, nombre, subtipo, stock, unidad, estado")
        .ilike("nombre", `%${termino}%`)
        .neq("estado", "agotado");

      if (error) return { error: error.message };
      if (!data || data.length === 0) {
        return { mensaje: `No encontré materiales que coincidan con "${termino}".` };
      }
      return {
        opciones: data.map((m) => ({
          id: m.id,
          descripcion: `${m.nombre}${m.subtipo ? ` (${m.subtipo})` : ""} — Stock: ${m.stock} ${m.unidad}`,
        })),
      };
    }

    case "crear_pedido": {
      const {
        cliente_nombre, cliente_contacto, cantidad, material_id,
        es_letrero, letrero_tipo, letrero_alto, letrero_largo,
        fecha_entrega, especificaciones,
      } = args as Record<string, any>;

      if (!cliente_nombre || !cantidad) {
        return { error: "Faltan datos obligatorios: cliente_nombre y cantidad." };
      }
      if (!es_letrero && !material_id) {
        return { error: "Falta material_id. Usa buscar_material primero." };
      }

      const { data: pedidoCreado, error } = await supabaseAdmin
        .from("pedidos")
        .insert({
          usuario_id: usuarioId,
          cliente_nombre,
          cliente_contacto: cliente_contacto || null,
          cantidad: parseInt(String(cantidad)),
          descuento: parseInt(String(cantidad)) > 10,
          material_id: es_letrero ? null : material_id,
          letrero_tipo: es_letrero ? letrero_tipo : null,
          letrero_alto: es_letrero ? letrero_alto : null,
          letrero_largo: es_letrero ? letrero_largo : null,
          fecha_entrega: fecha_entrega || null,
          especificaciones: especificaciones || null,
          estado: "pendiente",
          origen: "chatbot",
          validado: false,
        })
        .select()
        .single();

      if (error) return { error: error.message };

      return {
        exito: true,
        mensaje: `Pedido creado con ID ${pedidoCreado.id}. Queda pendiente de validación por el equipo antes de entrar a producción.`,
        pedido_id: pedidoCreado.id,
      };
    }

    default:
      return { error: "Tool no reconocida" };
  }
}

// ── Handler principal ──
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mensaje, rol, usuario_id, historial, modo, conversacion_id } = await req.json();

    const esPublico = modo === "cliente_publico";

    if (!mensaje || (!esPublico && !usuario_id) || (esPublico && !conversacion_id)) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = esPublico
      ? `Eres el asistente virtual de Krypton Publicidad, empresa de publicidad e impresión (lonas, vinil, letreros, lápidas).
Hablas con un cliente potencial que llegó por WhatsApp. Puedes: 1) dar precios y cotizar trabajos, 2) tomar su pedido si lo solicita explícitamente.
Antes de crear un pedido, confirma con el cliente nombre, cantidad y detalles — nunca crees un pedido sin que el cliente lo haya pedido claramente.
Todo pedido queda pendiente de validación humana; díselo al cliente para que sepa que alguien del equipo lo contactará.
Responde en español, de forma breve, cálida y profesional.`
      : `Eres el asistente virtual de Krypton Publicidad, una empresa de publicidad y marketing (impresión de lonas, vinil, letreros, lápidas, etc).
Hablas con un usuario de rol "${rol}" dentro del sistema interno de gestión.
Puedes: 1) responder preguntas internas sobre stock y pedidos, 2) ayudar a cotizar trabajos para clientes, 3) responder preguntas generales sobre el negocio.
Usa las herramientas disponibles cuando la pregunta requiera datos reales (stock, pedidos, precios, contabilidad) en lugar de inventar cifras.
Responde siempre en español, de forma breve y directa.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(historial || []),
      { role: "user", content: mensaje },
    ];

    // Guardar el mensaje del usuario
    await supabaseAdmin.from("chat_mensajes").insert({
      usuario_id: esPublico ? null : usuario_id,
      conversacion_id: esPublico ? conversacion_id : null,
      rol: "user",
      contenido: mensaje,
    });

    // Bucle de tool calling: permite varias rondas encadenadas
    // (ej: buscar_material -> el modelo ve resultados -> crear_pedido)
    let conversationMessages = [...messages];
    let data;
    let choice;
    const MAX_ROUNDS = 5;
    const toolsDisponibles = filtrarTools(modo);

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: conversationMessages,
          tools: toolsDisponibles,
          tool_choice: "auto",
          temperature: 0.3,
        }),
      });

      data = await groqRes.json();
      choice = data.choices?.[0];

      if (!choice?.message?.tool_calls?.length) {
        break;
      }

      const toolMessages = [];
      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const resultado = await ejecutarTool(toolCall.function.name, args, usuario_id ?? null);
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(resultado),
        });
      }

      conversationMessages = [...conversationMessages, choice.message, ...toolMessages];
    }

    const respuestaFinal = choice?.message?.content || "No pude generar una respuesta, intenta de nuevo.";
    const toolUsada = choice?.message?.tool_calls?.[0]?.function?.name ?? null;

    // Guardar la respuesta del asistente
    await supabaseAdmin.from("chat_mensajes").insert({
      usuario_id: esPublico ? null : usuario_id,
      conversacion_id: esPublico ? conversacion_id : null,
      rol: "assistant",
      contenido: respuestaFinal,
      tool_usada: toolUsada,
    });

    return new Response(JSON.stringify({ respuesta: respuestaFinal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error en chatbot Edge Function:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});