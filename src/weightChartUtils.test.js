import test from "node:test";
import assert from "node:assert/strict";
import { buildHorizontalHitRegions, buildWeightChartModel } from "./weightChartUtils.js";

const logs = [
  { id: "old", log_date: "2026-06-01", weight: 81.2 },
  { id: "b", log_date: "2026-07-26", weight: 78.6 },
  { id: "a", log_date: "2026-07-25", weight: 79.1 },
  { id: "c", log_date: "2026-07-27", weight: 78.4 }
];

test("filters to the requested range and sorts points chronologically", () => {
  const model = buildWeightChartModel(logs, 30, new Date("2026-07-27T12:00:00"));

  assert.deepEqual(model.points.map((point) => point.id), ["a", "b", "c"]);
  assert.equal(model.points[0].log_date, "2026-07-25");
  assert.equal(Number(model.points[0].weight).toFixed(1), "79.1");
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

test("partitions dense chart points into stable, non-overlapping hit regions", () => {
  [30, 60, 90].forEach((count) => {
    const points = Array.from({ length: count }, (_value, index) => ({
      id: `point-${index}`,
      x: (index / (count - 1)) * 100,
      y: 20 + (index % 5) * 10
    }));
    const regions = buildHorizontalHitRegions(points);

    assert.equal(regions.length, count);
    assert.deepEqual(regions.map((point) => point.id), points.map((point) => point.id));
    assert.equal(regions[0].hitLeft, 0);
    assert.equal(regions.at(-1).hitRight, 100);
    assert.equal(regions[0].dotX, 0);
    assert.equal(regions.at(-1).dotX, 100);

    regions.forEach((region, index) => {
      assert.equal(region.hitWidth > 0, true);
      assert.equal(region.dotX >= 0 && region.dotX <= 100, true);
      const reconstructedX = region.hitLeft + (region.hitWidth * region.dotX) / 100;
      assert.equal(Math.abs(reconstructedX - points[index].x) < 1e-9, true);
      if (index > 0) {
        assert.equal(Math.abs(regions[index - 1].hitRight - region.hitLeft) < 1e-9, true);
      }
    });
  });
});

test("assigns midpoint boundaries to edge and interior hit regions", () => {
  const regions = buildHorizontalHitRegions([
    { id: "first", x: 0, y: 40 },
    { id: "middle", x: 40, y: 50 },
    { id: "last", x: 100, y: 60 }
  ]);

  assert.deepEqual(
    regions.map(({ id, hitLeft, hitRight, dotX }) => ({ id, hitLeft, hitRight, dotX })),
    [
      { id: "first", hitLeft: 0, hitRight: 20, dotX: 0 },
      { id: "middle", hitLeft: 20, hitRight: 70, dotX: 40 },
      { id: "last", hitLeft: 70, hitRight: 100, dotX: 100 }
    ]
  );
});
