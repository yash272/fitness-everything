const FOOD_RULES = [
  { label: "paneer sabzi", calories: 450, patterns: [/paneer\s+(sabzi|curry|subzi|bhurji)/i] },
  { label: "roti", calories: 110, patterns: [/\broti(s)?\b/i, /\bchapati(s)?\b/i] },
  { label: "curd", calories: 110, patterns: [/\bcurd\b/i, /\byogurt\b/i, /\bdahi\b/i] },
  { label: "protein bar", calories: 210, patterns: [/protein\s+bar/i] },
  { label: "ice cream sundae", calories: 850, patterns: [/ice\s+cream\s+sundae/i, /sundae/i] },
  { label: "rice", calories: 220, patterns: [/\brice\b/i] },
  { label: "dal", calories: 180, patterns: [/\bdal\b/i, /lentil/i] },
  { label: "rajma", calories: 260, patterns: [/\brajma\b/i] },
  { label: "chole", calories: 280, patterns: [/\bchole\b/i, /chana\s+masala/i] },
  { label: "paneer wrap", calories: 520, patterns: [/paneer\s+wrap/i] },
  { label: "cookie", calories: 220, patterns: [/\bcookie(s)?\b/i] },
  { label: "banana", calories: 105, patterns: [/\bbanana(s)?\b/i] },
  { label: "coffee", calories: 20, patterns: [/\bcoffee\b/i] }
];

const NUMBER_WORDS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6]
]);

function explicitCalories(description) {
  const match = String(description).match(/(?:^|\D)(\d{2,4})\s*(?:kcal|calories|cals|cal)\b/i);
  if (!match) return null;
  const calories = Number.parseInt(match[1], 10);
  if (!Number.isFinite(calories) || calories <= 0) return null;
  return calories;
}

function countFor(label, description) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const numericBefore = description.match(new RegExp(`(?:^|\\D)(\\d+)\\s*(?:x\\s*)?${escaped}s?\\b`, "i"));
  if (numericBefore) return Number.parseInt(numericBefore[1], 10);

  for (const [word, value] of NUMBER_WORDS) {
    if (new RegExp(`\\b${word}\\s+${escaped}s?\\b`, "i").test(description)) return value;
  }
  return 1;
}

export function estimateFoodCalories(description) {
  const text = String(description || "").trim();
  if (!text) return null;

  const explicit = explicitCalories(text);
  if (explicit !== null) {
    return {
      calories: explicit,
      confidence: "high",
      matchedItems: ["explicit calories"]
    };
  }

  const matchedItems = [];
  let total = 0;

  FOOD_RULES.forEach((rule) => {
    if (!rule.patterns.some((pattern) => pattern.test(text))) return;
    const count = countFor(rule.label, text);
    total += rule.calories * count;
    matchedItems.push(count > 1 ? `${count} ${rule.label}s` : rule.label);
  });

  if (!matchedItems.length) return null;

  return {
    calories: total,
    confidence: matchedItems.length >= 2 ? "medium" : "low",
    matchedItems
  };
}
