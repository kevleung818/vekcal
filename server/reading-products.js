import { calculateNumerology } from "./calculation-service.js";

export const READING_TAGS = [
  "感情",
  "事業",
  "家庭",
  "學業",
  "健康",
  "財富",
  "遷移",
  "合作",
  "時機",
  "心境",
];

export const PENTAGON_AXES = [
  { key: "relationship", label: "relationship" },
  { key: "luckCareer", label: "Luck/career" },
  { key: "health", label: "health" },
  { key: "wealthy", label: "wealthy" },
  { key: "general", label: "general" },
];

export const PRODUCT_PRICES = {
  pentagon: { amount: 8900, currency: "HKD", label: "五軸解讀" },
  sequence: { amount: 39000, currency: "HKD", label: "二十數解讀" },
  numerology: { amount: 8100, currency: "HKD", label: "數字測算" },
};

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asIntegers(values, count, max) {
  if (!Array.isArray(values) || values.length !== count) {
    throw httpError(`請輸入剛好 ${count} 個數字。`, 400);
  }
  return values.map((value) => {
    if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
      throw httpError(`每個數字須為 0 至 ${max} 的整數。`, 400);
    }
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > max) {
      throw httpError(`每個數字須為 0 至 ${max} 的整數。`, 400);
    }
    return number;
  });
}

// Deterministic 15–100 score. Each axis uses a different salt so the same
// numbers still spread across the five axes.
export function axisScore(numbers, salt) {
  let hash = salt >>> 0;
  for (const number of numbers) {
    hash = Math.imul(hash ^ number, 16777619) >>> 0;
  }
  return 15 + (hash % 86);
}

export function buildPentagonReading(input) {
  const tags = Array.isArray(input?.tags) ? input.tags.map((tag) => String(tag)) : [];
  if (tags.length !== 5 || new Set(tags).size !== 5 || tags.some((tag) => !READING_TAGS.includes(tag))) {
    throw httpError("請選擇剛好五個不重複的標籤。", 400);
  }
  const numbers = asIntegers(input?.numbers, 5, 999);
  const axes = PENTAGON_AXES.map((axis, index) => ({
    ...axis,
    score: axisScore(numbers, 0x9e3779b9 + index * 0x85ebca6b),
  }));
  return { service: "pentagon", tags, numbers, axes };
}

export function buildSequenceReading(input, locale) {
  const numbers = asIntegers(input?.numbers, 20, 99);
  const digits = numbers.map((number) => String(number).padStart(2, "0")).join("");
  const calculationLocale = locale === "zh-Hant" || locale === "zh-HK" ? "zh-TW" : locale;
  const result = calculateNumerology(digits, { locale: calculationLocale });
  delete result.groups;
  delete result.primary.split;
  delete result.secondary.split;
  return { service: "sequence", numbers, result };
}
