# History Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the calendar-first Logs tab with a recent-session History screen that opens any prior workout directly while keeping consistency and calendar browsing available.

**Architecture:** Pure history helpers normalize workout activity, filtering, and consistency counts. `HistoryView` owns list/filter/calendar presentation, while `App.jsx` owns the selected date and opens the focused Workout screen with `returnTo: "history"`. Existing calendar utilities remain reusable but become secondary to the session list.

**Tech Stack:** React 18, Vite 5, plain CSS, Lucide React, Supabase, Node test runner.

## Global Constraints

- History defaults to a recent-session list, not a calendar.
- Filters are All, Push, Pull, Legs, and Activity.
- Days with no exercise sets are Rest even when stale workout metadata exists.
- Selecting a session opens that date in the same focused Workout screen used by Today.
- Returning from Workout restores History and its selected filter/calendar state.
- Consistency is summarized without a Recent PR section.
- The calendar remains available behind a calendar icon and retains week/month mode.
- Light and dark themes, mobile support, and future-date blocking remain intact.

---

### Task 1: History Data Model

**Files:**
- Create: `src/historyUtils.js`
- Create: `src/historyUtils.test.js`

**Interfaces:**
- Produces: `historyCategory(workout): "Push" | "Pull" | "Legs" | "Activity" | "Rest"`
- Produces: `recentHistoryItems(workouts, filter, limit = 30): Workout[]`
- Produces: `consistencySummary(workouts, today = new Date()): { week: number, month: number }`

- [ ] **Step 1: Write failing tests**

```js
test("metadata-only days remain Rest and are excluded from trained filters", () => {
  const stale = { workout_date: "2026-06-10", split: "Push", exercises: [] };
  assert.equal(historyCategory(stale), "Rest");
  assert.deepEqual(recentHistoryItems([stale], "Push"), []);
});

test("activity groups non-strength sessions with logged duration", () => {
  const badminton = timedWorkout("Badminton", 45);
  assert.equal(historyCategory(badminton), "Activity");
});
```

- [ ] **Step 2: Run `node --test src/historyUtils.test.js` and verify it fails because the module is absent**

- [ ] **Step 3: Implement category, filtering, descending-date ordering, and local week/month counts using `hasWorkoutActivity`**

- [ ] **Step 4: Run `node --test src/historyUtils.test.js` and `npm test`**

- [ ] **Step 5: Commit**

```bash
git add src/historyUtils.js src/historyUtils.test.js
git commit -m "feat: model recent workout history"
```

### Task 2: List-First History Screen

**Files:**
- Create: `src/HistoryView.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `src/calendarLayout.test.js`

**Interfaces:**
- `HistoryView({ workouts, bodyLogs, filter, onFilterChange, calendarMode, onCalendarModeChange, selectedDate, onSelectedDateChange, onOpenWorkout })`
- Consumes: `recentHistoryItems`, `historyCategory`, and `consistencySummary`

- [ ] **Step 1: Change the layout test to require the recent list before calendar markup and a calendar disclosure controlled by a labeled icon button**

- [ ] **Step 2: Run `node --test src/calendarLayout.test.js` and verify the old calendar-first screen fails**

- [ ] **Step 3: Build the default recent-session view**

Render a compact filter rail, week/month consistency, then descending session rows. Each row includes date, category or Rest, exercise count, set count or activity duration, and steps when available. Clicking a row calls `onOpenWorkout(workout.workout_date)`; Rest rows open an empty editable Workout date.

- [ ] **Step 4: Add the secondary calendar disclosure**

The calendar icon toggles a stable panel below the recent list. Preserve the selected week/month mode in local storage, keep navigation controls in the same position in both modes, and open the selected date in Workout through an explicit action or a second click.

- [ ] **Step 5: Remove `DailyView` as a root screen and wire History into `AppHeader` and `AppScreen`**

History filter, calendar mode, month, and selected date remain mounted or live in `Tracker`, so returning from Workout does not reset them.

- [ ] **Step 6: Finish responsive list and calendar styling**

On mobile, use a single-column list and horizontally scrollable filter rail. On desktop, keep the list dominant and constrain the calendar to the same content column. The month and week calendars must occupy a stable top position without jumping when modes change.

- [ ] **Step 7: Run `node --test src/calendarLayout.test.js`, `npm test`, `npm run lint`, and `npm run build`**

- [ ] **Step 8: Commit**

```bash
git add src/HistoryView.jsx src/App.jsx src/styles.css src/calendarLayout.test.js
git commit -m "feat: replace Logs with list-first History"
```

### Task 3: End-To-End Visual Verification

**Files:**
- Modify as needed: `src/App.jsx`
- Modify as needed: `src/styles.css`
- Modify as needed: focused component files

**Interfaces:**
- No new public interfaces; this task verifies the three redesign phases together.

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 2: Verify mobile at 390 x 844**

Check Today, dark/light theme, graph tooltip, weight blur save, yesterday steps save, opening Workout, every-set comparison, per-set confirmation, activity duration, History filters, and calendar modes. Confirm there is no bottom navigation, blue tap outline, overlap, or horizontal page scrolling.

- [ ] **Step 3: Verify desktop at 1400 x 900**

Repeat Today, Workout, and History flows. Confirm the date picker opens, the constrained column remains readable, Previous and Today rows align, and the calendar stays in a consistent position between week and month.

- [ ] **Step 4: Fix only issues found by verification, then rerun the affected checks**

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "fix: polish first-principles fitness flows"
```
