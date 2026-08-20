// supabase/functions/chatbot/index.ts
//
// Edge Function del chatbot de Krypton.
// Usa Groq API (Llama 3.3 70B) con function calling real contra Supabase.
//
// Despliegue:
//   supabase functions deploy chatbot
//
// Requiere el secret GROQ_API_KEY ya guardado (supabase secrets set GROQ_API_KEY=...)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY están disponibles automáticamente
// dentro de cualquier Edge Function, no hace falta configurarlos.

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
];

// ── Ejecución real de cada tool contra Supabase ──
async function ejecutarTool(nombre: string, args: Record<string, unknown>) {
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
        // material_o_tipo esperado como "cara:marco", ej "lona:madera"
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
    const { mensaje, rol, usuario_id, historial } = await req.json();

    if (!mensaje || !usuario_id) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres el asistente virtual de Krypton Publicidad, una empresa de publicidad y marketing (impresión de lonas, vinil, letreros, lápidas, etc).
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
      usuario_id,
      rol: "user",
      contenido: mensaje,
    });

    // Primera llamada a Groq
    let groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.3,
      }),
    });

    let data = await groqRes.json();
    let choice = data.choices?.[0];

    // Si el modelo pidió usar tools, las ejecutamos y volvemos a llamar
    if (choice?.message?.tool_calls?.length) {
      const toolMessages = [];
      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const resultado = await ejecutarTool(toolCall.function.name, args);
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(resultado),
        });
      }

      const segundaLlamada = [...messages, choice.message, ...toolMessages];

      groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: segundaLlamada,
          temperature: 0.3,
        }),
      });

      data = await groqRes.json();
      choice = data.choices?.[0];
    }

    const respuestaFinal = choice?.message?.content || "No pude generar una respuesta, intenta de nuevo.";
    const toolUsada = choice?.message?.tool_calls?.[0]?.function?.name ?? null;

    // Guardar la respuesta del asistente
    await supabaseAdmin.from("chat_mensajes").insert({
      usuario_id,
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
