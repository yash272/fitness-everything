import test from "node:test";
import assert from "node:assert/strict";
import { estimateFoodCalories } from "./foodCalorieEstimator.js";

test("estimates calories from common vegetarian meal descriptions", () => {
  assert.deepEqual(estimateFoodCalories("paneer sabzi with 2 rotis and curd"), {
    calories: 780,
    confidence: "medium",
    matchedItems: ["paneer sabzi", "2 rotis", "curd"]
  });
});

test("uses explicit kcal/calorie values when the user includes them", () => {
  assert.deepEqual(estimateFoodCalories("protein bar 210 calories"), {
    calories: 210,
    confidence: "high",
    matchedItems: ["explicit calories"]
  });
});

test("returns no estimate when no known food terms are present", () => {
  assert.equal(estimateFoodCalories("random meal I forgot"), null);
});
