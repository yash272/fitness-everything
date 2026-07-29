import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const dailyViewStart = appSource.indexOf("function DailyView");
const dailyViewEnd = appSource.indexOf("function WeekGrid");
const dailyViewSource = appSource.slice(dailyViewStart, dailyViewEnd);

test("week and month calendars share the navigator position above day details", () => {
  const navigatorStart = dailyViewSource.indexOf('<section className="log-navigator">');
  const navigatorEnd = dailyViewSource.indexOf("</section>", navigatorStart);
  const focusStart = dailyViewSource.indexOf('<FocusStage className="log-focus">');
  const weekGrid = dailyViewSource.indexOf("<WeekGrid");
  const monthGrid = dailyViewSource.indexOf("<CalendarGrid");

  assert.ok(navigatorStart >= 0);
  assert.ok(weekGrid > navigatorStart && weekGrid < navigatorEnd);
  assert.ok(monthGrid > navigatorStart && monthGrid < navigatorEnd);
  assert.ok(navigatorEnd < focusStart);
});
