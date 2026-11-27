import test from "node:test";
import assert from "node:assert/strict";
import { isBillingRequired } from "../server/billing-policy.js";
import { rateLimit } from "../server/rate-limit.js";

test("production always requires payment, even when the old flag is false", () => {
  assert.equal(isBillingRequired({ NODE_ENV: "production", PAYWALL_ENABLED: "false" }), true);
  assert.equal(isBillingRequired({ NODE_ENV: "production" }), true);
  assert.equal(isBillingRequired({ NODE_ENV: "development", PAYWALL_ENABLED: "false" }), false);
});

test("calculation requests are rejected after the limit", () => {
  const limit = rateLimit({ windowMs: 60_000, max: 2, name: "test-calculation" });
  const calls = [];
  const request = { ip: "203.0.113.5" };
  for (let index = 0; index < 3; index += 1) {
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; },
    };
    let continued = false;
    limit(request, response, () => { continued = true; });
    calls.push({ continued, statusCode: response.statusCode });
  }
  assert.equal(calls[0].continued, true);
  assert.equal(calls[1].continued, true);
  assert.equal(calls[2].continued, false);
  assert.equal(calls[2].statusCode, 429);
});
