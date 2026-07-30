export class RhwpRuntimeError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export class ContractError extends RhwpRuntimeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("CONTRACT_ERROR", message, details);
  }
}

export class SessionNotFoundError extends RhwpRuntimeError {
  constructor(handle: string) {
    super("SESSION_NOT_FOUND", `document session not found: ${handle}`, { handle });
  }
}

export class SessionClosedError extends RhwpRuntimeError {
  constructor(handle: string) {
    super("SESSION_CLOSED", `document session is closed: ${handle}`, { handle });
  }
}

export class RevisionMismatchError extends RhwpRuntimeError {
  constructor(expected: string, actual: string) {
    super("REVISION_MISMATCH", `patch targets ${expected}, current revision is ${actual}`, { expected, actual });
  }
}

export class AnchorMismatchError extends RhwpRuntimeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("ANCHOR_MISMATCH", message, details);
  }
}

export class CoreCompatibilityError extends RhwpRuntimeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("CORE_COMPATIBILITY_ERROR", message, details);
  }
}

export class OperationExecutionError extends RhwpRuntimeError {
  constructor(index: number, op: string, message: string, cause?: unknown) {
    super("OPERATION_EXECUTION_ERROR", `operation ${index} (${op}) failed: ${message}`, {
      index,
      op,
      cause: cause instanceof Error ? cause.message : String(cause ?? ""),
    });
  }
}

export class AssertionFailedError extends RhwpRuntimeError {
  constructor(index: number, assertion: string, expected: unknown, actual: unknown) {
    super("ASSERTION_FAILED", `assertion ${index} (${assertion}) failed`, { index, assertion, expected, actual });
  }
}

export class VerificationError extends RhwpRuntimeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("VERIFICATION_ERROR", message, details);
  }
}

export class RollbackError extends RhwpRuntimeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("ROLLBACK_ERROR", message, details);
  }
}

export class ResourceLimitError extends RhwpRuntimeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("RESOURCE_LIMIT", message, details);
  }
}
