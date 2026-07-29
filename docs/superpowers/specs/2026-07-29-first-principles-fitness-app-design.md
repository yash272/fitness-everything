# First-Principles Fitness App Design

Date: 2026-07-29
Status: Draft for user review

## Product Thesis

This app is a daily training instrument, not a dashboard made from four equal
databases. Its interface should answer three questions in order:

1. What is changing?
2. What needs logging?
3. What am I doing today?

Weight and steps are retrospective measurements. Strength training is an active,
set-by-set task. History is a way to find and compare sessions. The information
architecture and interaction model should reflect those differences.

## Success Criteria

- Opening the app shows the weight trend first.
- Logging today's weight requires entering a value and confirming it.
- Logging yesterday's steps requires entering a value and confirming it.
- Both quick logs support older dates without navigating to a workout.
- Choosing Push, Pull, or Legs creates a five-exercise session draft immediately.
- Every current strength set can be compared against the corresponding set from
  the latest prior session.
- Each strength set is saved separately.
- The app automatically advances through the normal exercise order while still
  allowing exercises to be opened out of order.
- Cardio, Badminton, and other activities use a lightweight duration flow.
- History opens as a recent-session list; the month calendar is secondary.
- There is no Body tab, permanent Workout tab, or bottom navigation.
- Recent PR lists are removed. A set that exceeds the prior best receives only
  an inline `New best` marker.
- Existing Supabase tables and stored user data remain compatible.

## Information Architecture

The app has two root destinations and one focused task screen:

```text
Today <--------------------------> History
  |                                  |
  +---- open today's session         +---- open selected session
                     \               /
                      v             v
                         Workout
```

### Today

Today is the app's home screen. It contains the weight trend, quick measurement
entry, and today's session summary.

### History

History is a read-only browser. It defaults to a filterable recent-session list
and offers the calendar as a secondary mode. Opening a session leaves History
and enters the Workout screen for that date.

### Workout

Workout is not persistent navigation. It is a focused screen opened for a
specific date from Today or History. Current and previous dates are editable;
future dates remain blocked.

## Global App Shell

### Header

The default header contains:

- the `fitness` wordmark;
- a labeled `History` action;
- an overflow button containing Export and light/dark theme controls.

There is no bottom navigation.

The Workout screen replaces the wordmark area with a back button and the
selected date. The back button returns to the screen that opened the workout.

### Screen State

The app can continue using local React state without adding a routing library:

```js
{
  name: "today" | "history" | "workout",
  workoutDate: "YYYY-MM-DD" | null,
  returnTo: "today" | "history"
}
```

Refresh defaults to Today. The History display mode and filters persist locally.
An in-progress workout draft remains date/category scoped in local storage.

## Screen 1: Today

### Layout

```text
fitness                              History  [...]

TODAY · WED 29 JUL

67.2 kg
Weight trend                                    [30D 60D 90D]
┌─────────────────────────────────────────────────────────┐
│                      line chart                         │
└─────────────────────────────────────────────────────────┘

Weight       [29 Jul]       [ 67.2 kg ]              [check]
Steps        [28 Jul]       [ 15,240  ]              [check]

TODAY'S SESSION
Pull · 5 exercises · 0/15 sets                         [open]
```

### Weight Trend

- The latest weight and date lead the page.
- The graph remains the dominant first-screen visual.
- Range controls remain 30D, 60D, and 90D.
- Tapping a point shows that day's date and weight in a tinted tooltip.
- The chart uses the existing dark green-black treatment in both themes.
- Axis labels must not overlap the plotted line.

### Quick Weight Entry

- The row always includes an explicit date and value.
- The date defaults to today.
- The date may be changed to any current or previous day.
- A date with an existing body log loads its current value for editing.
- Enter, the check button, or a valid changed input losing focus saves the value.
- Invalid, empty, or unchanged values do not save on blur.
- Save success replaces the check with a quiet `Saved` state, then returns to the
  check icon when the value changes.
