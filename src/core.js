export const TRIGRAMS = [
  { name: "坤", symbol: "地", lines: [0, 0, 0] },
  { name: "艮", symbol: "山", lines: [0, 0, 1] },
  { name: "坎", symbol: "水", lines: [0, 1, 0] },
  { name: "巽", symbol: "風", lines: [0, 1, 1] },
  { name: "震", symbol: "雷", lines: [1, 0, 0] },
  { name: "離", symbol: "火", lines: [1, 0, 1] },
  { name: "兌", symbol: "澤", lines: [1, 1, 0] },
  { name: "乾", symbol: "天", lines: [1, 1, 1] },
];

const HEXAGRAMS = [
  ["乾為天", 7, 7], ["坤為地", 0, 0], ["水雷屯", 4, 2], ["山水蒙", 2, 1],
  ["水天需", 7, 2], ["天水訟", 2, 7], ["地水師", 2, 0], ["水地比", 0, 2],
  ["風天小畜", 7, 3], ["天澤履", 6, 7], ["地天泰", 7, 0], ["天地否", 0, 7],
  ["天火同人", 5, 7], ["火天大有", 7, 5], ["地山謙", 1, 0], ["雷地豫", 0, 4],
  ["澤雷隨", 4, 6], ["山風蠱", 3, 1], ["地澤臨", 6, 0], ["風地觀", 0, 3],
  ["火雷噬嗑", 4, 5], ["山火賁", 5, 1], ["山地剝", 0, 1], ["地雷復", 4, 0],
  ["天雷無妄", 4, 7], ["山天大畜", 7, 1], ["山雷頤", 4, 1], ["澤風大過", 3, 6],
  ["坎為水", 2, 2], ["離為火", 5, 5], ["澤山咸", 1, 6], ["雷風恆", 3, 4],
  ["天山遯", 1, 7], ["雷天大壯", 7, 4], ["火地晉", 0, 5], ["地火明夷", 5, 0],
  ["風火家人", 5, 3], ["火澤睽", 6, 5], ["水山蹇", 1, 2], ["雷水解", 2, 4],
  ["山澤損", 6, 1], ["風雷益", 4, 3], ["澤天夬", 7, 6], ["天風姤", 3, 7],
  ["澤地萃", 0, 6], ["地風升", 3, 0], ["澤水困", 2, 6], ["水風井", 3, 2],
  ["澤火革", 5, 6], ["火風鼎", 3, 5], ["震為雷", 4, 4], ["艮為山", 1, 1],
  ["風山漸", 1, 3], ["雷澤歸妹", 6, 4], ["雷火豐", 5, 4], ["火山旅", 1, 5],
  ["巽為風", 3, 3], ["兌為澤", 6, 6], ["風水渙", 2, 3], ["水澤節", 6, 2],
  ["風澤中孚", 6, 3], ["雷山小過", 1, 4], ["水火既濟", 5, 2], ["火水未濟", 2, 5],
].map(([name, lower, upper], index) => ({
  name,
  number: index + 1,
  lower: TRIGRAMS[lower],
  upper: TRIGRAMS[upper],
  lines: [...TRIGRAMS[lower].lines, ...TRIGRAMS[upper].lines],
}));

const HEXAGRAM_BY_PATTERN = new Map(
  HEXAGRAMS.map((hexagram) => [hexagram.lines.join(""), hexagram]),
);

function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length !== 6) {
    throw new TypeError("A reading must contain exactly six lines, from the first line upward.");
  }
  if (lines.some((line) => (
    !line
    || ![6, 7, 8, 9].includes(line.value)
    || line.changing !== (line.value === 6 || line.value === 9)
  ))) {
    throw new TypeError("Each line must be a consistent 6, 7, 8, or 9 casting result.");
  }
}

function randomInt(max) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random numbers are unavailable in this browser.");
  }
  const limit = Math.floor(0x1_0000 / max) * max;
  const sample = new Uint16Array(1);
  do {
    crypto.getRandomValues(sample);
  } while (sample[0] >= limit);
  return sample[0] % max;
}

export function castYao(randomValue = randomInt(16)) {
  if (!Number.isInteger(randomValue) || randomValue < 0 || randomValue > 15) {
    throw new RangeError("The yarrow-stalk sample must be an integer from 0 to 15.");
  }
  if (randomValue === 0) return { value: 6, yang: false, changing: true };
  if (randomValue <= 5) return { value: 7, yang: true, changing: false };
  if (randomValue <= 12) return { value: 8, yang: false, changing: false };
  return { value: 9, yang: true, changing: true };
}

