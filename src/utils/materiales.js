// src/utils/materiales.js

export const tipoMat = (m) => (m?.tipo_material || "").toLowerCase();

export const m2 = (cm2) => ((Number(cm2) || 0) / 10000).toFixed(2);

// Convierte el área interna (cm²) a algo que el usuario entienda:
// rollos   -> "150 cm × 49.30 m"
// planchas -> "2.4 planchas de 150×200 cm"
export const formatoDisponible = (mat) => {
  const area = Number(mat?.area_disponible_cm2) || 0;
  const ancho = Number(mat?.ancho) || 0;
  const largo = Number(mat?.largo) || 0;

  if (area <= 0) return "Agotado";
  if (!ancho) return `${m2(area)} m²`;

  if ((mat.unidad || "").toLowerCase() === "metros") {
    const metros = area / ancho / 100;
    return `${ancho} cm × ${metros.toFixed(2)} m`;
  }

  if (largo) {
    const planchas = area / (ancho * largo);
    return `${planchas.toFixed(1)} planchas de ${ancho}×${largo} cm`;
  }
  return `${m2(area)} m²`;
};

// Cuánto material gasta un pedido (misma regla que el trigger de la base de datos):
// rollos   -> solo se gasta largo, el ancho del rollo no cambia
// planchas -> se gasta área
export const consumoMaterial = (mat, ancho, largo, cantidad = 1) => {
  const a = (Number(ancho) || 0) + 10;
  const l = (Number(largo) || 0) + 10;
  const esRollo = (mat?.unidad || "").toLowerCase() === "metros";

  if (!esRollo) {
    return {
      area: a * l * cantidad,
      cabe: true,
      texto: `${a} × ${l} cm de plancha${cantidad > 1 ? ` × ${cantidad}` : ""}`,
    };
  }

  const anchoRollo = Number(mat?.ancho) || 0;
  let consumo;
  let cabe = true;
  if (a <= anchoRollo) consumo = l * cantidad;
  else if (l <= anchoRollo) consumo = a * cantidad;
  else {
    consumo = l * cantidad;
    cabe = false;
  }
  return {
    area: anchoRollo * consumo,
    cabe,
    texto: `${(consumo / 100).toFixed(2)} m de largo del rollo (de ${anchoRollo} cm de ancho)`,
  };
};

// Capacidad total original (lo que se compró): stock × medida de cada rollo/plancha
export const capacidadCm2 = (mat) => {
  const stock = Number(mat?.stock) || 0;
  const ancho = Number(mat?.ancho) || 0;
  const largo = Number(mat?.largo) || 0;
  const esRollo = (mat?.unidad || "").toLowerCase() === "metros";
  const porUnidad = esRollo ? ancho * largo * 100 : ancho * largo;
  return stock * porUnidad;
};

// Porcentaje de material que queda (0 a 100)
export const porcentajeDisponible = (mat) => {
  const cap = capacidadCm2(mat);
  if (!cap) return 0;
  const area = Number(mat?.area_disponible_cm2) || 0;
  return Math.max(0, Math.min(100, (area / cap) * 100));
};