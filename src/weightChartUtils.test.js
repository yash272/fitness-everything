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
