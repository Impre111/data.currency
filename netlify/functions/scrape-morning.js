"use strict";

const { runWindow } = require("../../lib/cron");

exports.handler = async () => {
  try {
    const result = await runWindow("morning");
    console.log("[bcv:morning]", JSON.stringify(result));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(result)
    };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error("[bcv:morning] error:", message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: message })
    };
  }
};
