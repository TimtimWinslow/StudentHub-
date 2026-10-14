const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("application JavaScript files parse", () => {
  for (const file of ["app.js", "admin.js", "debug.js", "sw.js"]) {
    assert.doesNotThrow(() => new vm.Script(read(file), { filename: file }), file);
  }
});

test("inline scripts in index.html parse", () => {
  const html = read("index.html");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0, "expected at least one inline script");
  for (const [index, match] of scripts.entries()) {
    assert.doesNotThrow(
      () => new vm.Script(match[1], { filename: `index-inline-${index + 1}.js` }),
      `inline script ${index + 1}`
    );
  }
});

test("PWA manifest is valid and every declared icon exists", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.name, "StudentHub");
  assert.equal(manifest.display, "standalone");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, icon.src)), `missing manifest icon: ${icon.src}`);
  }
});

test("HTML local assets exist", () => {
  const html = read("index.html");
  const references = [
    ...html.matchAll(/(?:src|href)=["'](?!https?:|#|javascript:)([^"'?]+)["']/gi)
  ].map((match) => match[1]).filter((value) => !value.startsWith("data:"));
  for (const reference of references) {
    assert.ok(fs.existsSync(path.join(root, reference)), `missing local HTML asset: ${reference}`);
  }
});

test("service-worker app shell points to existing files", () => {
  const sw = read("sw.js");
  const match = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);
  assert.ok(match, "APP_SHELL array should exist");
  const entries = [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    const normalized = entry === "./" ? "index.html" : entry.replace(/^\.\//, "");
    assert.ok(fs.existsSync(path.join(root, normalized)), `missing service-worker asset: ${entry}`);
  }
});

test("core v1.0.0 features have entry points in the app", () => {
  const app = read("app.js");
  for (const [label, pattern] of [
    ["sign in", /function signIn\s*\(/],
    ["sign up", /function signUp\s*\(/],
    ["password reset", /function resetPassword\s*\(/],
    ["academic center", /function renderProgress\s*\(/],
    ["CSV academic export", /function exportAcademicReportCsv\s*\(/],
    ["print academic report", /function printAcademicReport\s*\(/],
    ["profile save", /function saveProfile\s*\(/],
    ["settings", /function loadSettings\s*\(/],
    ["notifications", /function loadNotifications\s*\(/],
    ["presence", /function updatePresence\s*\(/],
  ]) {
    assert.match(app, pattern, `missing ${label} entry point`);
  }
  assert.match(app, /addEventListener\(["']click["'],\s*printAcademicReport\)/);
  assert.match(app, /addEventListener\(["']click["'],\s*exportAcademicReportCsv\)/);
});

test("privacy and combined-chapter migrations are tracked", () => {
  assert.ok(fs.existsSync(path.join(root, "supabase", "privacy_controls_visibility.sql")));
  assert.ok(fs.existsSync(path.join(root, "supabase", "combined_chapter_numbers.sql")));
});

test("data export calls existing loaders and preserves Safari downloads", () => {
  const app = read("app.js");
  const exportStart = app.indexOf("async function exportMyData()");
  assert.ok(exportStart >= 0, "exportMyData should exist");
  const exportEnd = app.indexOf("async function handleAccountAction", exportStart);
  const exportFunction = app.slice(exportStart, exportEnd);
  assert.ok(exportFunction.includes("loadCareConversations()"));
  assert.ok(!exportFunction.includes("loadConversations()"));
  assert.ok(exportFunction.includes("setTimeout(() => URL.revokeObjectURL(url), 1000)"));
});

test("profile picture uploads validate file type and size", () => {
  const app = read("app.js");
  assert.ok(app.includes('allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"])'));
  assert.ok(app.includes("file.size > 5 * 1024 * 1024"));
});
