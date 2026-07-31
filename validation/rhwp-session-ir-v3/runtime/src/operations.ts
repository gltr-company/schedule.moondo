import { ContractError, VerificationError } from "./errors.js";
import type { RuntimePolicy } from "./policy.js";
import type { AssetResolver, PatchOperation, RhwpCoreDocument } from "./types.js";

export interface OperationExecutionContext {
  document: RhwpCoreDocument;
  policy: RuntimePolicy;
  assetResolver?: AssetResolver;
}

function scalarLength(text: string): number { return Array.from(text).length; }

export function parseCoreJson(raw: string, context: string, requireOk = true): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch (error) {
    throw new VerificationError(`${context} returned invalid JSON`, { raw: raw.slice(0, 1_000), cause: error instanceof Error ? error.message : String(error) });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new VerificationError(`${context} JSON must be an object`, { parsed });
  }
  const result = parsed as Record<string, unknown>;
  if (requireOk && result.ok !== true) throw new VerificationError(`${context} did not report ok=true`, { result });
  return result;
}

async function selectedText(document: RhwpCoreDocument, section: number, paragraph: number, start: number, end: number): Promise<string> {
  const result = parseCoreJson(await document.copySelection(section, paragraph, start, paragraph, end), "copySelection");
  if (typeof result.text !== "string") throw new VerificationError("copySelection did not return text", { result });
  return result.text;
}

async function selectedCellText(document: RhwpCoreDocument, operation: Extract<PatchOperation, { op: "replace_cell_text_range" }>): Promise<string> {
  const result = parseCoreJson(await document.copySelectionInCell(
    operation.section, operation.parentParagraph, operation.control, operation.cell,
    operation.cellParagraph, operation.offset, operation.cellParagraph, operation.offset + operation.length,
  ), "copySelectionInCell");
  if (typeof result.text !== "string") throw new VerificationError("copySelectionInCell did not return text", { result });
  return result.text;
}

async function assertRangeText(document: RhwpCoreDocument, section: number, paragraph: number, start: number, end: number, expectedText: string, context: string): Promise<void> {
  const actual = await selectedText(document, section, paragraph, start, end);
  if (actual !== expectedText) throw new VerificationError(`${context} expectedText mismatch`, { expected: expectedText, actual, section, paragraph, start, end });
}

