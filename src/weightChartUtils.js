function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildHorizontalHitRegions(points) {
  if (!points.length) return [];

  return points.map((point, index) => {
    const hitLeft = index === 0 ? 0 : (points[index - 1].x + point.x) / 2;
    const hitRight = index === points.length - 1 ? 100 : (point.x + points[index + 1].x) / 2;
    const hitWidth = hitRight - hitLeft;
    const dotX = hitWidth ? ((point.x - hitLeft) / hitWidth) * 100 : 50;

    return {
      ...point,
      hitLeft,
      hitRight,
      hitWidth,
      dotX
    };
  });
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
  const plottedPoints = buildHorizontalHitRegions(
    points.map((point, index) => ({
      ...point,
      x: xFor(index),
      y: yFor(Number(point.weight))
    }))
  );
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
