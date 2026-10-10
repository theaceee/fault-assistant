// Run: node tests/search.test.js   (no dependencies)
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { ManualIndex, tokenize } = require("../app/search.js");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../app/data/manual.json"), "utf8"));
const idx = new ManualIndex(data);

const cases = [
  ["motor is overheating and very hot", "motor-overheating"],
  ["pump will not start, no power", "pump-no-start"],
  ["પંપ શરૂ થતો નથી", "pump-no-start"],
  ["મોટર વધુ ગરમ થાય છે", "motor-overheating"],
  ["ઓછું દબાણ પાણી", "pump-low-pressure"],
  ["low pressure less water", "pump-low-pressure"],
  ["excessive vibration and noise from bearing", "excessive-vibration"],
  ["કંપન અવાજ", "excessive-vibration"],
  ["earth fault leakage trip RCD", "panel-earth-fault"],
  ["અર્થ ફોલ્ટ લીકેજ", "panel-earth-fault"],
];

let pass = 0;
for (const [q, expected] of cases) {
  const top = idx.search(q, { limit: 3 });
  const got = top[0] && top[0].doc.section;
  assert.strictEqual(got, expected, `Query "${q}" -> got ${got}, expected ${expected}`);
  pass++;
}

// Gibberish should return nothing (no false confident answer)
assert.strictEqual(idx.search("xyzzy qwerty").length, 0, "gibberish should not match");
assert.ok(tokenize("શરૂ થતો નથી").length > 0, "gujarati tokenization");

// Language preference: Gujarati query returns the gu variant when available
const gu = idx.search("મોટર ગરમ", { lang: "gu", limit: 1 })[0];
assert.strictEqual(gu.doc.lang, "gu");

console.log(`search tests passed: ${pass}/${cases.length} + edge cases`);
