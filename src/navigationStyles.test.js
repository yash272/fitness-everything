import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("the app uses a focused shell without bottom navigation", () => {
  assert.equal(appSource.includes("<AppHeader"), true);
  assert.equal(appSource.includes("<TodayView"), true);
  assert.equal(appSource.includes('className="mobile-tabs"'), false);
  assert.equal(appSource.includes("<BodyView"), false);
  assert.equal(styles.includes("-webkit-tap-highlight-color: transparent"), true);
});
