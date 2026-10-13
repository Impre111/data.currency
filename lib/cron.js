"use strict";

const { scrape } = require("./bcv");
const store = require("./store");

const VET_OFFSET_MS = -4 * 60 * 60 * 1000;
const TICK_MS = 5 * 60 * 1000;
const WINDOWS = {
  morning: { startHourVet: 9, ticks: 24 },
  afternoon: { startHourVet: 16, ticks: 12 }
};

function vetDateKey(nowMs = Date.now()) {
  return new Date(nowMs + VET_OFFSET_MS).toISOString().slice(0, 10);
}

function windowBounds(config, vetMs) {
  const date = new Date(vetMs);
  const start = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    config.startHourVet,
    0,
    0,
    0
  );
  return { start, end: start + config.ticks * TICK_MS };
}

function pickTargetVet(start, ticks, random = Math.random) {
  const index = Math.min(ticks - 1, Math.floor(random() * ticks));
  return start + index * TICK_MS;
}

function toLabel(vetMs) {
  const date = new Date(vetMs);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} VET`;
}

async function runWindow(period) {
  const config = WINDOWS[period];
  if (!config) throw new Error(`Periodo invalido: ${period}`);

  const nowMs = Date.now();
  const nowVet = nowMs + VET_OFFSET_MS;
  const dateKey = vetDateKey(nowMs);
  const bounds = windowBounds(config, nowVet);

  if (nowVet < bounds.start || nowVet >= bounds.end) {
    return { action: "skip", reason: "fuera_de_ventana", period, dateKey };
  }

  const slotKey = `slot:${dateKey}:${period}`;
  let slot = await store.get(slotKey);
  if (!slot) {
    slot = {
      dateKey,
      period,
      targetVetMs: pickTargetVet(bounds.start, config.ticks),
      executed: false,
      attempts: 0,
      fechaValor: null,
      updatedToday: false,
      lastError: null
    };
    await store.set(slotKey, slot);
  }

  const objetivo = toLabel(slot.targetVetMs);
  if (nowVet < slot.targetVetMs) {
    return { action: "skip", reason: "antes_del_objetivo", period, dateKey, objetivo };
  }

  if (slot.executed) {
    const reintentar = period === "afternoon" && !slot.updatedToday;
    if (!reintentar) {
      return {
        action: "skip",
        reason: "ya_ejecutado",
        period,
        dateKey,
        objetivo,
        intentos: slot.attempts,
        fechaValor: slot.fechaValor,
        actualizadoHoy: slot.updatedToday
      };
    }
  }

  try {
    const payload = await scrape({ retries: 3, timeoutMs: 7000, delayMs: 1000 });
    const updatedToday = payload.fechaValor === dateKey;
    slot = {
      ...slot,
      executed: true,
      attempts: slot.attempts + 1,
      fechaValor: payload.fechaValor,
      updatedToday,
      lastError: null,
      lastErrorAt: null,
      lastRunAt: new Date().toISOString()
    };
    await store.set(slotKey, slot);
    await store.setLatest(payload);
    await store.saveSnapshot(dateKey, period, payload, updatedToday);
    return {
      action: "scraped",
      period,
      dateKey,
      objetivo,
      intentos: slot.attempts,
      rates: payload.rates,
      fechaValor: payload.fechaValor,
      fechaValorTexto: payload.fechaValorTexto,
      actualizadoHoy: updatedToday
    };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    slot = { ...slot, lastError: message, lastErrorAt: new Date().toISOString() };
    await store.set(slotKey, slot);
    return { action: "error", period, dateKey, objetivo, error: message };
  }
}

module.exports = { runWindow, vetDateKey, pickTargetVet, windowBounds, WINDOWS, TICK_MS, VET_OFFSET_MS };