- The Body screen and Body navigation item are removed.

### Quick Steps Entry

- The row is independent from the selected workout date.
- The date defaults to yesterday.
- The date may be changed to an older current/past date.
- A date with existing steps loads its value for editing.
- Save behavior matches weight entry.
- Steps controls are removed from the Workout screen.

### Today's Session Summary

When a session exists:

```text
Pull
5 exercises · 7/15 sets
Last set: Lat Pulldown 120 x 10
```

The full summary row is one large target that opens Workout for today.

When no type or local session draft exists:

```text
Rest day
Choose a session when you are ready
```

Opening it enters Workout, where the user can choose a session type.

When a Push/Pull/Legs draft exists but no set is confirmed:

```text
Pull draft
5 exercises · 0/15 sets
```

Today preserves the draft, while History continues to classify the day as Rest
until a set is logged.

## Screen 2: Workout

### Header And Date

```text
[back]  Wed 29 Jul                                      [...]
```

- Tapping the date opens a date picker.
- Future dates are disabled.
- Opening from History preserves that historical date.
- Clearing a session type on a no-set day returns it to Rest.

### Session Type Selection

If the day has no type, show compact choices:

```text
Strength                            Activity
[Push] [Pull] [Legs]                [Cardio] [Badminton] [Other]
```

Choosing Push, Pull, or Legs immediately creates a five-exercise local draft.
There is no separate Suggestions section, Show/Hide plan state, or step that
copies suggestions into the workout.

Changing or clearing a type remains possible for today and previous dates.
Changing a type with confirmed sets requires a confirmation because the existing
sets remain attached to the day.

### Strength Session

The selected day's session dominates the screen:

```text
PULL
7 of 15 sets complete

01  Lat Pulldown                       2/3
    Previous · 21 Jul              Today
    120 x 10                       120 x 12  [check]
    120 x 10                       120 x 12
    120 x  8                       120 x 12

02  Low Row                             0/3
03  Machine Rear Delt                   0/3
04  Bicep Curl                          0/3
05  Hammer Curl                         0/3
```

#### Draft Creation

- Use the existing five exercise templates for Push, Pull, and Legs.
- For each exercise, find its latest prior appearance in the same canonical
  session category.
- Display every set from that previous exercise in original order.
- Render the larger of the previous and current set counts. A missing previous
  set shows `--`; an extra historical set remains visible even when there is no
  matching current target.
- Calculate today's target from the strongest valid prior set using the approved
  Epley progression logic.
- Generate three identical target sets.
- Fall back to the current template when no matching history exists.
- Keep the draft in local storage until its sets are confirmed or edited.

#### Exercise Disclosure

- One exercise is expanded at a time.
- The first incomplete exercise opens by default.
- Confirming the final planned set collapses that exercise and opens the next
  incomplete exercise.
- Any exercise can be opened manually at any time, allowing occasional order
  changes without a reorder mode.
- Completed exercises remain compact and visually quiet.

#### Set Confirmation

- Each target set is editable before confirmation.
- If the target was achieved, one check tap confirms it unchanged.
- If the result differs, weight/reps are edited and then confirmed.
- Confirming the first set lazily creates the workout/exercise rows if needed,
  then inserts only that set into `exercise_sets`.
- Confirmed sets are immediately visible and can be edited or deleted.
- Retrospective set edits update the existing `exercise_sets` row.
- A failed save leaves the row editable and shows an inline retry message.
- No rest timer, modal, confetti, or blocking success message is added.

#### New Best

- Compare a confirmed weighted set with valid earlier sets for that exercise.
- A better set receives a small lime `New best` marker.
- The marker remains on the exercise for the selected day.
- There is no Recent PR section on Today or History.

#### Exercise Management

- Add Exercise lives at the end of the exercise ledger.
- Removing an unconfirmed draft exercise is immediate.
- Deleting a persisted exercise or set uses the existing destructive action
  confirmation.
- Exercise names and tracking modes remain editable for today and prior dates.

