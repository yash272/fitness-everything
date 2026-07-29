import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStepsInput, normalizeWeightInput } from "./quickLogUtils.js";

test("weight accepts positive decimal values only", () => {
  assert.equal(normalizeWeightInput("75.2"), 75.2);
  assert.equal(normalizeWeightInput(" 80 "), 80);
  assert.equal(normalizeWeightInput("0"), null);
  assert.equal(normalizeWeightInput("-2"), null);
  assert.equal(normalizeWeightInput(""), null);
});

test("steps accepts non-negative whole numbers only", () => {
  assert.equal(normalizeStepsInput("8500"), 8500);
  assert.equal(normalizeStepsInput("0"), 0);
  assert.equal(normalizeStepsInput("-1"), null);
  assert.equal(normalizeStepsInput("12.5"), null);
  assert.equal(normalizeStepsInput(""), null);
});
