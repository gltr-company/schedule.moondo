export type MaybePromise<T> = T | Promise<T>;

export interface RhwpCoreDocument {
  free?: () => void;
  pageCount(): number;
  renderPageSvg(page: number): MaybePromise<string>;
  exportHwp(): MaybePromise<Uint8Array>;
  exportHwpx(): MaybePromise<Uint8Array>;
  exportHwpVerify(): MaybePromise<string>;
  saveSnapshot(): number;
  restoreSnapshot(id: number): MaybePromise<string>;
  discardSnapshot(id: number): void;
  beginBatch(): MaybePromise<string>;
  endBatch(): MaybePromise<string>;
  flushDeferredPagination(): MaybePromise<string>;
  searchAllText(query: string, caseSensitive: boolean, includeCells: boolean): MaybePromise<string>;
  getSectionCount(): number;
  getParagraphCount(section: number): MaybePromise<number>;
  getParagraphLength(section: number, paragraph: number): MaybePromise<number>;
  copySelection(section: number, startParagraph: number, startOffset: number, endParagraph: number, endOffset: number): MaybePromise<string>;
  copySelectionInCell(section: number, parentParagraph: number, control: number, cell: number, startCellParagraph: number, startOffset: number, endCellParagraph: number, endOffset: number): MaybePromise<string>;
  replaceText(section: number, paragraph: number, offset: number, length: number, text: string): MaybePromise<string>;
  insertText(section: number, paragraph: number, offset: number, text: string): MaybePromise<string>;
  deleteText(section: number, paragraph: number, offset: number, count: number): MaybePromise<string>;
  insertTextInCell(section: number, parentParagraph: number, control: number, cell: number, cellParagraph: number, offset: number, text: string): MaybePromise<string>;
  deleteTextInCellDeferredPagination(section: number, parentParagraph: number, control: number, cell: number, cellParagraph: number, offset: number, count: number): MaybePromise<string>;
  insertParagraph(section: number, paragraph: number): MaybePromise<string>;
  deleteParagraph(section: number, paragraph: number): MaybePromise<string>;
  splitParagraph(section: number, paragraph: number, offset: number, removedMeta?: string): MaybePromise<string>;
  mergeParagraph(section: number, paragraph: number): MaybePromise<string>;
  insertPageBreak(section: number, paragraph: number, offset: number): MaybePromise<string>;
  applyCharFormat(section: number, paragraph: number, start: number, end: number, propsJson: string): MaybePromise<string>;
  applyParaFormat(section: number, paragraph: number, propsJson: string): MaybePromise<string>;
  applyStyle(section: number, paragraph: number, styleId: number): MaybePromise<string>;
  createTable(section: number, paragraph: number, offset: number, rows: number, cols: number): MaybePromise<string>;
  insertTableRow(section: number, parentParagraph: number, control: number, row: number, below: boolean): MaybePromise<string>;
  insertTableColumn(section: number, parentParagraph: number, control: number, col: number, right: boolean): MaybePromise<string>;
  deleteTableRow(section: number, parentParagraph: number, control: number, row: number): MaybePromise<string>;
  deleteTableColumn(section: number, parentParagraph: number, control: number, col: number): MaybePromise<string>;
  mergeTableCells(section: number, parentParagraph: number, control: number, startRow: number, startCol: number, endRow: number, endCol: number): MaybePromise<string>;
  splitTableCell(section: number, parentParagraph: number, control: number, row: number, col: number): MaybePromise<string>;
  setFieldValueByName(name: string, value: string): MaybePromise<string>;
  insertEquation(section: number, paragraph: number, offset: number, script: string, fontSize: number, color: number): MaybePromise<string>;
  insertPictureEx(optionsJson: string, bytes: Uint8Array): MaybePromise<string>;
  createHeaderFooter(section: number, isHeader: boolean, applyTo: number): MaybePromise<string>;
  deleteHeaderFooter(section: number, isHeader: boolean, applyTo: number): MaybePromise<string>;
  insertTextInHeaderFooter(section: number, isHeader: boolean, applyTo: number, paragraph: number, offset: number, text: string): MaybePromise<string>;
  insertFootnote(section: number, paragraph: number, offset: number): MaybePromise<string>;
  deleteFootnote(section: number, paragraph: number, control: number): MaybePromise<string>;
  insertTextInFootnote(section: number, paragraph: number, control: number, footnoteParagraph: number, offset: number, text: string): MaybePromise<string>;
}

export interface RhwpCoreDocumentConstructor {
  new (bytes: Uint8Array): RhwpCoreDocument;
  createEmpty(): RhwpCoreDocument;
}

export interface RhwpCoreModule {
  HwpDocument: RhwpCoreDocumentConstructor;
  default?: (input?: unknown) => Promise<unknown>;
  version?: () => string;
}

export interface RhwpCoreProvider {
  readonly version: string;
  open(bytes: Uint8Array): MaybePromise<RhwpCoreDocument>;
  createEmpty(): MaybePromise<RhwpCoreDocument>;
}

export interface Asset {
  readonly bytes: Uint8Array;
  readonly extension: string;
  readonly naturalWidthPx: number;
  readonly naturalHeightPx: number;
  readonly description?: string;
}

export interface AssetResolver {
  resolve(assetId: string): MaybePromise<Asset>;
}

