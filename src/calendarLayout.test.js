import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const historySource = readFileSync(new URL("./HistoryView.jsx", import.meta.url), "utf8");

test("History keeps recent sessions primary and the calendar secondary", () => {
  const recentList = historySource.indexOf('className="history-list"');
  const calendarToggle = historySource.indexOf('aria-label="Toggle calendar"');
  const calendarPanel = historySource.indexOf('className="history-calendar"');
  const weekGrid = historySource.indexOf("<WeekCalendar");
  const monthGrid = historySource.indexOf("<MonthCalendar");

  assert.ok(recentList >= 0);
  assert.ok(calendarToggle >= 0);
  assert.ok(calendarPanel > recentList);
  assert.ok(weekGrid > calendarPanel);
  assert.ok(monthGrid > calendarPanel);
});
