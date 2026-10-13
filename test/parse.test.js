"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { parse, parseNumeric } = require("../lib/parse");
const { pickTargetVet, TICK_MS } = require("../lib/cron");

const fixture = fs.readFileSync(path.join(__dirname, "fixtures", "bcv_home.html"), "utf8");

test("extrae USD, EUR, CNY y Fecha Valor del HTML real", () => {
  const data = parse(fixture);
  assert.equal(data.rates.USD, 876.7976);
  assert.equal(data.rates.EUR, 982.00454402);
  assert.equal(data.rates.CNY, 131.03154748);
  assert.equal(data.fechaValor, "2026-10-13");
  assert.match(data.fechaValorTexto, /Martes, 13 Octubre 2026/);
  assert.equal(data.fechaValorISO, "2026-10-13T00:00:00-04:00");
});

test("convierte numeros del formato venezolano al internacional", () => {
  assert.equal(parseNumeric("876,79760000"), 876.7976);
  assert.equal(parseNumeric("982,00454402"), 982.00454402);
  assert.equal(parseNumeric("1.234,56"), 1234.56);
  assert.equal(parseNumeric("1,234.56"), 1234.56);
  assert.equal(parseNumeric("42"), 42);
});

test("falla si el HTML no trae los datos", () => {
  assert.throws(() => parse("<html><body>mantenimiento</body></html>"));
  assert.throws(() => parse(""));
});

test("elige un objetivo aleatorio alineado dentro de la ventana", () => {
  const start = Date.UTC(2026, 9, 13, 9, 0, 0, 0);
  const ticks = 24;
  assert.equal(pickTargetVet(start, ticks, () => 0), start);
  assert.equal(pickTargetVet(start, ticks, () => 0.999999), start + (ticks - 1) * TICK_MS);
  for (let i = 0; i < 100; i += 1) {
    const target = pickTargetVet(start, ticks);
    assert.ok(target >= start, "el objetivo no puede ser antes de la ventana");
    assert.ok(target < start + ticks * TICK_MS, "el objetivo no puede ser despues de la ventana");
    assert.equal((target - start) % TICK_MS, 0, "el objetivo debe estar alineado al tick de 5 min");
  }
});
