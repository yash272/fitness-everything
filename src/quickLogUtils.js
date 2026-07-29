export function normalizeWeightInput(value) {
  if (String(value).trim() === "") return null;
  const weight = Number(value);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

export function normalizeStepsInput(value) {
  if (String(value).trim() === "") return null;
  const steps = Number(value);
  return Number.isInteger(steps) && steps >= 0 ? steps : null;
}
