import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const entry = readFileSync(new URL("./main.jsx", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));

test("the production build is installable as a standalone Android app", () => {
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#0b160e");
  assert.equal(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"), true);
  assert.match(html, /name="theme-color"/);
  assert.match(html, /rel="manifest"/);
  assert.match(entry, /serviceWorker\.register\("\/sw\.js"\)/);
  assert.equal(existsSync(new URL("../public/icon-192.png", import.meta.url)), true);
  assert.equal(existsSync(new URL("../public/icon-512.png", import.meta.url)), true);
});
