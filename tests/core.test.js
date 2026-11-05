import test from "node:test";
import assert from "node:assert/strict";
import {
  castYao,
  describeFocus,
  getInterpretationFocus,
  hexagramList,
  resolveHexagrams,
} from "../src/core.js";

const linesFor = (values) => values.map((value) => ({
  value,
  yang: value === 7 || value === 9,
  changing: value === 6 || value === 9,
}));

test("yarrow outcomes preserve the 1:5:7:3 probability partition", () => {
  const expected = [
    [0, 6], [1, 7], [5, 7], [6, 8], [12, 8], [13, 9], [15, 9],
  ];
  for (const [sample, value] of expected) assert.equal(castYao(sample).value, value);
  assert.throws(() => castYao(16), RangeError);
});

test("all 64 King Wen hexagrams resolve to unique six-line patterns", () => {
  const list = hexagramList();
  assert.equal(list.length, 64);
  assert.equal(new Set(list.map(({ number }) => number)).size, 64);
  assert.equal(resolveHexagrams(linesFor([7, 7, 7, 7, 7, 7])).original.name, "乾為天");
  assert.equal(resolveHexagrams(linesFor([8, 8, 8, 8, 8, 8])).original.name, "坤為地");
  assert.equal(resolveHexagrams(linesFor([7, 7, 8, 7, 7, 7])).original.name, "天澤履");
});

test("changing lines produce the correct changed hexagram", () => {
  const { original, changed } = resolveHexagrams(linesFor([9, 9, 9, 9, 9, 9]));
  assert.equal(original.name, "乾為天");
  assert.equal(changed.name, "坤為地");
});

test("Zhu Xi focus follows the changing-line count", () => {
  const original = { name: "乾為天" };
  const changed = { name: "坤為地" };
  const cases = [
    [[7, 7, 7, 7, 7, 7], "靜卦", null],
    [[9, 7, 7, 7, 7, 7], "一爻變", 1],
    [[9, 7, 9, 7, 7, 7], "二爻變", 3],
    [[9, 9, 9, 7, 7, 7], "三爻變", null],
    [[9, 9, 9, 9, 7, 7], "4 爻變", 5],
    [[9, 9, 9, 9, 9, 7], "5 爻變", 6],
    [[9, 9, 9, 9, 9, 9], "六爻皆變", null],
  ];
  for (const [values, rule, primary] of cases) {
    const focus = getInterpretationFocus(linesFor(values), original, changed);
    assert.equal(focus.rule, rule);
    assert.equal(focus.primary, primary);
  }
  assert.match(
    describeFocus(getInterpretationFocus(linesFor([9, 9, 9, 9, 9, 9]), original, changed), original, changed),
    /用九/,
  );
  const kunFocus = getInterpretationFocus(linesFor([6, 6, 6, 6, 6, 6]), { name: "坤為地" }, original);
  assert.match(describeFocus(kunFocus, { name: "坤為地" }, original), /用六/);
});

test("invalid reading shape is rejected", () => {
  assert.throws(() => resolveHexagrams([]), TypeError);
  assert.throws(() => resolveHexagrams(linesFor([6, 7, 8, 9, 7, 5])), TypeError);
  assert.throws(() => getInterpretationFocus(
    [{ value: 9, changing: false }, ...linesFor([7, 7, 7, 7, 7])],
    { name: "乾為天" },
    { name: "坤為地" },
  ), TypeError);
});
