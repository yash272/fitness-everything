import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("all navigation tabs use the same selected-state styling", () => {
  assert.equal(appSource.includes("workout-tab"), false);
  assert.equal(styles.includes(".workout-tab"), false);
});
