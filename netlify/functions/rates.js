"use strict";

const { scrape, SOURCE_URL } = require("../../lib/bcv");
const { getLatest, setLatest, isFresh, getStorageStatus } = require("../../lib/store");
const { vetDateKey } = require("../../lib/cron");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300"
};

function respond(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function buildBody(payload, meta) {
  const storage = getStorageStatus();
  return {
    ok: true,
    rates: payload.rates,
    fechaValor: payload.fechaValor,
    fechaValorTexto: payload.fechaValorTexto,
    fechaValorISO: payload.fechaValorISO,
    actualizadoHoy: payload.fechaValor === vetDateKey(),
    fetchedAt: payload.fetchedAt,
    source: payload.source,
    storage: storage.mode,
    ...(storage.error ? { storageError: storage.error } : {}),
    storageDiag: { hasContext: storage.hasContext, envKeys: storage.envKeys },
    ...meta
  };
}

exports.handler = async (event = {}) => {
  const method = event.httpMethod || "GET";
  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (method !== "GET") return respond(405, { ok: false, error: "Metodo no permitido, usa GET" });

  try {
    const cached = await getLatest();
    if (isFresh(cached)) return respond(200, buildBody(cached.payload, { cache: true, stale: false }));
    const payload = await scrape({ retries: 2, timeoutMs: 4000, delayMs: 400 });
    await setLatest(payload);
    return respond(200, buildBody(payload, { cache: false, stale: false }));
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const cached = await getLatest();
    if (cached) {
      return respond(
        200,
        buildBody(cached.payload, {
          cache: true,
          stale: true,
          warning: `Scrape fallido, se sirve la ultima version: ${message}`
        })
      );
    }
    return respond(502, {
      ok: false,
      error: `No se pudieron obtener las tasas: ${message}`,
      source: SOURCE_URL
    });
  }
};