export async function executeOperation(context: OperationExecutionContext, operation: PatchOperation): Promise<Record<string, unknown>> {
  const { document, policy } = context;
  switch (operation.op) {
    case "replace_text_range":
      await assertRangeText(document, operation.section, operation.paragraph, operation.offset, operation.offset + operation.length, operation.expectedText, operation.op);
      return parseCoreJson(await document.replaceText(operation.section, operation.paragraph, operation.offset, operation.length, operation.text), "replaceText");
    case "insert_text": {
      if (operation.expectedBefore !== undefined) {
        const length = scalarLength(operation.expectedBefore);
        if (operation.offset < length) throw new VerificationError("insert_text expectedBefore is outside paragraph");
        await assertRangeText(document, operation.section, operation.paragraph, operation.offset - length, operation.offset, operation.expectedBefore, "insert_text.expectedBefore");
      }
      if (operation.expectedAfter !== undefined) {
        const length = scalarLength(operation.expectedAfter);
        await assertRangeText(document, operation.section, operation.paragraph, operation.offset, operation.offset + length, operation.expectedAfter, "insert_text.expectedAfter");
      }
      return parseCoreJson(await document.insertText(operation.section, operation.paragraph, operation.offset, operation.text), "insertText");
    }
    case "delete_text":
      await assertRangeText(document, operation.section, operation.paragraph, operation.offset, operation.offset + operation.length, operation.expectedText, operation.op);
      return parseCoreJson(await document.deleteText(operation.section, operation.paragraph, operation.offset, operation.length), "deleteText");
    case "replace_cell_text_range": {
      const actual = await selectedCellText(document, operation);
      if (actual !== operation.expectedText) throw new VerificationError("replace_cell_text_range expectedText mismatch", { expected: operation.expectedText, actual });
      const deleted = operation.length === 0
        ? { ok: true, skipped: true }
        : parseCoreJson(await document.deleteTextInCellDeferredPagination(
            operation.section, operation.parentParagraph, operation.control, operation.cell,
            operation.cellParagraph, operation.offset, operation.length,
          ), "deleteTextInCellDeferredPagination");
      let inserted: Record<string, unknown> = { ok: true, skipped: true };
      if (operation.text.length > 0) {
        inserted = parseCoreJson(await document.insertTextInCell(
          operation.section, operation.parentParagraph, operation.control, operation.cell,
          operation.cellParagraph, operation.offset, operation.text,
        ), "insertTextInCell");
      }
      return { ok: true, deleted, inserted };
    }
    case "insert_paragraph": return parseCoreJson(await document.insertParagraph(operation.section, operation.paragraph), "insertParagraph");
    case "delete_paragraph": {
      const length = await document.getParagraphLength(operation.section, operation.paragraph);
      const actual = await selectedText(document, operation.section, operation.paragraph, 0, length);
      if (actual !== operation.expectedText) throw new VerificationError("delete_paragraph expectedText mismatch", { expected: operation.expectedText, actual });
      return parseCoreJson(await document.deleteParagraph(operation.section, operation.paragraph), "deleteParagraph");
    }
    case "split_paragraph": return parseCoreJson(await document.splitParagraph(operation.section, operation.paragraph, operation.offset), "splitParagraph");
    case "merge_paragraph": return parseCoreJson(await document.mergeParagraph(operation.section, operation.paragraph), "mergeParagraph");
    case "insert_page_break": return parseCoreJson(await document.insertPageBreak(operation.section, operation.paragraph, operation.offset), "insertPageBreak");
    case "apply_char_format":
      await assertRangeText(document, operation.section, operation.paragraph, operation.start, operation.end, operation.expectedText, operation.op);
      policy.checkJson(operation.props, "apply_char_format.props");
      return parseCoreJson(await document.applyCharFormat(operation.section, operation.paragraph, operation.start, operation.end, JSON.stringify(operation.props)), "applyCharFormat");
    case "apply_para_format":
      policy.checkJson(operation.props, "apply_para_format.props");
      return parseCoreJson(await document.applyParaFormat(operation.section, operation.paragraph, JSON.stringify(operation.props)), "applyParaFormat");
    case "apply_style": return parseCoreJson(await document.applyStyle(operation.section, operation.paragraph, operation.styleId), "applyStyle");
    case "create_table": return parseCoreJson(await document.createTable(operation.section, operation.paragraph, operation.offset, operation.rows, operation.cols), "createTable");
    case "insert_table_row": return parseCoreJson(await document.insertTableRow(operation.section, operation.parentParagraph, operation.control, operation.row, operation.below), "insertTableRow");
    case "insert_table_column": return parseCoreJson(await document.insertTableColumn(operation.section, operation.parentParagraph, operation.control, operation.col, operation.right), "insertTableColumn");
    case "delete_table_row": return parseCoreJson(await document.deleteTableRow(operation.section, operation.parentParagraph, operation.control, operation.row), "deleteTableRow");
    case "delete_table_column": return parseCoreJson(await document.deleteTableColumn(operation.section, operation.parentParagraph, operation.control, operation.col), "deleteTableColumn");
    case "merge_table_cells": return parseCoreJson(await document.mergeTableCells(operation.section, operation.parentParagraph, operation.control, operation.startRow, operation.startCol, operation.endRow, operation.endCol), "mergeTableCells");
    case "split_table_cell": return parseCoreJson(await document.splitTableCell(operation.section, operation.parentParagraph, operation.control, operation.row, operation.col), "splitTableCell");
    case "set_field_value": return parseCoreJson(await document.setFieldValueByName(operation.name, operation.value), "setFieldValueByName");
    case "insert_equation": return parseCoreJson(await document.insertEquation(operation.section, operation.paragraph, operation.offset, operation.script, operation.fontSize, operation.color), "insertEquation");
    case "insert_picture": {
      if (!context.assetResolver) throw new ContractError("insert_picture requires an AssetResolver");
      const asset = await context.assetResolver.resolve(operation.assetId);
      policy.checkAsset(asset, operation.assetId);
      const options = {
        sectionIdx: operation.section, paraIdx: operation.paragraph, charOffset: operation.offset,
        cellPath: "[]", width: operation.width, height: operation.height,
        naturalWidthPx: asset.naturalWidthPx, naturalHeightPx: asset.naturalHeightPx,
        extension: asset.extension, description: asset.description ?? "", treatAsChar: operation.treatAsChar ?? true,
      };
      return parseCoreJson(await document.insertPictureEx(JSON.stringify(options), asset.bytes), "insertPictureEx");
    }
    case "create_header_footer": return parseCoreJson(await document.createHeaderFooter(operation.section, operation.isHeader, operation.applyTo), "createHeaderFooter");
    case "delete_header_footer": return parseCoreJson(await document.deleteHeaderFooter(operation.section, operation.isHeader, operation.applyTo), "deleteHeaderFooter");
    case "insert_header_footer_text": return parseCoreJson(await document.insertTextInHeaderFooter(operation.section, operation.isHeader, operation.applyTo, operation.paragraph, operation.offset, operation.text), "insertTextInHeaderFooter");
    case "insert_footnote": return parseCoreJson(await document.insertFootnote(operation.section, operation.paragraph, operation.offset), "insertFootnote");
    case "delete_footnote": return parseCoreJson(await document.deleteFootnote(operation.section, operation.paragraph, operation.control), "deleteFootnote");
    case "insert_footnote_text": return parseCoreJson(await document.insertTextInFootnote(operation.section, operation.paragraph, operation.control, operation.footnoteParagraph, operation.offset, operation.text), "insertTextInFootnote");
  }
}