export type ReplaceTextRangeOperation = { op: "replace_text_range"; section: number; paragraph: number; offset: number; length: number; expectedText: string; text: string };
export type InsertTextOperation = { op: "insert_text"; section: number; paragraph: number; offset: number; text: string; expectedBefore?: string; expectedAfter?: string };
export type DeleteTextOperation = { op: "delete_text"; section: number; paragraph: number; offset: number; length: number; expectedText: string };
export type ReplaceCellTextRangeOperation = { op: "replace_cell_text_range"; section: number; parentParagraph: number; control: number; cell: number; cellParagraph: number; offset: number; length: number; expectedText: string; text: string };
export type InsertParagraphOperation = { op: "insert_paragraph"; section: number; paragraph: number };
export type DeleteParagraphOperation = { op: "delete_paragraph"; section: number; paragraph: number; expectedText: string };
export type SplitParagraphOperation = { op: "split_paragraph"; section: number; paragraph: number; offset: number };
export type MergeParagraphOperation = { op: "merge_paragraph"; section: number; paragraph: number };
export type InsertPageBreakOperation = { op: "insert_page_break"; section: number; paragraph: number; offset: number };
export type ApplyCharFormatOperation = { op: "apply_char_format"; section: number; paragraph: number; start: number; end: number; expectedText: string; props: Record<string, unknown> };
export type ApplyParaFormatOperation = { op: "apply_para_format"; section: number; paragraph: number; props: Record<string, unknown> };
export type ApplyStyleOperation = { op: "apply_style"; section: number; paragraph: number; styleId: number };
export type CreateTableOperation = { op: "create_table"; section: number; paragraph: number; offset: number; rows: number; cols: number };
export type InsertTableRowOperation = { op: "insert_table_row"; section: number; parentParagraph: number; control: number; row: number; below: boolean };
export type InsertTableColumnOperation = { op: "insert_table_column"; section: number; parentParagraph: number; control: number; col: number; right: boolean };
export type DeleteTableRowOperation = { op: "delete_table_row"; section: number; parentParagraph: number; control: number; row: number };
export type DeleteTableColumnOperation = { op: "delete_table_column"; section: number; parentParagraph: number; control: number; col: number };
export type MergeTableCellsOperation = { op: "merge_table_cells"; section: number; parentParagraph: number; control: number; startRow: number; startCol: number; endRow: number; endCol: number };
export type SplitTableCellOperation = { op: "split_table_cell"; section: number; parentParagraph: number; control: number; row: number; col: number };
export type SetFieldValueOperation = { op: "set_field_value"; name: string; value: string };
export type InsertEquationOperation = { op: "insert_equation"; section: number; paragraph: number; offset: number; script: string; fontSize: number; color: number };
export type InsertPictureOperation = { op: "insert_picture"; section: number; paragraph: number; offset: number; assetId: string; width: number; height: number; treatAsChar?: boolean };
export type CreateHeaderFooterOperation = { op: "create_header_footer"; section: number; isHeader: boolean; applyTo: number };
export type DeleteHeaderFooterOperation = { op: "delete_header_footer"; section: number; isHeader: boolean; applyTo: number };
export type InsertHeaderFooterTextOperation = { op: "insert_header_footer_text"; section: number; isHeader: boolean; applyTo: number; paragraph: number; offset: number; text: string };
export type InsertFootnoteOperation = { op: "insert_footnote"; section: number; paragraph: number; offset: number };
export type DeleteFootnoteOperation = { op: "delete_footnote"; section: number; paragraph: number; control: number };
export type InsertFootnoteTextOperation = { op: "insert_footnote_text"; section: number; paragraph: number; control: number; footnoteParagraph: number; offset: number; text: string };

export type PatchOperation =
  | ReplaceTextRangeOperation | InsertTextOperation | DeleteTextOperation | ReplaceCellTextRangeOperation
  | InsertParagraphOperation | DeleteParagraphOperation | SplitParagraphOperation | MergeParagraphOperation
  | InsertPageBreakOperation | ApplyCharFormatOperation | ApplyParaFormatOperation | ApplyStyleOperation
  | CreateTableOperation | InsertTableRowOperation | InsertTableColumnOperation | DeleteTableRowOperation
  | DeleteTableColumnOperation | MergeTableCellsOperation | SplitTableCellOperation | SetFieldValueOperation
  | InsertEquationOperation | InsertPictureOperation | CreateHeaderFooterOperation | DeleteHeaderFooterOperation
  | InsertHeaderFooterTextOperation | InsertFootnoteOperation | DeleteFootnoteOperation | InsertFootnoteTextOperation;

export type SearchCountAssertion = { assert: "search_count"; query: string; expectedCount: number; caseSensitive?: boolean; includeCells?: boolean };
export type PageCountAssertion = { assert: "page_count"; expected: number };
export type SectionCountAssertion = { assert: "section_count"; expected: number };
export type ParagraphCountAssertion = { assert: "paragraph_count"; section: number; expected: number };
export type TextRangeAssertion = { assert: "text_range"; section: number; paragraph: number; start: number; end: number; expectedText: string };
export type PatchAssertion = SearchCountAssertion | PageCountAssertion | SectionCountAssertion | ParagraphCountAssertion | TextRangeAssertion;

export interface NativePatchV2 {
  schemaVersion: "2.0";
  offsetUnit: "unicode-scalar";
  documentRevision: string;
  operations: PatchOperation[];
  assertions: PatchAssertion[];
}

export interface OpenSessionResult { handle: string; revision: string; pageCount: number; coreVersion: string; }
export interface SessionInfo extends OpenSessionResult { closed: boolean; }
export interface OperationResult { index: number; op: PatchOperation["op"]; result: Readonly<Record<string, unknown>>; }
export interface AssertionResult { index: number; assertion: PatchAssertion["assert"]; expected: unknown; actual: unknown; passed: true; }
export interface PatchApplyResult {
  handle: string;
  previousRevision: string;
  revision: string;
  pageCount: number;
  hwpBytes: Uint8Array;
  operations: OperationResult[];
  assertions: AssertionResult[];
  renderedPages: number;
  verify: Readonly<Record<string, unknown>>;
}
export interface RenderedPage { page: number; svg: string; }
