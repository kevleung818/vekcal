import test from "node:test";
import assert from "node:assert/strict";
import {
  castThreeCoins,
  castYao,
  formatHexagramOrdinal,
  hexagramList,
  resolveHexagrams,
} from "../src/core.js";
import { describeFocus, getInterpretationFocus } from "../server/focus.js";
import {
  getCategoryInterpretation,
  INTERPRETATION_CATEGORIES,
  INTERPRETATIONS,
} from "../server/interpretations.js";
import {
  getHexagramDetails,
  HEXAGRAM_DETAILS,
  HEXAGRAM_DETAIL_FIELDS,
} from "../server/hexagram-details.js";

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

test("three-coin outcomes map each face count to the traditional line", () => {
  const expected = [
    [[0, 0, 0], 6, false, true],
    [[1, 0, 0], 8, false, false],
    [[1, 1, 0], 7, true, false],
    [[1, 1, 1], 9, true, true],
  ];
  for (const [coins, value, yang, changing] of expected) {
    assert.deepEqual(castThreeCoins(coins), { value, yang, changing, coins });
  }
  assert.throws(() => castThreeCoins([0, 1]), RangeError);
  assert.throws(() => castThreeCoins([0, 1, 2]), RangeError);
});

test("all 64 King Wen hexagrams resolve to unique six-line patterns", () => {
  const list = hexagramList();
  assert.equal(list.length, 64);
  assert.equal(new Set(list.map(({ number }) => number)).size, 64);
  assert.equal(resolveHexagrams(linesFor([7, 7, 7, 7, 7, 7])).original.name, "乾為天");
  assert.equal(resolveHexagrams(linesFor([8, 8, 8, 8, 8, 8])).original.name, "坤為地");
  assert.equal(resolveHexagrams(linesFor([7, 7, 8, 7, 7, 7])).original.name, "天澤履");
});

test("hexagram ordinals use the traditional Chinese numbering", () => {
  assert.equal(formatHexagramOrdinal(1), "第一卦");
  assert.equal(formatHexagramOrdinal(10), "第十卦");
  assert.equal(formatHexagramOrdinal(24), "第二十四卦");
  assert.equal(formatHexagramOrdinal(47), "第四十七卦");
  assert.equal(formatHexagramOrdinal(59), "第五十九卦");
  assert.equal(formatHexagramOrdinal(64), "第六十四卦");
  for (let number = 1; number <= 64; number += 1) {
    assert.ok(!formatHexagramOrdinal(number).includes("undefined"));
  }
  assert.throws(() => formatHexagramOrdinal(65), RangeError);
});

test("changing lines produce the correct changed hexagram", () => {
  const { original, changed } = resolveHexagrams(linesFor([9, 9, 9, 9, 9, 9]));
  assert.equal(original.name, "乾為天");
  assert.equal(changed.name, "坤為地");
  const coinLines = Array.from({ length: 6 }, () => castThreeCoins([1, 1, 1]));
  const coinResult = resolveHexagrams(coinLines);
  assert.equal(coinResult.original.name, "乾為天");
  assert.equal(coinResult.changed.name, "坤為地");
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

test("category readings cover all hexagrams in both language versions", () => {
  assert.deepEqual(INTERPRETATION_CATEGORIES, ["運勢", "愛情", "疾病", "失物", "訴訟"]);
  for (const language of ["zh-Hant", "zh-HK"]) {
    assert.equal(INTERPRETATIONS[language].length, 64);
    for (const hexagram of INTERPRETATIONS[language]) {
      for (const category of INTERPRETATION_CATEGORIES) {
        assert.ok(hexagram[category].length > 0, `${language} ${category} entry is missing`);
      }
    }
  }
  assert.match(getCategoryInterpretation(1, "運勢", "zh-Hant"), /飛龍在天/);
  assert.match(getCategoryInterpretation(1, "運勢", "zh-HK"), /行緊大運/);
  assert.throws(() => getCategoryInterpretation(65, "運勢", "zh-Hant"), RangeError);
  assert.throws(() => getCategoryInterpretation(1, "無效分類", "zh-Hant"), TypeError);
});

test("detailed reference fields cover all hexagrams and preserve source differences", () => {
  assert.deepEqual(HEXAGRAM_DETAIL_FIELDS.map(([, label]) => label), [
    "卦形", "卦象", "吉凶", "解讀", "卦辭", "推斷", "大象",
  ]);
  const hexagrams = hexagramList();
  const trigramNames = {
    地: "坤", 山: "艮", 水: "坎", 風: "巽",
    雷: "震", 火: "離", 澤: "兌", 天: "乾",
  };
  for (const language of ["zh-Hant", "zh-HK"]) {
    assert.equal(HEXAGRAM_DETAILS[language].length, 64);
    for (const [index, details] of HEXAGRAM_DETAILS[language].entries()) {
      const hexagram = hexagrams[index];
      assert.equal(
        details.shape,
        `${trigramNames[hexagram.upper]}上${trigramNames[hexagram.lower]}下`,
      );
      for (const field of ["shape", "omen", "fortune", "inference", "bigImage"]) {
        assert.ok(details[field], `${language} ${field} reference is missing`);
      }
      if (language === "zh-HK") {
        assert.ok(details.interpretation, "zh-HK interpretation is missing");
        assert.ok(details.guaCi, "zh-HK guaCi is missing");
      }
    }
  }
  assert.equal(getHexagramDetails(24, "zh-HK").shape, "坤上震下");
  assert.equal(getHexagramDetails(24, "zh-HK").guaCi, "飛鳥喺高樹築巢點知畀小人用火燒，占到呢卦處境不利，各樣謀劃容易白費心機。");
  assert.equal(getHexagramDetails(24, "zh-Hant").interpretation, "");
  assert.throws(() => getHexagramDetails(0, "zh-Hant"), RangeError);
  assert.throws(() => getHexagramDetails(1, "en"), TypeError);
});
