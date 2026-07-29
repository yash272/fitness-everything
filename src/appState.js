export function todayDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function previousDateKey(now = new Date()) {
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 1);
  return todayDateKey(previous);
}

export function createRootScreen(name) {
  return { name: name === "history" ? "history" : "today" };
}

export function createWorkoutScreen(date, returnTo = "today") {
  return {
    name: "workout",
    date,
    returnTo: returnTo === "history" ? "history" : "today"
  };
}

export function screenStorageValue(screen) {
  if (screen?.name === "workout") {
    return screen.returnTo === "history" ? "history" : "today";
  }
  return screen?.name === "history" ? "history" : "today";
}
