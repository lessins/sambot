export class SambotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'SambotError';
  }
}

export class ToolError extends SambotError {
  constructor(toolName: string, message: string, retryable = false) {
    super(`[${toolName}] ${message}`, 'TOOL_ERROR', retryable);
    this.name = 'ToolError';
  }
}

export class LLMError extends SambotError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'LLM_ERROR', statusCode === 429 || statusCode === 503);
    this.name = 'LLMError';
  }
}

export class TokenGateError extends SambotError {
  constructor(message: string) {
    super(message, 'TOKEN_GATE_ERROR', false);
    this.name = 'TokenGateError';
  }
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof SambotError) return err.retryable;
  const e = err as { status?: number; statusCode?: number };
  const code = e.status ?? e.statusCode;
  return code === 429 || code === 503 || code === 502;
}
