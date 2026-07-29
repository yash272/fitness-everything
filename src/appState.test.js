import test from "node:test";
import assert from "node:assert/strict";
import {
  createRootScreen,
  createWorkoutScreen,
  historyStateForScreen,
  previousDateKey,
  screenFromHistoryState,
  screensMatch,
  screenStorageValue,
  todayDateKey
} from "./appState.js";

test("date keys use local calendar dates", () => {
  const date = new Date(2026, 6, 1, 12);
  assert.equal(todayDateKey(date), "2026-07-01");
  assert.equal(previousDateKey(date), "2026-06-30");
});

test("workout screens preserve their root return destination", () => {
  assert.deepEqual(createWorkoutScreen("2026-07-28", "history"), {
    name: "workout",
    date: "2026-07-28",
    returnTo: "history"
  });
  assert.equal(screenStorageValue(createWorkoutScreen("2026-07-28", "history")), "history");
  assert.deepEqual(createRootScreen("today"), { name: "today" });
});

test("invalid root destinations fall back to today", () => {
  assert.deepEqual(createRootScreen("body"), { name: "today" });
  assert.equal(screenStorageValue({ name: "unknown" }), "today");
});

test("browser history preserves valid app screens", () => {
  const workout = createWorkoutScreen("2026-07-28", "history");
  const state = historyStateForScreen(workout, { existing: true });

  assert.deepEqual(state, {
    existing: true,
    fitnessScreen: workout
  });
  assert.deepEqual(screenFromHistoryState(state), workout);
  assert.deepEqual(
    screenFromHistoryState({ fitnessScreen: { name: "history" } }),
    createRootScreen("history")
  );
});

test("browser history rejects invalid screens and compares navigation targets", () => {
  assert.equal(screenFromHistoryState({ fitnessScreen: { name: "workout", date: "tomorrow" } }), null);
  assert.equal(screenFromHistoryState({ unrelated: true }), null);
  assert.equal(screensMatch(createRootScreen("today"), createRootScreen("today")), true);
  assert.equal(
    screensMatch(
      createWorkoutScreen("2026-07-28", "today"),
      createWorkoutScreen("2026-07-29", "today")
    ),
    false
  );
});
