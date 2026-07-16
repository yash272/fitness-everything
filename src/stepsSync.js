const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeAllowedOrigin(origin = "*") {
  if (!origin || origin === "*") return "*";
  return origin.startsWith("http") ? origin : `https://${origin}`;
}

export function resolveCorsOrigin(requestOrigin, allowedOrigin = "*") {
  const normalizedAllowedOrigin = normalizeAllowedOrigin(allowedOrigin);
  if (normalizedAllowedOrigin === "*") return "*";
  return requestOrigin === normalizedAllowedOrigin ? requestOrigin : normalizedAllowedOrigin;
}

export function buildWorkoutUpdate({ steps }) {
  return { steps };
}

export function buildWorkoutInsert({ date, steps, userId }) {
  return {
    user_id: userId,
    workout_date: date,
    split: "",
    did_workout: false,
    steps
  };
}

function getHeader(headers, name) {
  if (!headers) return undefined;
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body;
}

function isValidIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseStepRequest(req, { syncToken }) {
  if (!syncToken) {
    return { ok: false, status: 500, message: "Step sync token is not configured" };
  }

  const authorization = getHeader(req.headers, "authorization") || "";
  const providedToken = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  if (providedToken !== syncToken) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const body = parseBody(req.body);
  if (!body) {
    return { ok: false, status: 400, message: "Request body must be valid JSON" };
  }

  const date = body.date;
  if (!isValidIsoDate(date)) {
    return { ok: false, status: 400, message: "date must be YYYY-MM-DD" };
  }

  const steps = Number(body.steps);
  if (!Number.isInteger(steps) || steps < 0) {
    return { ok: false, status: 400, message: "steps must be a non-negative integer" };
  }

  return { ok: true, date, steps };
}
