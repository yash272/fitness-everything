import assert from "node:assert/strict";
import { buildFitnessExport, exportFilename } from "./exportData.js";

const workouts = [
  {
    workout_date: "2026-06-30",
    split: "Pull",
    did_workout: true,
    steps: 7026,
    exercises: [
      {
        name: "Lat Pulldown",
        tracking_type: "weighted",
        exercise_sets: [
          { reps: 10, weight: 100, duration_minutes: null, is_pr: true, logged_at: "2026-06-30T12:00:00Z" }
        ]
      }
    ]
  },
  { workout_date: "2026-07-14", split: "Legs", did_workout: true, steps: 12000, exercises: [] }
];
const bodyLogs = [
  { log_date: "2026-06-30", weight: 67.8, body_fat: null },
  { log_date: "2026-07-14", weight: 67.4, body_fat: 18.2 }
];

const monthExport = buildFitnessExport({ mode: "month", month: new Date(2026, 6, 1), workouts, bodyLogs, userId: "user-1" });
assert.equal(monthExport.period.type, "month");
assert.equal(monthExport.period.month, "2026-07");
assert.equal(monthExport.period.start_date, "2026-07-01");
assert.equal(monthExport.period.end_date, "2026-07-31");
assert.equal(monthExport.days.length, 31);
const july14 = monthExport.days.find((day) => day.date === "2026-07-14");
assert.equal(july14.weight_kg, 67.4);
assert.equal(Object.hasOwn(july14, "body_fat_percent"), false);
assert.equal(monthExport.days.find((day) => day.date === "2026-06-30"), undefined);
assert.equal(exportFilename(monthExport), "fitness-everything-2026-07.json");

const allTimeExport = buildFitnessExport({ mode: "all-time", workouts, bodyLogs, userId: "user-1" });
assert.equal(allTimeExport.period.type, "all_time");
assert.equal(allTimeExport.period.start_date, "2026-06-30");
assert.equal(allTimeExport.period.end_date, "2026-07-14");
assert.equal(allTimeExport.period.label, "All time");
assert.equal(allTimeExport.days.length, 15);
assert.equal(allTimeExport.days[0].date, "2026-06-30");
assert.equal(allTimeExport.days.at(-1).date, "2026-07-14");
assert.equal(allTimeExport.days[0].workouts[0].sets[0].weight_lbs, 100);
assert.equal(exportFilename(allTimeExport), "fitness-everything-all-time.json");

const emptyAllTime = buildFitnessExport({ mode: "all-time", workouts: [], bodyLogs: [], userId: "user-1" });
assert.equal(emptyAllTime.period.type, "all_time");
assert.equal(emptyAllTime.days.length, 0);
assert.equal(emptyAllTime.period.start_date, null);
assert.equal(emptyAllTime.period.end_date, null);
