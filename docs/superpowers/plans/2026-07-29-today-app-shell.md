# Today App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four-tab shell with a Today-first experience that keeps weight trends prominent and makes dated weight and steps logging available without navigating away.

**Architecture:** `App.jsx` remains the data owner, while pure date/screen helpers and focused presentation components move into small modules. The shell exposes only Today and History as root destinations; Workout is pushed as a focused screen with an explicit return destination. Existing Supabase tables and export behavior remain unchanged.

**Tech Stack:** React 18, Vite 5, plain CSS, Lucide React, Supabase, Node test runner.

## Global Constraints

- Preserve the existing Supabase schema and all stored workout, set, step, and weight data.
- Keep light and dark themes, using the calm green-black visual direction and restrained lime accents.
- Use Spline Sans for interface text and IBM Plex Mono for numeric values.
- Do not restore bottom navigation or the Body tab.
- Weight quick logging defaults to today; steps quick logging defaults to yesterday and allows older dates.
- Valid values save on Enter or blur, while invalid or unchanged values do not write.
- Future workout dates remain blocked.

---

### Task 1: Screen And Date State

**Files:**
- Create: `src/appState.js`
- Create: `src/appState.test.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `todayDateKey(now?: Date): string`
- Produces: `previousDateKey(now?: Date): string`
- Produces: `createRootScreen(name: "today" | "history"): AppScreen`
- Produces: `createWorkoutScreen(date: string, returnTo: "today" | "history"): AppScreen`
- Produces: `screenStorageValue(screen: AppScreen): "today" | "history"`

- [ ] **Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createRootScreen, createWorkoutScreen, previousDateKey, screenStorageValue } from "./appState.js";

test("previousDateKey crosses month boundaries in local time", () => {
  assert.equal(previousDateKey(new Date(2026, 6, 1, 12)), "2026-06-30");
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
```

- [ ] **Step 2: Run `node --test src/appState.test.js` and verify it fails because `appState.js` does not exist**

- [ ] **Step 3: Implement the pure helpers and replace `activeView` with an `AppScreen` state in `App.jsx`**

```js
export function createWorkoutScreen(date, returnTo = "today") {
  return { name: "workout", date, returnTo };
}

export function screenStorageValue(screen) {
  return screen.name === "workout" ? screen.returnTo : screen.name;
}
```

The app must persist only the root destination, open Workout with `{ date, returnTo }`, and return to that root when the back action is pressed.

- [ ] **Step 4: Run `node --test src/appState.test.js` and `npm run lint`**

- [ ] **Step 5: Commit**

```bash
git add src/appState.js src/appState.test.js src/App.jsx
git commit -m "refactor: introduce focused app screen state"
```

### Task 2: Dated Quick Log Mutations

**Files:**
- Create: `src/quickLogUtils.js`
- Create: `src/quickLogUtils.test.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `normalizeWeightInput(value: string): number | null`
- Produces: `normalizeStepsInput(value: string): number | null`
- Produces in `Tracker`: `saveWeightLog({ date, weight }): Promise<boolean>`
- Reuses in `Tracker`: `saveDailyLog({ date, steps }): Promise<boolean>`

- [ ] **Step 1: Write failing validation tests**

```js
test("weight accepts positive decimal values only", () => {
  assert.equal(normalizeWeightInput("75.2"), 75.2);
  assert.equal(normalizeWeightInput("0"), null);
  assert.equal(normalizeWeightInput(""), null);
});

test("steps accepts non-negative whole numbers only", () => {
  assert.equal(normalizeStepsInput("8500"), 8500);
  assert.equal(normalizeStepsInput("-1"), null);
  assert.equal(normalizeStepsInput("12.5"), null);
});
```

- [ ] **Step 2: Run `node --test src/quickLogUtils.test.js` and verify the missing exports fail**

- [ ] **Step 3: Implement validation and replace `saveBody(event)` with `saveWeightLog({ date, weight })`**

`saveWeightLog` must upsert `body_logs` on `user_id,log_date`, update `bodyLogs` in date order, return `true` on success, and route errors into the existing notice state.

- [ ] **Step 4: Run the focused test and `npm test`**

- [ ] **Step 5: Commit**

```bash
git add src/quickLogUtils.js src/quickLogUtils.test.js src/App.jsx
git commit -m "feat: support dated weight and steps quick logs"
```

### Task 3: Today Screen And Header

**Files:**
- Create: `src/AppHeader.jsx`
- Create: `src/QuickLogRow.jsx`
- Create: `src/TodayView.jsx`
- Create: `src/WeightChart.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `src/navigationStyles.test.js`

**Interfaces:**
- `AppHeader({ screen, theme, onOpenToday, onOpenHistory, onBack, onToggleTheme, exportControl })`
- `QuickLogRow({ label, unit, date, value, inputMode, onDateChange, onCommit, saving })`
- `TodayView({ bodyLogs, workouts, range, setRange, onSaveWeight, onSaveSteps, onOpenWorkout, saving })`
- `WeightChart({ logs, range })`

- [ ] **Step 1: Change the source-level navigation test so it requires a labeled History action, a Workout back action, and no `.mobile-tabs` markup**

- [ ] **Step 2: Run `node --test src/navigationStyles.test.js` and verify the old shell fails the new assertions**

- [ ] **Step 3: Extract `WeightChart`, build `QuickLogRow`, and render the Today layout**

`QuickLogRow` tracks its initial value, commits a valid changed value on Enter or blur, restores the last saved value after a failed save, and displays a compact saving/saved state without a separate Save button.

`TodayView` renders in this order:

1. Latest weight, range control, dark graph, and change over the visible range.
2. Dated weight quick log defaulting to today.
3. Dated steps quick log defaulting to yesterday.
4. A compact selected-day workout summary that opens Workout directly.
5. Weekly and monthly workout consistency summaries.

- [ ] **Step 4: Replace the old top tabs, Body screen, Dashboard PR list, and mobile bottom navigation with `AppHeader` and `TodayView`**

Keep export inside an overflow menu. Keep the theme control there. The brand returns to Today. History remains a labeled action because it is used less often than daily logging.

- [ ] **Step 5: Implement the responsive green-black visual system in `styles.css`**

Use a dense mobile layout from 360 px, a constrained desktop column, maximum 8 px corner radii, no nested cards, visible focus styles only for keyboard focus, and stable chart dimensions. Remove the obsolete tab/body/dashboard styles after the new components render correctly.

- [ ] **Step 6: Run `node --test src/navigationStyles.test.js`, `npm test`, `npm run lint`, and `npm run build`**

- [ ] **Step 7: Commit**

```bash
git add src/AppHeader.jsx src/QuickLogRow.jsx src/TodayView.jsx src/WeightChart.jsx src/App.jsx src/styles.css src/navigationStyles.test.js
git commit -m "feat: build the Today-first app shell"
```

