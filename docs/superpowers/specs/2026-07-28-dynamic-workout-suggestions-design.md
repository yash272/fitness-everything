# Dynamic Workout Suggestions Design

Date: 2026-07-28
Status: Approved for planning

## Goal

Make each Push, Pull, and Legs suggestion respond to prior performance while keeping the existing five-exercise templates. Replace the long, fully expanded suggestion editor with a compact accordion that shows the complete session at a glance.

## Scope

- Keep five template exercises for Push, Pull, and Legs.
- Calculate each exercise target from its latest prior matching exercise in the same workout category.
- Use the best prior set as the progression anchor.
- Generate three identical target sets from the calculated next target.
- Preserve editable suggestion drafts across app-tab changes.
- Redesign the suggestion surface as a compact accordion.
- Keep existing Supabase tables and workout logging behavior unchanged.

This change does not add new workout categories, modify the database schema, or automatically log suggested exercises.

## Progression Model

### History selection

For each template exercise:

1. Consider workouts whose category canonically matches the selected Push, Pull, or Legs category.
2. Consider only workouts earlier than the selected workout date.
3. Search newest to oldest for the latest workout containing an exercise with the same normalized name.
4. Ignore matching exercises that have no valid weighted sets.
5. Fall back to the current static template prescription when no history exists.

The lookup is per exercise. One suggested session can therefore draw its five exercise targets from different historical dates.

### Best-set ranking

Rank valid weighted sets with the Epley estimated-strength formula:

```text
estimated strength = weight * (1 + reps / 30)
```

The highest estimated strength wins. If two sets tie, prefer the heavier set, then the higher-repetition set.

### Next-target rule

For the best set:

- If reps are below 12, keep the weight and add 2 reps, capped at 12.
- If reps are 12 or higher, add 5 lb and reset to 7 reps.

Examples:

```text
40 lb x 10 -> 40 lb x 12
40 lb x 12 -> 45 lb x 7
40 lb x 11 -> 40 lb x 12
```

The calculated target becomes three identical sets.

### Explainability

Each dynamically calculated exercise carries:

- the source workout date;
- the previous best set;
- a short progression label such as `+2 reps` or `+5 lb`.

Fallback template exercises are labeled `Baseline`.

## Data Flow

`workoutPlan.js` remains the pure planning boundary:

```text
selected split + selected date + loaded workouts
                       |
                       v
        buildProgressivePlanForSplit(...)
                       |
                       v
        five editable suggested exercises
```

The planner does not read local storage or call Supabase. `WorkoutView` supplies the loaded workout history and owns draft persistence.

Suggested-plan draft keys receive a new version so older static drafts do not hide the new dynamic recommendations. A new date/category loads a calculated draft. User edits continue to persist for that date/category across app-tab changes.

Reset rebuilds the dynamic plan from the latest loaded history. It does not restore the old hard-coded values unless an exercise has no matching history.

Logging an exercise continues through the existing `acceptSuggestedPlan` path. No backend behavior changes.

## Interface Design

### Direction

The suggestion surface becomes a training prescription ledger rather than a stack of nested edit cards. It uses the existing Quiet Performance design system:

- green-black focus surfaces;
- lime action accent;
- Spline Sans interface type;
- IBM Plex Mono for weights, reps, and set prescriptions;
- 6 to 8 px radii;
- restrained 170 ms motion;
- no gradients or nested cards.

### Collapsed state

All five exercises are visible without expanding their form fields:

```text
NEXT SESSION                         [hide] [...]
Legs - based on 22 Jul                 5 movements

Leg Extension          3 x 150 lb x 7      +5 lb  >
Goblet Squat          3 x 50 lb x 12      +2 reps >
Leg Curl             3 x 115 lb x 12      +2 reps >
Romanian Deadlift     3 x 50 lb x 12      +2 reps >
Calf Raise             3 x 95 lb x 7       +5 lb  >
```

Rows use dividers instead of individual cards. The exercise name and prescription remain readable on a 390 px viewport. Long names wrap without pushing the prescription outside the row.

### Expanded state

- All rows start collapsed.
- Tapping a row expands that exercise.
- Only one exercise is expanded at a time.
- The expanded region contains the existing editable name, set rows, Add Set, Skip, and Log Exercise controls.
- Opening a different row closes the previous one.
- Already logged state remains visible in both collapsed and expanded views.

### Plan controls

- Hide Plan becomes an icon button in the plan header, always reachable without scrolling.
- Reset Suggestions and Add Exercise move into a `...` overflow menu in the header.
- The overflow menu closes after an action, on outside interaction, or when the plan is hidden.
- Icon buttons have accessible names, titles, visible keyboard focus, and at least a 40 px touch target.
- Hidden and empty-plan recovery panels keep their current behavior with shorter copy.

### Motion

Accordion expansion uses a single 170 ms opacity and vertical-position transition. No looping animation or page-height animation is added. Existing reduced-motion rules disable the transition.

## Error And Edge Behavior

- Invalid or incomplete historical sets are ignored.
- Unknown categories continue to return no suggested plan.
- Missing history uses baseline template values.
- Clearing the active workout type hides the suggestion plan as it does now.
- Future workout dates remain blocked by the existing guard.
- A failed exercise log leaves the suggestion in place and uses the existing notice handling.
- Existing draft persistence remains best-effort when local storage is unavailable.

## Testing

Automated tests will cover:

- category and date filtering;
- latest matching exercise selection;
- Epley ranking and deterministic tie-breaking;
- `+2 reps` progression with the 12-rep cap;
- `+5 lb, reset to 7` progression;
- three identical generated sets;
- missing-history fallback;
- unknown-category behavior;
- versioned draft storage keys;
- dynamic reset behavior at the pure-planner boundary.

Live verification will cover:

- all five collapsed rows visible at 390 x 844;
- one-open-at-a-time accordion behavior;
- editing and logging an expanded exercise;
- top-position Hide Plan control;
- overflow Reset and Add Exercise actions;
- light and dark themes;
- tablet and desktop layouts;
- keyboard focus and reduced motion;
- no browser warnings or errors.

## Success Criteria

- A prior best of `40 lb x 10` produces `3 x 40 lb x 12`.
- A prior best of `40 lb x 12` produces `3 x 45 lb x 7`.
- The source date and progression reason are visible.
- The entire five-exercise prescription is scannable before expansion on mobile.
- Hide Plan is available at the top of the suggestion surface.
- Existing editing, skipping, adding, resetting, hiding, draft persistence, and per-exercise logging behavior remains available.