### Activity Session

Cardio, Badminton, and custom activities avoid the strength interface:

```text
BADMINTON

Duration
[ 75 ] minutes                                      [check]
```

- Activity name and duration are the only required fields.
- The date remains editable.
- Duration is stored using the existing `exercises.tracking_type = "time"` and
  `exercise_sets.duration_minutes` fields.
- The activity is considered complete after a valid duration set is saved.
- One primary session per day remains the product model.

## Screen 3: History

### Default Recent View

```text
History                                      [calendar]

12 sessions this month · 3 this week

[All] [Push] [Pull] [Legs] [Activity]

Mon 27 Jul   Pull       5 exercises · 15 sets
Sat 25 Jul   Push       5 exercises · 14 sets
Fri 24 Jul   Cardio     42 min
```

- Sessions are sorted newest first.
- Filters are horizontally scrollable on narrow screens.
- `Activity` includes non-Push/Pull/Legs session types.
- Rest-only records are omitted from the recent session list.
- Selecting a row opens Workout for that date with `returnTo: "history"`.
- Consistency summary replaces the removed Recent PR section.

### Calendar View

- A calendar icon switches the History content region from Recent to Month.
- Month and Recent occupy the same position below the History header.
- The month grid is used to locate dates and inspect consistency, not as the
  default browsing interface.
- Workout days use a restrained category indicator rather than full tinted
  tiles on every cell.
- Rest days remain visually quiet.
- Selecting a date with a session opens Workout for that date.
- Selecting a date without a session shows a compact read-only Rest summary,
  with an explicit Edit action that opens Workout if needed.
- Returning from Workout restores the previous History mode, month, and filter.

## Visual System

### Direction

The visual language is calm, athletic, and instrument-like. It should avoid the
old admin-dashboard feel created by dense bordered cards and equally weighted
metrics.

### Palette

- `Canvas Light`: `#EEF2ED`
- `Surface Light`: `#FBFCFA`
- `Ink`: `#172019`
- `Canvas Dark`: `#111812`
- `Training Surface`: `#0C120D`
- `Progress Lime`: `#D7FF4F`
- `Muted Data`: `#89958C`
- `Danger`: `#D9564A`

Lime is reserved for the next action, active selection, progress, and `New best`.
It is not used to tint every workout cell.

### Typography

- Spline Sans remains the interface and display family.
- IBM Plex Mono remains the data family for weight, reps, dates, duration, and
  chart values.
- Today weight: 44-64 px depending on breakpoint.
- Screen title: 22-26 px.
- Exercise title: 15-17 px.
- Set data: 13-15 px.
- Metadata: no smaller than 11 px on mobile.
- Letter spacing remains `0`.

### Layout

- Mobile content uses 16 px side padding.
- Desktop content is constrained to 920 px for Today, Workout, and History.
- Sections are separated by spacing and dividers, not floating cards.
- Cards are limited to the weight chart, session summary, and repeated history
  rows where framing improves scanning.
- Border radius remains 6-8 px.
- Touch targets are at least 40 px.
- No card is nested inside another card.

### Signature Element

The strength screen's paired `Previous | Today` set rail is the visual signature.
It makes progression visible without a separate analytics screen and directly
supports the user's behavior during training.

### Motion

- Screen transitions: 170 ms opacity and 4 px vertical movement.
- Exercise disclosure: 170 ms opacity/vertical movement.
- Confirmed set: 140 ms color transition.
- No looping animation or page-height animation.
- Reduced-motion preferences reduce all transitions to effectively immediate.

## Data Compatibility

No database migration is required.

| Product data | Existing storage |
| --- | --- |
| Dated weight | `body_logs.log_date`, `body_logs.weight` |
| Dated steps | `workouts.workout_date`, `workouts.steps` |
| Session type | `workouts.split` |
| Strength exercise | `exercises` with `tracking_type = "weighted"` |
| Strength set | `exercise_sets.reps`, `exercise_sets.weight` |
| Activity duration | timed `exercises` + `exercise_sets.duration_minutes` |
| New best marker | `exercise_sets.is_pr` |

