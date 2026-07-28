# Fitness UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing fitness tracker as a calm, immersive, mobile-first Quiet Performance interface while preserving its current Supabase behavior and adding an accessible weight-point tooltip.

**Architecture:** Keep `Tracker` as the owner of data and mutations, and reshape only the presentational component tree in `src/App.jsx`. Extract deterministic weight-chart calculations into a small pure module so the new tooltip geometry can be tested without a browser. Replace the existing blue/grey CSS system with shared light/dark Quiet Performance tokens and one reusable focus-stage treatment per view.

**Tech Stack:** React 18, Vite 5, Lucide React, Supabase JS, CSS, Node's built-in test runner

## Global Constraints

- Do not change the Supabase schema, queries, mutation semantics, personal-record calculations, export payload, or stored data.
- Preserve independent Workout and Logs dates, including the current/past Workout date guard.
- Preserve active-tab, Logs week/month, theme, and Add Exercise draft/expanded-state persistence.
- A day is a workout only when at least one exercise set exists; no-set days display `Rest` or `Rest day`.
- An unset workout type remains blank and never defaults to Push.
- Logs remains read-only; steps remain editable only in Workout.
- Keep all logged sets visible and use compact mobile controls to minimize taps.
- Keep both light and dark themes; light uses `#EEF2ED`, dark uses `#172019`, and active accents use `#D7FF4F`.
- Use Spline Sans for interface text and IBM Plex Mono for numeric training data.
- Keep panel radii at `8px` or less, avoid gradients and decorative blobs, and use no nested cards.
- The only new behavior is a non-navigating date-and-weight tooltip for chart points.
- Respect `prefers-reduced-motion`.

---

### Task 1: Add Tested Weight-Chart Geometry

**Files:**
- Create: `src/weightChartUtils.js`
- Create: `src/weightChartUtils.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: body-log records shaped as `{ id, log_date, weight, body_fat? }`, a numeric day range, and an optional `Date`
- Produces: `buildWeightChartModel(logs, range, now)` returning `{ points, min, mid, max, svgPoints, areaPoints, labelIndexes }`

- [ ] **Step 1: Add the test command**

Add this script to `package.json`:

```json
"test": "node --test src/*.test.js"
```

- [ ] **Step 2: Write failing chart-model tests**

Create `src/weightChartUtils.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildWeightChartModel } from "./weightChartUtils.js";

const logs = [
  { id: "old", log_date: "2026-06-01", weight: 81.2 },
  { id: "b", log_date: "2026-07-26", weight: 78.6 },
  { id: "a", log_date: "2026-07-25", weight: 79.1 },
  { id: "c", log_date: "2026-07-27", weight: 78.4 }
];

test("filters to the requested range and sorts points chronologically", () => {
  const model = buildWeightChartModel(logs, 30, new Date("2026-07-27T12:00:00"));

  assert.deepEqual(model.points.map((point) => point.id), ["a", "b", "c"]);
  assert.equal(model.labelIndexes[0], 0);
  assert.equal(model.labelIndexes.at(-1), 2);
});

test("builds bounded plot coordinates and padded y-axis values", () => {
  const model = buildWeightChartModel(logs, 30, new Date("2026-07-27T12:00:00"));

  assert.equal(model.min, 77.9);
  assert.equal(model.max, 79.6);
  assert.equal(model.mid, 78.75);
  assert.match(model.svgPoints, /^0\.00,/);
  assert.match(model.svgPoints, /100\.00,/);
  assert.equal(model.areaPoints.startsWith("0,100 "), true);
  assert.equal(model.areaPoints.endsWith(" 100,100"), true);
  model.points.forEach((point) => {
    assert.equal(point.x >= 0 && point.x <= 100, true);
    assert.equal(point.y >= 16 && point.y <= 88, true);
  });
});

