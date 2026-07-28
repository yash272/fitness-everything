# Fitness UI/UX Redesign

Date: 2026-07-27
Status: Approved design direction, pending written-spec review

## Objective

Redesign the existing personal fitness tracker into a modern, minimal, fitness-oriented experience that feels calm and immersive on mobile while using desktop space efficiently. Preserve the current data model, Supabase operations, calculations, and established behavior. The only new interaction is a tooltip that reveals the date and weight when a user taps, clicks, or focuses a point on the weight graph.

The product is a daily personal training instrument for one user who logs weight, records workouts, and reviews training history every day. Its primary screen should surface weight progress first while keeping workout logging and historical review immediately accessible.

## Design Direction

The selected direction is **Quiet Performance** with **Human Performance** typography.

The interface uses a softly tinted green-grey canvas in light mode and a green-black canvas in dark mode. Each screen contains one dominant green-black focus stage for its primary task. Supporting content remains quiet, compact, and lightly structured. Performance lime marks active controls, graph data, and the Workout navigation item.

The focus stage is the design signature:

- Dashboard: latest weight and trend
- Workout: active workout summary and controls
- Logs: selected day's workout
- Body: daily weight entry

This creates immersion through hierarchy rather than decorative imagery, gradients, or excessive animation.

## Visual Tokens

### Core palette

- Mineral mist: `#EEF2ED` for the light canvas
- Paper: `#FBFCFA` for light working surfaces
- Green-black: `#172019` for focus stages and the dark canvas
- Performance lime: `#D7FF4F` for active states and graph marks
- Muted sage: `#6C786E` for secondary text
- Signal red: `#D9564A` for destructive actions and exceptional warning states

Borders should derive from green-black at low opacity rather than introducing another dominant hue. Dark-mode elevated surfaces should be a modestly lighter green-black, and primary text should be a cool off-white. Performance lime must remain an accent rather than a large-area background outside small active controls.

### Typography

- Interface, headings, and body: Spline Sans
- Numeric training data, dates, weights, sets, and compact utility labels: IBM Plex Mono

Typography should remain human and readable, with the mono face used only where aligned numeric comparison helps. Letter spacing stays at `0`. Heading sizes should match their container and never become oversized inside compact panels.

### Geometry and depth

- Cards and focus panels use a maximum `8px` corner radius.
- Shadows remain minimal and are reserved for overlays such as the date picker or graph tooltip.
- Sections are unframed unless they are repeated records, a bounded input tool, or the single focus stage.
- Cards are never nested inside cards.
- Dividers, spacing, and alignment carry most of the structure.

## Navigation and Responsive Layout

The existing four destinations and their behavior remain:

1. Dashboard
2. Logs
3. Workout
4. Body

Dashboard keeps its current name. Workout receives a restrained lime emphasis in the navigation because it is the primary operational tab during training. It must not become an oversized floating action.

On mobile, navigation remains fixed near the bottom safe area and every screen follows a single-column reading order. Controls used during training should remain compact because the user prefers density and fewer taps. On desktop, Dashboard and other suitable screens may use two columns, but their source order must match the mobile flow.

The active tab and the Logs week/month mode continue to persist exactly as they do now.

## Screen Design

### Dashboard

The Dashboard opens with the latest recorded weight and the selected 30, 60, or 90-day trend inside the dark focus stage. The weight value is the strongest element, followed by the graph. Axis units and labels must reserve their own space and never overlap the line.

Tapping or clicking a graph point shows a compact tooltip containing the date and recorded weight, for example `Jul 24 · 78.6 kg`. The tooltip does not navigate, select dates elsewhere, or mutate data. Keyboard focus on a point must expose the same information.

After the focus stage, the Dashboard presents:

- Today's workout or Rest
- Today's steps
- Workout days this week
- Workout days this month
- Recent personal records

On desktop, the focus stage may span the larger column while daily and period summaries occupy the secondary column. On mobile, all content follows the order above.

### Workout

The Workout screen begins with the selected workout date and active workout focus stage. The existing date restriction remains: today and previous dates can be selected, while future dates cannot be edited.

The focus stage contains the workout type and steps controls. An unset workout type remains visually empty and must never default to Push. A day counts as a workout only when exercise sets exist; days without sets remain Rest days.

Logged exercises display all sets immediately in compact, aligned rows. Exercises do not collapse because the user prioritizes fewer taps. Repeat-set and delete actions remain available through familiar icons with accessible labels.

