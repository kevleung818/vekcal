import test from "node:test";
import assert from "node:assert/strict";
import { buildReadingResult } from "../server/payments.js";

const linesFor = (values) => values.map((value) => ({
  value,
  yang: value === 7 || value === 9,
  changing: value === 6 || value === 9,
}));

test("saved number-reading results omit the original digit sequence", () => {
  const reading = buildReadingResult("numerology", { input: "13800138000" }, "en");
  assert.equal(reading.service, "numerology");
  assert.equal(reading.result.inputLength, 11);
  assert.equal("groups" in reading.result, false);
  assert.equal("split" in reading.result.primary, false);
  assert.equal(reading.result.numbers.length, 4);
});

test("saved I Ching results include both hexagrams and the selected category", () => {
  const reading = buildReadingResult("iching", {
    lines: linesFor([9, 7, 8, 8, 7, 9]),
    method: "coins",
    category: "愛情",
    language: "zh-HK",
    question: "How should I approach this change?",
  }, "zh-HK");
  assert.equal(reading.service, "iching");
  assert.equal(reading.original.name, "風澤中孚");
  assert.ok(reading.changed.name);
  assert.ok(reading.original.details.guaCi);
  assert.ok(reading.changed.details.interpretation);
  assert.ok(reading.categoryReading);
  assert.equal(reading.question, "How should I approach this change?");
});

test("invalid service inputs are rejected before checkout", () => {
  assert.throws(() => buildReadingResult("unknown", {}, "en"), { status: 400 });
  assert.throws(() => buildReadingResult("iching", { lines: [] }, "zh-TW"), { status: 400 });
  assert.throws(() => buildReadingResult("numerology", { input: "123" }, "en"), { status: 400 });
});