test("returns points without chart geometry when fewer than two weigh-ins exist", () => {
  const model = buildWeightChartModel(
    [{ id: "only", log_date: "2026-07-27", weight: 78.4 }],
    30,
    new Date("2026-07-27T12:00:00")
  );

  assert.equal(model.points.length, 1);
  assert.equal(model.svgPoints, "");
  assert.deepEqual(model.labelIndexes, []);
});
```

- [ ] **Step 3: Run the tests and confirm the missing-module failure**

Run:

```bash
npm test
```

Expected: FAIL because `src/weightChartUtils.js` does not exist.

- [ ] **Step 4: Implement the chart model**

Create `src/weightChartUtils.js`:

```js
function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildWeightChartModel(logs, range, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - range + 1);
  const points = logs
    .filter((entry) => entry.log_date >= localDateKey(cutoff))
    .slice()
    .sort((a, b) => a.log_date.localeCompare(b.log_date));

  if (points.length < 2) {
    return {
      points,
      min: null,
      mid: null,
      max: null,
      svgPoints: "",
      areaPoints: "",
      labelIndexes: []
    };
  }

  const weights = points.map((point) => Number(point.weight));
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const mid = (min + max) / 2;
  const xFor = (index) => (index / (points.length - 1)) * 100;
  const yFor = (value) => 88 - ((value - min) / (max - min || 1)) * 72;
  const plottedPoints = points.map((point, index) => ({
    ...point,
    x: xFor(index),
    y: yFor(Number(point.weight))
  }));
  const svgPoints = plottedPoints
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const labelIndexes = [...new Set([
    0,
    Math.floor((plottedPoints.length - 1) * 0.25),
    Math.floor((plottedPoints.length - 1) * 0.5),
    Math.floor((plottedPoints.length - 1) * 0.75),
    plottedPoints.length - 1
  ])];

  return {
    points: plottedPoints,
    min,
    mid,
    max,
    svgPoints,
    areaPoints: `0,100 ${svgPoints} 100,100`,
    labelIndexes
  };
}
```

- [ ] **Step 5: Run the unit tests**

Run:

```bash
npm test
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit the chart utility**

```bash
git add package.json src/weightChartUtils.js src/weightChartUtils.test.js
git commit -m "test: cover weight chart geometry"
```

---

### Task 2: Install the Quiet Performance Foundation

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing `activeView`, `theme`, `notice`, export state, and `navItems`
- Produces: shared `FocusStage({ className, children })`, updated app shell, and theme-aware visual tokens used by Tasks 3–5

- [ ] **Step 1: Add the shared focus-stage component**

Add near the existing small presentational helpers in `src/App.jsx`:

```jsx
function FocusStage({ className = "", children }) {
  return <section className={`focus-stage ${className}`.trim()}>{children}</section>;
}
```

- [ ] **Step 2: Update navigation copy and emphasis hooks**

Change the fourth nav label from `Progress` to `Body`, keep the internal id `body`, and add stable classes to both navigation renderers:

```jsx
<button
  key={item.id}
  className={`${activeView === item.id ? "active" : ""} ${item.id === "workout" ? "workout-tab" : ""}`.trim()}
  onClick={() => changeView(item.id)}
>
```

Keep `Dashboard`, `Logs`, and `Workout` unchanged. Update `viewTitles.body` to `Body`.

- [ ] **Step 3: Simplify the brand and page shell markup**

Keep the existing Bolt icon and actions, but remove the `Training Log` subtitle so the header reads as a compact tool:

```jsx
<div className="brand">
  <span className="brand-mark"><Bolt size={18} strokeWidth={2.4} /></span>
  <strong>fitness</strong>
</div>
```

Add the view class and key directly to the existing `<main>` so all current active-view branches stay in place:

```jsx
<main className={`app view-frame view-${activeView}`} key={activeView}>
```

Keep the existing closing `</main>` and do not move any state, handlers, notices, or active-view branches.

- [ ] **Step 4: Replace the CSS token block**

Replace the current font import and `:root` blocks with:

```css
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Spline+Sans:wght@400;500;600;700&display=swap");

:root {
  color-scheme: light;
  --background: #eef2ed;
  --surface: #fbfcfa;
  --surface-low: #e5ebe4;
  --surface-strong: #ffffff;
  --focus: #172019;
  --focus-raised: #202c24;
  --focus-text: #f4f7f3;
  --focus-muted: #aeb9b0;
  --line: rgba(23, 32, 25, 0.14);
  --line-soft: rgba(23, 32, 25, 0.08);
  --text: #172019;
  --muted: #526057;
  --faint: #748078;
  --accent: #d7ff4f;
  --accent-ink: #172019;
  --accent-soft: rgba(174, 213, 47, 0.18);
  --accent-line: rgba(137, 173, 35, 0.55);
  --danger: #d9564a;
  --danger-soft: rgba(217, 86, 74, 0.11);
  --chart-grid: rgba(244, 247, 243, 0.12);
  --chart-line: #d7ff4f;
  --chart-area: rgba(215, 255, 79, 0.08);
  --shadow: 0 1px 2px rgba(23, 32, 25, 0.05);
  --shadow-pop: 0 12px 32px rgba(9, 14, 10, 0.2);
  font-family: "Spline Sans", ui-sans-serif, system-ui, sans-serif;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --background: #111812;
  --surface: #18221a;
  --surface-low: #202c23;
  --surface-strong: #243128;
  --focus: #0c120d;
  --focus-raised: #172019;
  --focus-text: #f4f7f3;
  --focus-muted: #9eaba1;
  --line: rgba(238, 244, 239, 0.14);
  --line-soft: rgba(238, 244, 239, 0.08);
  --text: #f2f6f2;
  --muted: #b8c2ba;
  --faint: #89958c;
  --accent-soft: rgba(215, 255, 79, 0.12);
  --accent-line: rgba(215, 255, 79, 0.45);
  --danger: #ef766c;
  --danger-soft: rgba(239, 118, 108, 0.13);
  --shadow: none;
  --shadow-pop: 0 12px 32px rgba(0, 0, 0, 0.45);
}
```

- [ ] **Step 5: Establish shared geometry and typography**

Update the global, shell, header, control, and panel rules so:

```css
h1,
h2,
h3,
p {
  margin: 0;
  letter-spacing: 0;
}

.focus-stage {
  min-width: 0;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 18px;
  background: var(--focus);
  color: var(--focus-text);
}

.focus-stage h1,
.focus-stage h2,
.focus-stage h3,
.focus-stage strong {
  color: var(--focus-text);
}

.focus-stage p,
.focus-stage span,
.focus-stage small,
.focus-stage label {
  color: var(--focus-muted);
}

.data-value,
.chart-y-axis,
.chart-x-axis,
.set-row b,
.week-day,
.calendar-day,
input[type="number"] {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}

.panel-section,
.stat,
.exercise-card,
.auth-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: none;
}

.view-frame {
  animation: view-enter 170ms ease-out;
}

@keyframes view-enter {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Remove all negative letter spacing and all gradient backgrounds. Keep visible keyboard focus rules and the existing coarse-pointer suppression of unwanted mobile outlines.

- [ ] **Step 6: Verify foundation behavior**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands pass; tab, theme, date, and export handlers are unchanged.

- [ ] **Step 7: Commit the foundation**

```bash
git add src/App.jsx src/styles.css
git commit -m "style: establish quiet performance theme"
```

---

### Task 3: Rebuild Dashboard and Add Graph Tooltips

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `src/weightChartUtils.test.js`

**Interfaces:**
- Consumes: `buildWeightChartModel(logs, range)`, existing Dashboard props, and `formatDate(date)`
- Produces: interactive `WeightChart({ logs, range })` with local selected-point state and no data mutation

- [ ] **Step 1: Import the tested chart model**

Add to `src/App.jsx`:

```js
import { buildWeightChartModel } from "./weightChartUtils";
```

- [ ] **Step 2: Compute Dashboard's visible weight change**

At the start of `Dashboard`, immediately after `didWorkoutToday`, add:

```jsx
const chartModel = useMemo(() => buildWeightChartModel(bodyLogs, range), [bodyLogs, range]);
const firstVisibleWeight = chartModel.points[0] ? Number(chartModel.points[0].weight) : null;
const latestVisibleWeight = chartModel.points.at(-1) ? Number(chartModel.points.at(-1).weight) : null;
const visibleWeightChange = firstVisibleWeight === null || latestVisibleWeight === null
  ? null
  : latestVisibleWeight - firstVisibleWeight;
const visibleWeightChangeLabel = visibleWeightChange === null
  ? "--"
  : `${visibleWeightChange > 0 ? "+" : ""}${visibleWeightChange.toFixed(1)} kg`;
