import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const historySource = readFileSync(new URL("./HistoryView.jsx", import.meta.url), "utf8");

test("an opened History calendar appears before recent sessions with period progress", () => {
  const recentList = historySource.indexOf('className="history-list"');
  const calendarToggle = historySource.indexOf('aria-label="Toggle calendar"');
  const calendarPanel = historySource.indexOf('className="history-calendar"');
  const periodSummary = historySource.indexOf('className="history-period-summary"');
  const weekGrid = historySource.indexOf("<WeekCalendar");
  const monthGrid = historySource.indexOf("<MonthCalendar");

  assert.ok(recentList >= 0);
  assert.ok(calendarToggle >= 0);
  assert.ok(calendarPanel > calendarToggle);
  assert.ok(calendarPanel < recentList);
  assert.ok(periodSummary > calendarPanel);
  assert.ok(weekGrid > calendarPanel);
  assert.ok(monthGrid > calendarPanel);
  assert.equal(historySource.includes("Total steps"), false);
  assert.match(historySource, /formatDailySteps\(workout\?\.steps\)/);
  assert.equal(historySource.includes("Open {formatDate(selectedDate)}"), false);
  assert.match(historySource, /workoutStatusLabel\(selectedWorkout\)/);
});
