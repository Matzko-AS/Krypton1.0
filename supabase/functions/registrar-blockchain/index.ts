// supabase/functions/registrar-blockchain/index.ts
//
// Edge Function que firma y envía una transacción real al contrato
// KryptonRegistro desplegado en Polygon Amoy Testnet.
//
// Requiere el secreto BLOCKCHAIN_PRIVATE_KEY configurado con:
//   supabase secrets set BLOCKCHAIN_PRIVATE_KEY=0xTU_CLAVE_AQUI

import { ethers } from "npm:ethers@6.13.4"

const CONTRACT_ADDRESS = "0x89BA0A96B13ec9D3cD116d7591885E63a9E26e7e"

// RPC público de Amoy. Si empiezas a notar fallos por rate limit,
// reemplaza esta URL por un endpoint de Alchemy/Ankr/Infura (plan free).
const RPC_URL = "https://polygon-amoy.g.alchemy.com/v2/ohuvHB76lSx2SOBf5zLKv"

const ABI = [
  "function registrarOperacion(string _hash_operacion, string _tipo_operacion) public",
  "function obtenerRegistro(uint256 _id) public view returns (string, string, uint256, address)",
  "function totalRegistros() public view returns (uint256)",
]

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { tipo_operacion, datos } = await req.json()

    if (!tipo_operacion || !datos) {
      return new Response(
        JSON.stringify({ error: "Faltan tipo_operacion o datos en el body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // ── Generar hash determinístico de la operación ──────────────────
    // Se incluye Date.now() para que cada llamada produzca un hash único
    // aunque los mismos datos se registren más de una vez.
    const datosString = JSON.stringify(datos) + Date.now().toString()
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(datosString))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash_operacion = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

    // ── Firmar y enviar la transacción real ───────────────────────────
    const privateKey = Deno.env.get("BLOCKCHAIN_PRIVATE_KEY")
    if (!privateKey) {
      throw new Error("BLOCKCHAIN_PRIVATE_KEY no está configurada como secreto")
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 80002, name: "amoy" }, { staticNetwork: true })
    const wallet = new ethers.Wallet(privateKey, provider)
    const contrato = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet)

    const tx = await contrato.registrarOperacion(hash_operacion, tipo_operacion)
    const receipt = await tx.wait()

    return new Response(
      JSON.stringify({
        success: true,
        tx_hash: receipt.hash,
        hash_operacion,
        tipo_operacion,
        block_number: receipt.blockNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("Error registrando en blockchain:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
