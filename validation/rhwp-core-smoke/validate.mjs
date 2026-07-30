import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// rhwp's WASM renderer delegates font measurement to the host. This deterministic
// approximation verifies structural/render integrity, not exact font metrics.
globalThis.measureTextWidth = (_font, text) => Array.from(String(text)).length * 8;

const report = {
  schemaVersion: "1.0",
  package: "@rhwp/core@0.8.2",
  node: process.version,
  startedAt: new Date().toISOString(),
  checks: [],
};

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function parseObject(raw, context, { requireOk = true } = {}) {
  const value = JSON.parse(raw);
  assert.equal(typeof value, "object", `${context}: JSON object required`);
  assert.ok(value !== null && !Array.isArray(value), `${context}: JSON object required`);
  if (requireOk) assert.equal(value.ok, true, `${context}: ok=true required`);
  return value;
}

function parseArray(raw, context) {
  const value = JSON.parse(raw);
  assert.ok(Array.isArray(value), `${context}: JSON array required`);
  return value;
}

async function check(name, task) {
  const started = performance.now();
  try {
    const detail = await task();
    report.checks.push({ name, passed: true, durationMs: +(performance.now() - started).toFixed(2), detail });
    console.log(`PASS ${name}`);
    return detail;
  } catch (error) {
    report.checks.push({
      name,
      passed: false,
      durationMs: +(performance.now() - started).toFixed(2),
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error(`FAIL ${name}`, error);
    throw error;
  }
}

async function renderAll(document, label) {
  const pageCount = document.pageCount();
  assert.ok(Number.isInteger(pageCount) && pageCount > 0, `${label}: pageCount > 0`);
  const sizes = [];
  for (let page = 0; page < pageCount; page += 1) {
    const svg = document.renderPageSvg(page);
    assert.equal(typeof svg, "string", `${label}: SVG string`);
    assert.match(svg, /<svg(?:\s|>)/, `${label}: page ${page} must contain svg root`);
    sizes.push(svg.length);
  }
  return { pageCount, svgBytes: sizes };
}

function verifyHwp(document, label) {
  const metadata = parseObject(document.exportHwpVerify(), `${label}.exportHwpVerify`, { requireOk: false });
  assert.ok(Number.isInteger(metadata.bytesLen) && metadata.bytesLen > 1024, `${label}: bytesLen`);
  assert.equal(metadata.pageCountBefore, metadata.pageCountAfter, `${label}: page count preserved`);
  const bytes = document.exportHwp();
  assert.equal(bytes.byteLength, metadata.bytesLen, `${label}: verify bytesLen equals exportHwp`);
  return { metadata, bytes };
}

function free(document) {
  try { document?.free?.(); } catch { /* best effort */ }
}

const moduleUrl = import.meta.resolve("@rhwp/core");
const modulePath = fileURLToPath(moduleUrl);
const wasmPath = join(dirname(modulePath), "rhwp_bg.wasm");
const core = await import("@rhwp/core");
const wasm = new Uint8Array(await readFile(wasmPath));
await core.default({ module_or_path: wasm });
assert.equal(core.version(), "0.8.2");

await check("published package and WASM initialize", async () => ({
  modulePath,
  wasmPath,
  wasmBytes: wasm.byteLength,
  version: core.version(),
}));

await check("canonical HWP is byte-stable after reopen", async () => {
  const source = core.HwpDocument.createEmpty();
  let reopened;
  try {
    parseObject(source.insertText(0, 0, 0, "byte stable"), "insertText");
    const first = source.exportHwp();
    reopened = new core.HwpDocument(first);
    const second = reopened.exportHwp();
    assert.deepEqual(second, first, "reopened canonical HWP must re-export identical bytes");
    return { bytes: first.byteLength, revision: sha256(first), pages: reopened.pageCount() };
  } finally {
    free(reopened);
    free(source);
  }
});

await check("snapshot restore recovers exact canonical bytes", async () => {
  const document = core.HwpDocument.createEmpty();
  try {
    parseObject(document.insertText(0, 0, 0, "rollback baseline"), "baseline insert");
    const before = document.exportHwp();
    const beforeHash = sha256(before);
    const snapshot = document.saveSnapshot();
    parseObject(document.beginBatch(), "beginBatch");
    parseObject(document.insertText(0, 0, 17, " changed"), "mutating insert");
    parseObject(document.endBatch(), "endBatch");
    const flush = parseObject(document.flushDeferredPagination(), "flushDeferredPagination");
    assert.ok(["none", "complete", "fallback"].includes(flush.status));
    parseObject(document.restoreSnapshot(snapshot), "restoreSnapshot");
    document.discardSnapshot(snapshot);
    const restored = document.exportHwp();
    assert.equal(sha256(restored), beforeHash, "snapshot restore must recover identical bytes");
    return { beforeBytes: before.byteLength, beforeHash, flushStatus: flush.status };
  } finally {
    free(document);
  }
});

await check("manual transaction rollback survives a mid-batch core error", async () => {
  const document = core.HwpDocument.createEmpty();
  try {
    parseObject(document.insertText(0, 0, 0, "transaction baseline"), "baseline insert");
    const beforeHash = sha256(document.exportHwp());
    const snapshot = document.saveSnapshot();
    let caught = false;
    parseObject(document.beginBatch(), "beginBatch");
    try {
      parseObject(document.insertText(0, 0, 20, " valid"), "valid operation");
      document.deleteParagraph(0, 9999);
    } catch {
      caught = true;
    }
    assert.equal(caught, true, "invalid operation must fail");
    try { document.endBatch(); } catch { /* restore is authoritative */ }
    parseObject(document.restoreSnapshot(snapshot), "restoreSnapshot");
    document.discardSnapshot(snapshot);
    assert.equal(sha256(document.exportHwp()), beforeHash);
    return { rollbackRevision: beforeHash };
  } finally {
    free(document);
  }
});

const statefulResult = await check("stateful body patch, exact duplicate range edit, export, reload and render", async () => {
  const document = core.HwpDocument.createEmpty();
  let hwpReload;
  let hwpxReload;
  try {
    parseObject(document.beginBatch(), "beginBatch");
    parseObject(document.insertText(0, 0, 0, "Stateful runtime target and target"), "insertText");
    parseObject(document.applyCharFormat(0, 0, 0, 8, JSON.stringify({ bold: true })), "applyCharFormat");
    parseObject(document.applyParaFormat(0, 0, JSON.stringify({})), "applyParaFormat");
    parseObject(document.applyStyle(0, 0, 0), "applyStyle");
    parseObject(document.insertParagraph(0, 1), "insertParagraph");
    parseObject(document.insertText(0, 1, 0, "Atomic Patch 2.0"), "second paragraph insert");
    parseObject(document.endBatch(), "endBatch");
    parseObject(document.flushDeferredPagination(), "flushDeferredPagination");

    assert.equal(document.getSectionCount(), 1);
    assert.equal(document.getParagraphCount(0), 2);
    const hits = parseArray(document.searchAllText("target", true, true), "searchAllText");
    assert.equal(hits.length, 2);
    const selectedHit = hits[1];
    const selected = parseObject(
      document.copySelection(
        selectedHit.sec,
        selectedHit.para,
        selectedHit.charOffset,
        selectedHit.para,
        selectedHit.charOffset + selectedHit.length,
      ),
      "copySelection",
    );
    assert.equal(selected.text, "target");
    parseObject(
      document.replaceText(
        selectedHit.sec,
        selectedHit.para,
        selectedHit.charOffset,
        selectedHit.length,
        "selected",
      ),
      "replaceText",
    );
    assert.equal(parseArray(document.searchAllText("target", true, true), "target after").length, 1);
    assert.equal(parseArray(document.searchAllText("selected", true, true), "selected after").length, 1);

    const verified = verifyHwp(document, "stateful");
    const hwp = verified.bytes;
    const hwpx = document.exportHwpx();
    assert.ok(hwpx.byteLength > 1024);
    const render = await renderAll(document, "stateful live");

    hwpReload = new core.HwpDocument(hwp);
    hwpxReload = new core.HwpDocument(hwpx);
    for (const [label, reopened] of [["hwp", hwpReload], ["hwpx", hwpxReload]]) {
      assert.equal(parseArray(reopened.searchAllText("Stateful runtime", true, true), `${label} search`).length, 1);
      assert.equal(parseArray(reopened.searchAllText("Atomic Patch 2.0", true, true), `${label} search 2`).length, 1);
      assert.equal(parseArray(reopened.searchAllText("selected", true, true), `${label} selected`).length, 1);
      await renderAll(reopened, `${label} reload`);
    }
    return {
      hwpBytes: hwp.byteLength,
      hwpxBytes: hwpx.byteLength,
      hwpRevision: sha256(hwp),
      pageCount: render.pageCount,
      exactRange: { beforeMatches: 2, afterOldMatches: 1, afterNewMatches: 1 },
    };
  } finally {
    free(hwpxReload);
    free(hwpReload);
    free(document);
  }
});

await check("paragraph lifecycle and forced page break", async () => {
  const document = core.HwpDocument.createEmpty();
  try {
    parseObject(document.insertText(0, 0, 0, "AB"), "insert AB");
    parseObject(document.splitParagraph(0, 0, 1), "splitParagraph");
    assert.equal(document.getParagraphCount(0), 2);
    parseObject(document.mergeParagraph(0, 1), "mergeParagraph");
    assert.equal(document.getParagraphCount(0), 1);
    parseObject(document.insertParagraph(0, 1), "insertParagraph");
    parseObject(document.insertText(0, 1, 0, "temporary"), "temporary text");
    parseObject(document.deleteParagraph(0, 1), "deleteParagraph");
    assert.equal(document.getParagraphCount(0), 1);
    parseObject(document.insertPageBreak(0, 0, 1), "insertPageBreak");
    assert.ok(document.pageCount() >= 2, "page break must create another page");
    await renderAll(document, "page break document");
    return { pageCount: document.pageCount(), paragraphCount: document.getParagraphCount(0) };
  } finally {
    free(document);
  }
});

await check("table and cell editing operations serialize and reopen", async () => {
  const document = core.HwpDocument.createEmpty();
  let reopened;
  try {
    const created = parseObject(document.createTable(0, 0, 0, 2, 2), "createTable");
    const control = Number.isInteger(created.controlIdx) ? created.controlIdx : 0;
    parseObject(document.insertTextInCell(0, 0, control, 0, 0, 0, "cell value"), "insertTextInCell");
    const copied = parseObject(document.copySelectionInCell(0, 0, control, 0, 0, 0, 0, 10), "copySelectionInCell");
    assert.equal(copied.text, "cell value");
    parseObject(document.deleteTextInCellDeferredPagination(0, 0, control, 0, 0, 0, 4), "delete cell text");
    parseObject(document.insertTextInCell(0, 0, control, 0, 0, 0, "CELL"), "insert cell replacement");
    parseObject(document.flushDeferredPagination(), "flush cell pagination");
    const replaced = parseObject(document.copySelectionInCell(0, 0, control, 0, 0, 0, 0, 10), "copy replaced cell");
    assert.equal(replaced.text, "CELL value");

    parseObject(document.insertTableRow(0, 0, control, 0, true), "insertTableRow");
    parseObject(document.deleteTableRow(0, 0, control, 2), "deleteTableRow");
    parseObject(document.insertTableColumn(0, 0, control, 0, true), "insertTableColumn");
    parseObject(document.deleteTableColumn(0, 0, control, 2), "deleteTableColumn");
    parseObject(document.mergeTableCells(0, 0, control, 0, 0, 0, 1), "mergeTableCells");
    parseObject(document.splitTableCell(0, 0, control, 0, 0), "splitTableCell");

    const { bytes } = verifyHwp(document, "table");
    reopened = new core.HwpDocument(bytes);
    assert.equal(parseArray(reopened.searchAllText("CELL value", true, true), "reopened cell search").length, 1);
    await renderAll(reopened, "reopened table");
    return { control, hwpBytes: bytes.byteLength, pages: reopened.pageCount() };
  } finally {
    free(reopened);
    free(document);
  }
});

await check("field, header, footnote, equation and picture object paths", async () => {
  const document = core.HwpDocument.createEmpty();
  let reopened;
  try {
    parseObject(document.insertText(0, 0, 0, "Objects"), "object anchor text");

    const field = parseObject(
      document.insertClickHereField(0, 0, 7, "이름", "검증", "applicant", true),
      "insertClickHereField",
    );
    assert.ok(Number.isInteger(field.fieldId));
    parseObject(document.setFieldValueByName("applicant", "홍길동"), "setFieldValueByName");
    const fieldInfo = parseObject(document.getFieldValueByName("applicant"), "getFieldValueByName");
    assert.equal(fieldInfo.value, "홍길동");

    parseObject(document.createHeaderFooter(0, true, 0), "createHeaderFooter");
    parseObject(document.insertTextInHeaderFooter(0, true, 0, 0, 0, "검증 머리말"), "insertTextInHeaderFooter");
    const header = parseObject(document.getHeaderFooter(0, true, 0), "getHeaderFooter");
    assert.ok(header.exists !== false);

    const footnote = parseObject(document.insertFootnote(0, 0, 1), "insertFootnote");
    let footnoteControl = footnote.controlIndex;
    if (!Number.isInteger(footnoteControl)) {
      const cursor = parseObject(document.getFootnoteAtCursor(0, 0, 2, "backward"), "getFootnoteAtCursor", { requireOk: false });
      assert.equal(cursor.hit, true);
      footnoteControl = cursor.controlIndex;
    }
    assert.ok(Number.isInteger(footnoteControl));
    parseObject(document.insertTextInFootnote(0, 0, footnoteControl, 0, 0, "각주 내용"), "insertTextInFootnote");
    const footnoteInfo = parseObject(document.getFootnoteInfo(0, 0, footnoteControl), "getFootnoteInfo");
    assert.equal(footnoteInfo.texts[0], "각주 내용");

    parseObject(document.insertParagraph(0, document.getParagraphCount(0)), "append object paragraph");
    const objectParagraph = document.getParagraphCount(0) - 1;
    parseObject(document.insertEquation(0, objectParagraph, 0, "x^2+y^2", 1000, 0), "insertEquation");

    const png = new Uint8Array(Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ));
    const pictureOptions = {
      sectionIdx: 0,
      paraIdx: objectParagraph,
      charOffset: 0,
      cellPath: "[]",
      width: 7200,
      height: 7200,
      naturalWidthPx: 1,
      naturalHeightPx: 1,
      extension: "png",
      description: "1x1 validation image",
      treatAsChar: true,
    };
    parseObject(document.insertPictureEx(JSON.stringify(pictureOptions), png), "insertPictureEx");

    const { bytes } = verifyHwp(document, "objects");
    reopened = new core.HwpDocument(bytes);
    assert.equal(parseArray(reopened.searchAllText("홍길동", true, true), "field value search").length, 1);
    await renderAll(reopened, "reopened objects");

    parseObject(document.deleteFootnote(0, 0, footnoteControl), "deleteFootnote");
    parseObject(document.deleteHeaderFooter(0, true, 0), "deleteHeaderFooter");
    return {
      fieldId: field.fieldId,
      footnoteControl,
      hwpBytes: bytes.byteLength,
      pages: reopened.pageCount(),
    };
  } finally {
    free(reopened);
    free(document);
  }
});

report.finishedAt = new Date().toISOString();
report.passed = report.checks.every((item) => item.passed);
report.summary = {
  passed: report.checks.filter((item) => item.passed).length,
  failed: report.checks.filter((item) => !item.passed).length,
  statefulResult,
};
await writeFile(new URL("./report.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary, null, 2));
assert.equal(report.passed, true);
