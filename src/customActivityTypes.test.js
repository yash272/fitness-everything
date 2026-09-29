import test from "node:test";
import assert from "node:assert/strict";
import { activityTypeOptions, loadCustomActivityTypes, saveCustomActivityType } from "./customActivityTypes.js";

test("a newly chosen custom activity is available after reopening without logging duration", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const userId = "test-user";
  saveCustomActivityType(storage, userId, "  Pickleball  ");
  const reopenedTypes = loadCustomActivityTypes(storage, userId);
  assert.deepEqual(reopenedTypes, ["Pickleball"]);
  assert.ok(activityTypeOptions([], reopenedTypes).includes("Pickleball"));
  saveCustomActivityType(storage, userId, "pickleball");
  assert.deepEqual(loadCustomActivityTypes(storage, userId), ["Pickleball"]);
  assert.deepEqual(loadCustomActivityTypes(storage, "another-user"), []);
});

test("logged timed activities on a strength day also return as activity suggestions", () => {
  const workouts = [{ split: "Push", exercises: [
    { name: "Ultimate Frisbee", tracking_type: "time", exercise_sets: [{ duration_minutes: 30 }] },
    { name: "Bench Press", tracking_type: "weighted", exercise_sets: [{ reps: 10 }] }
  ] }];
  assert.ok(activityTypeOptions(workouts, []).includes("Ultimate Frisbee"));
  assert.equal(activityTypeOptions(workouts, []).includes("Bench Press"), false);
});


test("the custom activity picker saves a selected name and uses the merged options", async () => {
  const { readFile } = await import("node:fs/promises");
  const view = await readFile(new URL("./WorkoutView.jsx", import.meta.url), "utf8");
  const app = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(view, /onRememberActivity\(type\)/);
  assert.match(app, /activityTypeOptions\(workouts, savedCustomActivityTypes\)/);
  assert.match(app, /onRememberActivity=\{rememberCustomActivity\}/);
});