Add Exercise remains collapsed until the user activates the plus action. Once opened, its current draft and expanded state must survive navigation to another tab and back. Inputs should be dense enough to show multiple sets without excessive scrolling while still meeting usable touch sizing.

### Logs

Logs remains read-only. The selected day's workout is the dominant content and appears in the focus stage before broader history. A compact date navigator and the existing week/month segmented control sit above it.

The selected Logs date remains independent from the Workout date. Changing one must not affect the other. Week/month mode continues to persist when leaving and returning to the tab.

Days with no exercise sets display `Rest` or `Rest day`. The interface must not show Gym/No Gym controls, and it must not infer a workout from a saved workout type alone.

### Body

The Body screen opens with the daily weight-entry tool inside its focus stage because weight entry is the user's first task on this tab. Existing weight and body-fat inputs and save behavior remain unchanged.

Weight history follows the entry area in a compact chronological view. Empty history should direct the user to log a weight without adding decorative or promotional copy.

## Theme Behavior

Both light and dark theme options remain.

Light mode uses mineral mist around green-black focus stages. Dark mode uses green-black as the canvas with slightly elevated green-toned surfaces. The themes share the same hierarchy and performance-lime accent; dark mode must be designed directly rather than produced through simple color inversion.

Theme switching keeps its current persistence behavior. Every state must retain readable contrast, including muted labels, disabled controls, error notices, chart axes, and tooltip text.

## Motion and Interaction

Motion is restrained and functional:

- Tab content transitions: approximately `150–180ms`
- Add Exercise expansion: approximately `150–180ms`
- Button press feedback: brief scale or surface response without layout movement
- Graph range changes: line and point transitions rather than a fade-only effect
- Tooltip appearance: immediate or near-immediate, with no decorative bounce

Motion must respect `prefers-reduced-motion`. There are no looping animations, ambient effects, gradients, decorative blobs, or page-load spectacle.

## Preserved Behavior

The redesign must preserve:

- Existing Supabase schema, reads, writes, and calculations
- Independent Workout and Logs dates
- Editing current and previous workouts
- Blocking future workout dates
- Retrospective workout type and exercise editing
- Rest-day classification based on the absence of exercise sets
- Blank default workout type
- Read-only Logs
- Steps editing in Workout
- Active tab persistence
- Logs week/month persistence
- Add Exercise expansion and draft persistence across tab changes
- Existing 30, 60, and 90-day weight ranges
- Light/dark theme persistence
- Export behavior
- Personal-record calculations

No backend migrations, API changes, or data rewrites are in scope.

## Component Boundaries

The existing React state and handlers remain authoritative. The redesign should separate presentation where it reduces risk:

- `AppShell`: top bar, desktop navigation, bottom navigation, notices
- `FocusStage`: shared visual container with screen-specific content
- `Dashboard`: weight summary, interactive `WeightChart`, period summaries, PRs
- `WorkoutView`: date, workout controls, exercise list, Add Exercise form
- `DailyView`: compact date navigation and selected-day details
- `BodyView`: entry form and history
- Small reusable controls for icon buttons, segmented controls, numeric rows, and empty states

Refactoring is allowed only where it makes the visual implementation clearer or prevents duplicated interaction logic. Data-fetching and mutation behavior should not move unless necessary to preserve existing contracts.

## Feedback and Error States

Existing notices remain visible near the relevant screen content. Errors use signal red sparingly and explain the action that failed. Saving and disabled states must not shift layout.

The weight graph tooltip must clamp within its plot area so it cannot cover axis labels or overflow the viewport. If there is no weight data in the selected range, the chart area should present a direct empty state and retain the range controls.

## Verification

The implementation must be checked at minimum at:

- Mobile: `390 × 844`
- Tablet: `768 × 1024`
- Desktop: `1440 × 900`

Verification must cover both themes and all four tabs. It must confirm:

- No clipped or overlapping text, graph labels, inputs, or navigation
- Graph tooltips work with touch, mouse, and keyboard
- Tooltip values match the underlying body logs
- Workout and Logs dates remain independent
- Future workout dates remain blocked
- Add Exercise drafts survive tab changes
- Week/month and active-tab persistence still work
- No-set days display as Rest
- Dense set rows remain usable on mobile
- Focus states remain visible for keyboard users while mobile taps do not show the unwanted blue outline
- Reduced-motion mode removes nonessential transitions
- Build and lint complete successfully

