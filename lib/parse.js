"use strict";

const VALUE_BLOCKS = { dolar: "USD", euro: "EUR", yuan: "CNY" };

function parseNumeric(raw) {
  const text = String(raw).trim();
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized;
  if (lastComma === -1 && lastDot === -1) {
    normalized = text;
  } else if (lastComma > lastDot) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = text.replace(/,/g, "");
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`Valor numerico invalido: "${raw}"`);
  return value;
}

function extractRate(html, id) {
  const pattern = new RegExp(`id="${id}"[\\s\\S]{0,1500}?strong-tb"[^>]*>\\s*([0-9][0-9.,]*)`, "i");
  const match = html.match(pattern);
  if (!match) return null;
  return parseNumeric(match[1]);
}

function extractFechaValor(html) {
  const match = html.match(/Fecha Valor:\s*<span[^>]*content="([^"]+)"[^>]*>([^<]*)<\/span>/i);
  if (!match) return null;
  const iso = match[1].trim();
  const fecha = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error(`Fecha Valor invalida: "${iso}"`);
  const texto = match[2].replace(/\s+/g, " ").trim();
  return { fecha, texto, iso };
}

function parse(html) {
  if (typeof html !== "string" || html.length < 500) throw new Error("HTML vacio o demasiado corto");
  const rates = {};
  const missing = [];
  for (const [id, code] of Object.entries(VALUE_BLOCKS)) {
    const value = extractRate(html, id);
    if (value === null) missing.push(code);
    else rates[code] = value;
  }
  const fechaValor = extractFechaValor(html);
  if (!fechaValor) missing.push("Fecha Valor");
  if (missing.length) throw new Error(`No se encontraron datos en el HTML: ${missing.join(", ")}`);
  return {
    rates,
    fechaValor: fechaValor.fecha,
    fechaValorTexto: fechaValor.texto,
    fechaValorISO: fechaValor.iso
  };
}

module.exports = { parse, parseNumeric };
