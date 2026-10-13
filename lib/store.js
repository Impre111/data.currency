"use strict";

const STORE_NAME = "bcv-rates";
const FIVE_MIN_MS = 5 * 60 * 1000;
const memory = new Map();
let blobsPromise;
let storageMode = "unknown";
let storageError = null;

function blobsOptions() {
  const env = process.env || {};
  const siteID = env.SITE_ID || env.NETLIFY_SITE_ID;
  const token = env.NETLIFY_BLOBS_TOKEN || env.NETLIFY_FUNCTIONS_TOKEN;
  if (typeof siteID === "string" && siteID && typeof token === "string" && token) {
    return { name: STORE_NAME, siteID, token };
  }
  return { name: STORE_NAME };
}

function loadBlobs() {
  if (!blobsPromise) {
    blobsPromise = import("@netlify/blobs")
      .then((module) => module.getStore(blobsOptions()))
      .then((store) => {
        storageMode = "blobs";
        return store;
      })
      .catch((error) => {
        storageMode = "memory";
        storageError = error && error.message ? error.message : String(error);
        console.error("[blobs] getStore fallo:", storageError);
        return null;
      });
  }
  return blobsPromise;
}

function noteError(scope, error) {
  storageError = `${scope}: ${error && error.message ? error.message : String(error)}`;
  console.error(`[blobs] ${storageError}`);
}

function getStorageStatus() {
  const env = process.env || {};
  return {
    mode: storageMode,
    error: storageError,
    hasContext: Boolean(globalThis.netlifyBlobsContext || env.NETLIFY_BLOBS_CONTEXT),
    envKeys: Object.keys(env).filter((key) => /NETLIFY|BLOBS|SITE|TOKEN/i.test(key)).sort()
  };
}

async function get(key) {
  try {
    const store = await loadBlobs();
    if (store) {
      const value = await store.get(key, { type: "json" });
      if (value !== null && value !== undefined) return value;
    }
  } catch (error) {
    noteError("get", error);
  }
  return memory.has(key) ? memory.get(key) : null;
}

async function set(key, value) {
  memory.set(key, value);
  try {
    const store = await loadBlobs();
    if (store) await store.set(key, JSON.stringify(value));
  } catch (error) {
    noteError("set", error);
  }
}

async function getLatest() {
  return get("latest");
}

async function setLatest(payload) {
  const entry = { fetchedAtMs: Date.now(), payload };
  await set("latest", entry);
  return entry;
}

function isFresh(entry, maxAgeMs = FIVE_MIN_MS) {
  return Boolean(entry) && Date.now() - entry.fetchedAtMs <= maxAgeMs;
}

async function saveSnapshot(dateKey, period, payload, updatedToday) {
  const key = `snap:${dateKey}`;
  const doc = (await get(key)) || { dateKey, snapshots: [] };
  doc.snapshots.push({
    period,
    at: new Date().toISOString(),
    fechaValor: payload.fechaValor,
    rates: payload.rates,
    updatedToday
  });
  if (doc.snapshots.length > 10) doc.snapshots = doc.snapshots.slice(-10);
  await set(key, doc);
  return doc;
}

module.exports = { get, set, getLatest, setLatest, isFresh, saveSnapshot, getStorageStatus, FIVE_MIN_MS };