export function castThreeCoins(coins = Array.from({ length: 3 }, () => randomInt(2))) {
  if (
    !Array.isArray(coins)
    || coins.length !== 3
    || coins.some((face) => face !== 0 && face !== 1)
  ) {
    throw new RangeError("A three-coin cast must contain exactly three 0 or 1 faces.");
  }
  const heads = coins.reduce((sum, face) => sum + face, 0);
  const value = [6, 8, 7, 9][heads];
  return {
    value,
    yang: value === 7 || value === 9,
    changing: value === 6 || value === 9,
    coins: [...coins],
  };
}

export function resolveHexagrams(lines) {
  validateLines(lines);
  const originalPattern = lines.map((line) => (line.value === 7 || line.value === 9 ? 1 : 0));
  const changedPattern = lines.map((line, index) => (
    line.changing ? 1 - originalPattern[index] : originalPattern[index]
  ));
  const original = HEXAGRAM_BY_PATTERN.get(originalPattern.join(""));
  const changed = HEXAGRAM_BY_PATTERN.get(changedPattern.join(""));
  if (!original || !changed) throw new Error("The hexagram pattern could not be resolved.");
  return { original, changed };
}

export function getInterpretationFocus(lines, original, changed) {
  validateLines(lines);
  const changing = lines
    .map((line, index) => (line.changing ? index + 1 : null))
    .filter((position) => position !== null);
  const count = changing.length;

  if (count === 0) {
    return { rule: "靜卦", source: "本卦", positions: [], primary: null };
  }
  if (count === 1) {
    return { rule: "一爻變", source: "本卦", positions: changing, primary: changing[0] };
  }
  if (count === 2) {
    return { rule: "二爻變", source: "本卦", positions: changing, primary: changing[1] };
  }
  if (count === 3) {
    return { rule: "三爻變", source: "本卦與之卦", positions: [], primary: null };
  }
  if (count === 4 || count === 5) {
    const still = lines
      .map((line, index) => (!line.changing ? index + 1 : null))
      .filter((position) => position !== null);
    return {
      rule: `${count} 爻變`,
      source: "之卦",
      positions: still,
      primary: still[0],
    };
  }
  if (original.name === "乾為天") {
    return { rule: "六爻皆變", source: "乾卦用九", positions: [], primary: null };
  }
  if (original.name === "坤為地") {
    return { rule: "六爻皆變", source: "坤卦用六", positions: [], primary: null };
  }
  return { rule: "六爻皆變", source: "之卦", positions: [], primary: null };
}

export function describeFocus(focus, original, changed) {
  const sourceName = focus.source === "之卦" ? changed.name : original.name;
  if (focus.source === "乾卦用九") return "乾卦全變，參照用九之義：群龍無首，吉。";
  if (focus.source === "坤卦用六") return "坤卦全變，參照用六之義：利永貞。";
  if (focus.rule === "靜卦") return `無變爻，以本卦「${original.name}」卦辭為觀照重心。`;
  if (focus.rule === "一爻變") return `以本卦「${original.name}」第 ${focus.primary} 爻爻辭為觀照重心。`;
  if (focus.rule === "二爻變") {
    return `參看本卦「${original.name}」第 ${focus.positions.join("、")} 爻，以較上位的第 ${focus.primary} 爻為主。`;
  }
  if (focus.rule === "三爻變") {
    return `綜合參照本卦「${original.name}」與之卦「${changed.name}」卦辭，首重本卦。`;
  }
  if (focus.rule === "4 爻變") {
    return `參看之卦「${changed.name}」未變的第 ${focus.positions.join("、")} 爻，以較下位者為主。`;
  }
  if (focus.rule === "5 爻變") {
    return `以之卦「${changed.name}」唯一未變的第 ${focus.primary} 爻爻辭為觀照重心。`;
  }
  return `六爻皆變，以之卦「${sourceName}」卦辭為觀照重心。`;
}

export function hexagramList() {
  return HEXAGRAMS.map(({ name, number, lower, upper }) => ({
    name,
    number,
    lower: lower.symbol,
    upper: upper.symbol,
  }));
}

export function formatHexagramOrdinal(number) {
  if (!Number.isInteger(number) || number < 1 || number > 64) {
    throw new RangeError("Hexagram number must be from 1 to 64.");
  }
  const numerals = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const tens = Math.floor(number / 10);
  const ones = number % 10;
  if (tens === 0) return `第${numerals[number]}卦`;
  return `第${tens === 1 ? "" : numerals[tens]}十${ones === 0 ? "" : numerals[ones]}卦`;
}
