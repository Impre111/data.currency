"use strict";

const http = require("node:http");
const https = require("node:https");
const tls = require("node:tls");
const { parse } = require("./parse");
const { EXTRA_CA } = require("./ca");

const SOURCE_URL = "https://www.bcv.org.ve/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CA_CHAIN = [...tls.rootCertificates, EXTRA_CA];
const MAX_REDIRECTS = 3;

function requestOnce(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "http:" ? http : https;
    const req = client.request(
      url,
      {
        method: "GET",
        ca: CA_CHAIN,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-VE,es;q=0.9",
          "Cache-Control": "no-cache"
        }
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolve({ redirect: new URL(res.headers.location, url).toString() });
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`El BCV respondio HTTP ${status}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      }
    );
    const hardTimer = setTimeout(() => req.destroy(new Error(`Timeout tras ${timeoutMs} ms`)), timeoutMs);
    req.on("close", () => clearTimeout(hardTimer));
    req.on("timeout", () => req.destroy(new Error(`Timeout tras ${timeoutMs} ms`)));
    req.on("error", reject);
    req.end();
  });
}

async function fetchHtml(timeoutMs) {
  let url = SOURCE_URL;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const result = await requestOnce(new URL(url), timeoutMs);
    if (result.body !== undefined) return result.body;
    url = result.redirect;
  }
  throw new Error("El BCV respondio demasiadas redirecciones");
}

async function scrape(options = {}) {
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 4000;
  const delayMs = options.delayMs ?? 400;
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const html = await fetchHtml(timeoutMs);
      const data = parse(html);
      return { ...data, fetchedAt: new Date().toISOString(), source: SOURCE_URL };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw new Error(
    `Scrape fallido tras ${retries} intentos: ${lastError ? lastError.message : "error desconocido"}`
  );
}

module.exports = { scrape, SOURCE_URL };