```

- [ ] **Step 3: Recompose Dashboard around one focus stage**

Replace the Dashboard fragment wrapper with `<div className="dashboard-layout">`, and replace the separate latest-weight stat and trend panel with:

```jsx
<FocusStage className="dashboard-focus">
  <div className="focus-stage-head">
    <div>
      <span className="stage-label">Latest weight</span>
      <strong className="stage-value data-value">
        {latestBody ? Number(latestBody.weight).toFixed(1) : "--"}
        <small> kg</small>
      </strong>
      <p>{latestBody ? formatDate(latestBody.log_date) : "No weigh-in yet"}</p>
    </div>
    <div className="segmented segmented-dark" aria-label="Weight range">
      {[30, 60, 90].map((days) => (
        <button
          key={days}
          className={range === days ? "active" : ""}
          onClick={() => setRange(days)}
        >
          {days}D
        </button>
      ))}
    </div>
  </div>
  <WeightChart logs={bodyLogs} range={range} />
  <div className="trend-meta trend-meta-dark">
    <div>
      <span>Change</span>
      <strong className="data-value">{visibleWeightChangeLabel}</strong>
    </div>
    <div>
      <span>Body fat</span>
      <strong className="data-value">{latestBody?.body_fat ? `${latestBody.body_fat}%` : "--"}</strong>
    </div>
  </div>
