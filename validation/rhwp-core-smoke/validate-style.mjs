import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

globalThis.measureTextWidth = (_font, text) => Array.from(String(text)).length * 8;

const moduleUrl = import.meta.resolve("@rhwp/core");
const modulePath = fileURLToPath(moduleUrl);
const wasmPath = join(dirname(modulePath), "rhwp_bg.wasm");
const core = await import("@rhwp/core");
const wasm = new Uint8Array(await readFile(wasmPath));
await core.default({ module_or_path: wasm });
assert.equal(core.version(), "0.8.2");

const samplePath = process.argv[2];
assert.ok(samplePath, "sample HWP path is required");
const sampleBytes = new Uint8Array(await readFile(resolve(samplePath)));
const document = new core.HwpDocument(sampleBytes);
let reopened;

function parseObject(raw, context, requireOk = true) {
  const value = JSON.parse(raw);
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${context}: object required`);
  if (requireOk) assert.equal(value.ok, true, `${context}: ok=true required`);
  return value;
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

try {
  const style = parseObject(document.getStyleAt(0, 0), "getStyleAt", false);
  assert.ok(Number.isInteger(style.id) && style.id >= 0, "existing paragraph style id required");
  const applied = parseObject(document.applyStyle(0, 0, style.id), "applyStyle");
  const verify = parseObject(document.exportHwpVerify(), "exportHwpVerify", false);
  const hwp = document.exportHwp();
  assert.equal(hwp.byteLength, verify.bytesLen);
  assert.equal(verify.pageCountBefore, verify.pageCountAfter);
  reopened = new core.HwpDocument(hwp);
  const reopenedStyle = parseObject(reopened.getStyleAt(0, 0), "reopened getStyleAt", false);
  assert.equal(reopenedStyle.id, style.id);
  for (let page = 0; page < reopened.pageCount(); page += 1) {
    assert.match(reopened.renderPageSvg(page), /<svg(?:\s|>)/);
  }

  const empty = core.HwpDocument.createEmpty();
  let invalidStyleRejected = false;
  try {
    empty.applyStyle(0, 0, 0);
  } catch {
    invalidStyleRejected = true;
  } finally {
    empty.free?.();
  }
  assert.equal(invalidStyleRejected, true, "empty document must reject unavailable style id");

  const report = {
    schemaVersion: "1.0",
    passed: true,
    package: "@rhwp/core@0.8.2",
    sample: samplePath,
    sampleBytes: sampleBytes.byteLength,
    style,
    applied,
    reopenedStyle,
    pageCount: reopened.pageCount(),
    hwpBytes: hwp.byteLength,
    hwpRevision: sha256(hwp),
    invalidStyleRejected,
  };
  await writeFile(new URL("./style-report.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log("PASS existing-document style application and empty-document rejection");
  console.log(JSON.stringify(report, null, 2));
} finally {
  reopened?.free?.();
  document.free?.();
}
