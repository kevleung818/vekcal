import test from "node:test";
import assert from "node:assert/strict";
import { buildReadingResult } from "../server/payments.js";
import { axisScore } from "../server/reading-products.js";

test("saved number-reading results omit the original digit sequence", () => {
  const reading = buildReadingResult("numerology", { input: "13800138000" }, "en");
  assert.equal(reading.service, "numerology");
  assert.equal(reading.result.inputLength, 11);
  assert.equal("groups" in reading.result, false);
  assert.equal("split" in reading.result.primary, false);
  assert.equal(reading.result.numbers.length, 4);
});

test("pentagon readings score five axes from the entered numbers", () => {
  const reading = buildReadingResult("pentagon", {
    tags: ["感情", "事業", "家庭", "學業", "健康"],
    numbers: [8, 21, 5, 13, 34],
  }, "zh-TW");
  assert.equal(reading.service, "pentagon");
  assert.deepEqual(reading.axes.map((axis) => axis.label), [
    "relationship", "Luck/career", "health", "wealthy", "general",
  ]);
  assert.equal(reading.axes.length, 5);
  for (const axis of reading.axes) {
    assert.equal(axis.score, axisScore([8, 21, 5, 13, 34], {
      relationship: 0x9e3779b9,
      "Luck/career": 0x9e3779b9 + 0x85ebca6b,
      health: 0x9e3779b9 + 2 * 0x85ebca6b,
      wealthy: 0x9e3779b9 + 3 * 0x85ebca6b,
      general: 0x9e3779b9 + 4 * 0x85ebca6b,
    }[axis.label]));
    assert.ok(axis.score >= 15 && axis.score <= 100);
  }
  assert.deepEqual(reading.tags, ["感情", "事業", "家庭", "學業", "健康"]);
});

test("sequence readings turn twenty numbers into a saved calculation", () => {
  const numbers = Array.from({ length: 20 }, (_, index) => index + 1);
  const reading = buildReadingResult("sequence", { numbers }, "zh-TW");
  assert.equal(reading.service, "sequence");
  assert.equal(reading.numbers.length, 20);
  assert.equal(reading.result.inputLength, 40);
  assert.ok(reading.result.summary);
  assert.equal("groups" in reading.result, false);
});

test("invalid service inputs are rejected before checkout", () => {
  assert.throws(() => buildReadingResult("unknown", {}, "en"), { status: 400 });
  assert.throws(() => buildReadingResult("pentagon", { tags: ["感情"], numbers: [1] }, "zh-TW"), { status: 400 });
  assert.throws(() => buildReadingResult("sequence", { numbers: [1, 2, 3] }, "zh-TW"), { status: 400 });
  assert.throws(() => buildReadingResult("numerology", { input: "123" }, "en"), { status: 400 });
});