</FocusStage>
```

Keep the existing `dashboard-after-grid` containing Today, This Week, This Month, Steps Today, and Recent PRs after the focus stage, then close `dashboard-layout`. Use compact repeated stat records inside the existing lower grid rather than adding another outer card.

- [ ] **Step 4: Replace `WeightChart` with interactive point targets**

Use the tested model and local selection:

```jsx
function WeightChart({ logs, range }) {
  const [selectedPointId, setSelectedPointId] = useState(null);
  const model = useMemo(() => buildWeightChartModel(logs, range), [logs, range]);
  const selectedPoint = model.points.find((point) => point.id === selectedPointId);

  useEffect(() => {
    setSelectedPointId(null);
  }, [range]);

  if (model.points.length < 2) {
    return (
      <div className="chart empty-chart" role="img" aria-label="Weight trend chart">
        <span>Log at least two weights to see your trend</span>
      </div>
    );
  }

  return (
    <div
      className="chart graph-chart"
      role="group"
      aria-label={`Weight trend from ${formatDate(model.points[0].log_date)} to ${formatDate(model.points.at(-1).log_date)}`}
    >
      <div className="chart-y-axis" aria-hidden="true">
        <span>{model.max.toFixed(1)} kg</span>
        <span>{model.mid.toFixed(1)} kg</span>
        <span>{model.min.toFixed(1)} kg</span>
      </div>
      <div className="chart-plot">
        <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {[16, 52, 88].map((y) => (
            <line key={y} className="chart-gridline" x1="0" y1={y} x2="100" y2={y} />
          ))}
          <polygon className="chart-area" points={model.areaPoints} />
          <polyline className="chart-line" points={model.svgPoints} />
        </svg>
        {model.points.map((point) => (
          <button
            type="button"
            key={point.id}
            className={`chart-hit ${selectedPointId === point.id ? "selected" : ""}`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            aria-label={`${formatDate(point.log_date)}, ${Number(point.weight).toFixed(1)} kilograms`}
            onClick={() => setSelectedPointId(point.id)}
            onFocus={() => setSelectedPointId(point.id)}
          />
        ))}
        {selectedPoint ? (
          <output
            className="chart-tooltip"
            style={{
              left: `${Math.min(88, Math.max(12, selectedPoint.x))}%`,
              top: `${Math.max(8, selectedPoint.y - 10)}%`
            }}
          >
            {formatDate(selectedPoint.log_date)} · {Number(selectedPoint.weight).toFixed(1)} kg
          </output>
        ) : null}
      </div>
      <div className="chart-x-axis" aria-hidden="true">
        {model.labelIndexes.map((index) => (
          <span key={model.points[index].id}>{formatDate(model.points[index].log_date)}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Style the focus chart and tooltip**

Implement these contracts in `src/styles.css`:

```css
.dashboard-focus {
  padding: 18px 16px 16px;
}

.focus-stage-head {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.stage-label {
  display: block;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
}

.stage-value {
  display: block;
  margin-top: 8px;
  font-size: clamp(2.6rem, 9vw, 4.5rem);
  line-height: 0.95;
}

.stage-value small {
  font-family: "Spline Sans", sans-serif;
  font-size: 0.9rem;
}

.chart {
  height: 240px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.chart-plot {
  inset: 18px 14px 34px 56px;
}

.chart-gridline {
  stroke: var(--chart-grid);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.chart-hit {
  position: absolute;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  transform: translate(-50%, -50%);
}

.chart-hit::after {
  content: "";
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  background: var(--chart-line);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.chart-hit:hover::after,
.chart-hit:focus-visible::after,
.chart-hit.selected::after {
  transform: scale(1.65);
  box-shadow: 0 0 0 3px rgba(215, 255, 79, 0.2);
}

.chart-tooltip {
  position: absolute;
  z-index: 4;
  width: max-content;
  max-width: 150px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 7px 9px;
  background: var(--focus-raised);
  color: var(--focus-text);
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.68rem;
  transform: translate(-50%, -100%);
  box-shadow: var(--shadow-pop);
}
```

Keep y-axis labels left of the plot and x-axis labels below it. Do not use the previous grid-background gradients; render three explicit grid lines in the SVG or use pseudo-elements with solid borders.

- [ ] **Step 6: Add a tooltip-data regression test**

Extend the first unit test to assert:

```js
assert.equal(model.points[0].log_date, "2026-07-25");
assert.equal(Number(model.points[0].weight).toFixed(1), "79.1");
```

This locks the exact source values used by the tooltip.

- [ ] **Step 7: Verify Dashboard**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands pass. Manually verify 30D, 60D, and 90D ranges, mouse click, touch tap, and keyboard focus all show the matching date and weight without moving to another tab.

- [ ] **Step 8: Commit Dashboard**

```bash
git add src/App.jsx src/styles.css src/weightChartUtils.test.js
git commit -m "feat: redesign dashboard weight experience"
```

---

### Task 4: Rebuild the Workout Experience

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: all existing `WorkoutView` props and local edit state
- Produces: a focus-stage workout summary, persistent collapsed Add Exercise panel, and dense always-visible set records

- [ ] **Step 1: Move Workout controls into the focus stage**

Replace the opening `<section className="panel-section form">` with `<FocusStage className="workout-focus form">`, and replace its matching closing `</section>` immediately after the steps editor with `</FocusStage>`.

Replace only the first `daily-control-head` block with:

```jsx
<div className="daily-control-head">
  <div>
    <span className="stage-label">{selectedDate === todayKey() ? "Active session" : formatLongDate(selectedDate)}</span>
    <h2 className="workout-title">{selectedSplit ? workoutTypeLabel(selectedSplit) : "Set workout type"}</h2>
  </div>
  {!isEditingType ? (
    <button type="button" className="focus-action" onClick={() => setIsEditingType(true)}>Edit</button>
  ) : null}
</div>
```

Leave the existing `isEditingType` form, `workout-steps` block, `isEditingSteps` form, `saveWorkoutType`, `saveWorkoutSteps`, their drafts, and all Supabase handlers unchanged in their current order. Style focus-stage inputs with dark compatible surfaces; do not add another wrapper panel inside the focus stage.

- [ ] **Step 2: Keep Add Exercise collapsed but visually connected**

Retain the current `isAddingExercise` branch and parent-owned state. Change only labels and classes:

```jsx
<section className="add-exercise-bar">
  <button type="button" className="primary add-exercise-toggle" onClick={() => setIsAddingExercise(true)}>
    <Plus size={18} />Add Exercise
  </button>
</section>
```

When open, use `panel-section form add-exercise-form`. Keep every existing field, mode, set-row handler, and submit handler.

- [ ] **Step 3: Tighten exercise records without collapsing sets**

Keep the `selectedWorkout.exercises.map` structure and every set visible. Change the section heading to `Exercises`. Add `exercise-record` to the existing article class, then replace the opening set-list tag with:

```jsx
<div className="sets" role="list" aria-label={`${exercise.name} sets`}>
```

Replace each set row with:

```jsx
<div className="set-row" role="listitem" key={set.id}>
  <span>{index + 1}</span>
  <b>{formatSet(set, trackingType)}</b>
  <em>{set.is_pr ? "PR" : ""}</em>
</div>
```

Leave the exercise head, previous-best copy, PR badge, Repeat Set action, and delete action unchanged. Do not add accordions or per-exercise expansion state.

- [ ] **Step 4: Implement dense mobile workout styles**

Use:

```css
.workout-title {
  margin-top: 5px;
  font-size: 1.6rem;
}

.focus-action {
  min-height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  padding: 0 11px;
  background: transparent;
  color: var(--focus-text);
}

.add-exercise-bar {
  margin-bottom: 12px;
}

.exercise-list {
  gap: 8px;
}

.exercise-head {
  padding: 11px 12px;
}

.sets {
  gap: 0;
  padding: 4px 12px 8px;
}

.set-row {
  min-height: 34px;
  border-bottom: 1px solid var(--line-soft);
}

.set-row:last-child {
  border-bottom: 0;
}

.set-input-row {
  grid-template-columns: 28px minmax(0, 1fr) minmax(0, 1fr) 36px;
  gap: 6px;
  padding: 7px;
}
```

Ensure the weighted set editor stays on one row at 390px when labels and values fit; allow the existing small-phone rule to place the second numeric field on the next line only below the available width.

- [ ] **Step 5: Verify Workout regressions**

Run:

```bash
npm test
npm run lint
npm run build
```

Then manually confirm:

- Blank workout type does not show Push.
- Type and steps save for today and past dates.
- Future dates remain unavailable.
- Every logged set is visible.
- Add Exercise stays open with its draft after switching tabs and returning.
- Repeat and delete actions still call the existing handlers.

- [ ] **Step 6: Commit Workout**

```bash
git add src/App.jsx src/styles.css
git commit -m "style: focus the mobile workout flow"
```

---

### Task 5: Rebuild Logs and Body

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing `DailyView`, `DayWorkoutDetails`, `WeekGrid`, `CalendarGrid`, and `BodyView` props
- Produces: selected-day-first Logs layout and weight-entry-first Body layout

- [ ] **Step 1: Reorder Logs around the selected day**

Change the first Logs section class from `panel-section` to `log-navigator`. Keep its existing `section-head` markup and handlers unchanged. Replace only the calendar-mode branch beneath that header with:

```jsx
{calendarMode === "week" ? (
  <WeekGrid
    weekStart={weekStart}
    workouts={workouts}
    bodyLogs={bodyLogs}
    selectedDate={selectedDate}
    setSelectedDate={setSelectedDate}
  />
) : null}
```

After that section, replace the existing selected-workout section with:

```jsx
<FocusStage className="log-focus">
  <span className="stage-label">{formatLongDate(selectedDate)}</span>
  <h2>Workout</h2>
  <DayWorkoutDetails workout={selectedLog} bodyLog={selectedBodyLog} />
</FocusStage>

{calendarMode === "month" ? (
  <section className="panel-section month-calendar-panel">
    <CalendarGrid
      month={calendarMonth}
      workouts={workouts}
      bodyLogs={bodyLogs}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
    />
  </section>
) : null}
```

Do not add write controls to Logs. Keep `setSelectedDate` connected only to the Logs date.

- [ ] **Step 2: Make selected-day details focus-stage compatible**

Keep all `DayWorkoutDetails` branching and Rest semantics. Use class variants rather than duplicate markup:

```css
.log-focus .day-summary,
.log-focus .mini-exercise {
  border-color: rgba(255, 255, 255, 0.1);
  background: var(--focus-raised);
}

.log-focus .day-summary strong,
.log-focus .mini-exercise h3,
.log-focus .mini-exercise span {
  color: var(--focus-text);
}
```

No-set days must still render `Rest day`.

- [ ] **Step 3: Move Body entry into the focus stage**

Replace the opening `<form className="panel-section form" onSubmit={saveBody}>` and its current `Log Body` heading with:

```jsx
<FocusStage className="body-focus">
  <form className="form body-entry" onSubmit={saveBody}>
    <div>
      <span className="stage-label">Daily check-in</span>
      <h2>Log weight</h2>
    </div>
```

Keep the existing `two-fields` block and both inputs immediately after this heading. Change the save button class to `primary primary-accent`, then replace the form's current closing tag with:

```jsx
  </form>
</FocusStage>
```

Keep `saveBody`, `bodyForm`, input constraints, save-button copy, and history mapping unchanged.

- [ ] **Step 4: Style Logs and Body hierarchy**

Implement:

```css
.log-navigator {
  margin-bottom: 10px;
}

.log-navigator .section-head {
  margin-bottom: 8px;
}

.log-focus h2,
.body-focus h2 {
  margin-top: 5px;
  font-size: 1.4rem;
}

.body-entry input,
.workout-focus input {
  border-color: rgba(255, 255, 255, 0.14);
  background: var(--focus-raised);
  color: var(--focus-text);
}

.primary-accent {
  background: var(--accent);
  color: var(--accent-ink);
}
```

Keep the week strip compact on mobile. The month calendar may remain a seven-column grid but must appear after the selected-day focus stage.

- [ ] **Step 5: Verify Logs and Body regressions**

Run:

```bash
npm test
npm run lint
npm run build
```

Then manually confirm:

- Changing Logs date does not change Workout date.
- Week/month selection persists after leaving Logs.
- Month navigation and week navigation still work.
- No-set dates display Rest.
- Logs contains no edit controls.
- Body opens with weight entry before history.
- Weight and body-fat saves use the existing handler.

- [ ] **Step 6: Commit Logs and Body**

```bash
git add src/App.jsx src/styles.css
git commit -m "style: prioritize daily logs and body entry"
```

---

### Task 6: Responsive Polish and Full Verification

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.jsx` only if verification reveals an accessibility label or stable class is missing

**Interfaces:**
- Consumes: completed app shell and screen components
- Produces: verified mobile, tablet, and desktop layouts in both themes

- [ ] **Step 1: Add explicit responsive layouts**

Use the existing view classes from Task 2 and the `dashboard-layout` wrapper from Task 3. At `760px` and above:

```css
@media (min-width: 760px) {
  .app {
    width: min(100%, 1160px);
    padding-inline: 24px;
  }

  .app.view-workout,
  .app.view-daily,
  .app.view-body {
    max-width: 920px;
    margin-inline: auto;
  }
}

@media (min-width: 1040px) {
  .dashboard-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.85fr);
    gap: 14px;
    align-items: start;
  }

  .dashboard-focus,
  .dashboard-after-grid {
    margin-bottom: 0;
  }

  .dashboard-after-grid {
    grid-template-columns: 1fr;
  }
}
```

Replace the existing `1040px` Dashboard rule rather than stacking a second grid rule beneath it. Preserve mobile source order; only the CSS grid changes the wide-screen arrangement.

- [ ] **Step 2: Add final interaction polish**

Apply `150–180ms` transitions to buttons, segmented controls, Add Exercise, and chart marks without changing layout dimensions. Ensure:

```css
button:active {
  transform: scale(0.98);
}

.mobile-tabs button.workout-tab {
  color: color-mix(in srgb, var(--text) 72%, transparent);
}

.mobile-tabs button.workout-tab.active,
.desktop-tabs button.workout-tab.active {
  background: var(--accent);
  color: var(--accent-ink);
}
```

Do not animate page height, loop animation, or add decorative motion.

- [ ] **Step 3: Run automated verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands pass with no warnings that indicate broken React hooks or invalid CSS.

- [ ] **Step 4: Verify mobile at `390 × 844`**

Check all four tabs in light and dark modes. Confirm:

- Fixed navigation respects the bottom safe area.
- No text, inputs, tooltip, calendar cells, or set rows overlap.
- Chart units remain outside the line plot.
- The latest weight and graph are visible before Dashboard summaries.
- Add Exercise inputs remain dense and usable.
- Tapping icons does not produce the unwanted blue outline.

- [ ] **Step 5: Verify tablet at `768 × 1024`**

Check Dashboard, month Logs, an open Add Exercise form, and Body history in both themes. Confirm there is no accidental single-column stretching or clipped calendar content.

- [ ] **Step 6: Verify desktop at `1440 × 900`**

Check the Dashboard two-column hierarchy, desktop navigation, Workout date picker, graph tooltips near both plot edges, and both themes. Confirm the date picker still opens and future dates remain blocked.

- [ ] **Step 7: Inspect browser console**

Confirm there are no React key warnings, accessibility-related runtime errors, failed font requests that break layout, or Supabase errors caused by the redesign.

- [ ] **Step 8: Commit final polish**

```bash
git add src/App.jsx src/styles.css
git commit -m "style: finish responsive fitness redesign"
```
