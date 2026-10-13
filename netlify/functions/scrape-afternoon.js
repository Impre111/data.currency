"use strict";

const { runWindow } = require("../../lib/cron");

exports.handler = async () => {
  try {
    const result = await runWindow("afternoon");
    console.log("[bcv:afternoon]", JSON.stringify(result));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(result)
    };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error("[bcv:afternoon] error:", message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: message })
    };
  }
};
