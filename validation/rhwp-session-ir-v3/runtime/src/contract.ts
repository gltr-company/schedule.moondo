import { CoreCompatibilityError } from "./errors.js";
import type { PatchOperation, RhwpCoreDocument } from "./types.js";

export const PATCH_SCHEMA_VERSION = "2.0" as const;
export const OFFSET_UNIT = "unicode-scalar" as const;
export const SUPPORTED_CORE_VERSION = "0.8.2" as const;

export const OPERATION_NAMES = [
  "replace_text_range", "insert_text", "delete_text", "replace_cell_text_range",
  "insert_paragraph", "delete_paragraph", "split_paragraph", "merge_paragraph",
  "insert_page_break", "apply_char_format", "apply_para_format", "apply_style",
  "create_table", "insert_table_row", "insert_table_column", "delete_table_row",
  "delete_table_column", "merge_table_cells", "split_table_cell", "set_field_value",
  "insert_equation", "insert_picture", "create_header_footer", "delete_header_footer",
  "insert_header_footer_text", "insert_footnote", "delete_footnote", "insert_footnote_text",
] as const satisfies readonly PatchOperation["op"][];

export const REQUIRED_CORE_METHODS = [
  "pageCount", "renderPageSvg", "exportHwp", "exportHwpx", "exportHwpVerify",
  "saveSnapshot", "restoreSnapshot", "discardSnapshot", "beginBatch", "endBatch",
  "flushDeferredPagination", "searchAllText", "getSectionCount", "getParagraphCount",
  "getParagraphLength", "copySelection", "copySelectionInCell", "replaceText",
  "insertText", "deleteText", "insertTextInCell", "deleteTextInCellDeferredPagination",
  "insertParagraph", "deleteParagraph", "splitParagraph", "mergeParagraph",
  "insertPageBreak", "applyCharFormat", "applyParaFormat", "applyStyle", "createTable",
  "insertTableRow", "insertTableColumn", "deleteTableRow", "deleteTableColumn",
  "mergeTableCells", "splitTableCell", "setFieldValueByName", "insertEquation",
  "insertPictureEx", "createHeaderFooter", "deleteHeaderFooter", "insertTextInHeaderFooter",
  "insertFootnote", "deleteFootnote", "insertTextInFootnote",
] as const;

export function assertCoreVersion(version: string): void {
  if (version !== SUPPORTED_CORE_VERSION) {
    throw new CoreCompatibilityError(`unsupported @rhwp/core version ${version}; expected ${SUPPORTED_CORE_VERSION}`);
  }
}

export function assertCoreDocument(document: RhwpCoreDocument): void {
  const missing = REQUIRED_CORE_METHODS.filter(
    (method) => typeof (document as unknown as Record<string, unknown>)[method] !== "function",
  );
  if (missing.length > 0) {
    throw new CoreCompatibilityError("@rhwp/core document is missing required methods", { missing });
  }
}