The unique workout-per-user-per-date constraint matches the approved one-primary-
session-per-day product model.

## Error And Edge Behavior

- Future measurement and workout dates are rejected before a Supabase call.
- Quick-log blur does not save empty, invalid, or unchanged values.
- Local draft persistence remains best-effort when storage is unavailable.
- A confirmed set is removed from the draft only after Supabase returns success.
- If an exercise exists but its target set has not been confirmed, refreshing
  restores the remaining draft from local storage.
- Missing prior exercise history uses template targets and labels the comparison
  `No previous session`.
- Historical workout edits do not change the currently selected History filters.
- Unknown activity types use the duration editor.
- Empty or no-set days continue to display as Rest in History.

## Accessibility

- Header, overflow, date, filters, exercises, and set controls have accessible
  names.
- Exercise summaries expose `aria-expanded`.
- Confirmed sets expose their saved status without relying on lime alone.
- Keyboard Enter confirms quick logs and set edits.
- Visible focus remains in both themes.
- Chart points remain keyboard reachable and expose date/weight values.
- Status announcements use a polite live region.

## Responsive Behavior

### Mobile: 360-620 px

- Today uses one column.
- Quick-log rows keep date, input, and check on one line when width permits;
  below 380 px the date moves above the value without shrinking text.
- Previous and Today set columns remain side by side.
- History filters scroll horizontally.
- The header keeps History labeled; Export and Theme stay in overflow.

### Tablet: 621-899 px

- Today remains one column for calm scanning.
- Workout comparison columns receive more horizontal space.
- History rows expose exercise/set counts without truncation.

### Desktop: 900 px and above

- Content remains centered at a 920 px maximum.
- Today may place the two quick-log rows side by side below the graph.
- Workout keeps a single dominant column; it does not become a split dashboard.
- Header actions remain aligned with the content container.

## Testing Strategy

### Pure Unit Coverage

- dated quick-log default and validation behavior;
- session and activity classification;
- latest same-category previous-session lookup;
- full previous-set ordering;
- progression target generation;
- draft completion and next-exercise selection;
- History filtering and consistency counts;
- future-date guards.

### Mutation Coverage

- dated body-log upsert;
- dated steps upsert without changing workout type;
- lazy exercise creation on first confirmed set;
- one-set insert and local state update;
- retrospective set update and delete;
- timed activity insert/update.

### Browser Verification

- Today at 390 x 844 in light and dark themes;
- weight and steps keyboard, check, and valid-blur saves;
- workout entry from Today and return behavior;
- one-open-at-a-time exercise flow;
- every prior set aligned with current targets;
- out-of-order exercise selection;
- Cardio/Badminton duration flow;
- History Recent/Calendar mode persistence;
- workout entry from History and return behavior;
- no horizontal overflow, overlap, console warnings, or accidental blue touch
  outlines.

## Implementation Decomposition

This redesign spans three independently testable subsystems and should not be
implemented as one large patch.

### Phase 1: App Shell And Today

- replace four-tab navigation with Today, History header action, and focused
  Workout navigation state;
- move dated weight and steps entry to Today;
- remove Body and steps-from-Workout interfaces;
- remove Recent PRs;
- add today's compact session summary;
- move Export and Theme into overflow.

### Phase 2: Focused Workout

- merge dynamic suggestions into the strength session draft;
- expose every prior set beside each target;
- add individual set confirmation and retrospective set editing;
- add automatic next-exercise disclosure;
- add the lightweight timed activity screen;
- retain current/past date editing and Rest behavior.

### Phase 3: History

- replace calendar-first Logs with recent sessions and filters;
- add consistency summary;
- retain month calendar as a secondary mode;
- open sessions in the focused Workout screen and restore History state on back.

Each phase must pass the complete existing test suite and deliver a usable app
before the next phase begins.
