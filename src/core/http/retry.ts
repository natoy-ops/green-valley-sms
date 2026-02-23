/**
 * Retry utility for transient network errors (ECONNRESET, ETIMEDOUT, etc.).
 * Used by server-side Supabase calls to avoid treating network blips as auth failures.
 */

const TRANSIENT_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const error = err as Record<string, unknown>;

  // Check the error code directly
  if (typeof error.code === "string" && TRANSIENT_ERROR_CODES.has(error.code)) {
    return true;
  }

  // Check nested cause (Node.js fetch wraps network errors)
  if (error.cause && typeof error.cause === "object") {
    const cause = error.cause as Record<string, unknown>;
    if (typeof cause.code === "string" && TRANSIENT_ERROR_CODES.has(cause.code)) {
      return true;
    }
  }

  // Check message for fetch failures
  if (typeof error.message === "string") {
    const msg = error.message.toLowerCase();
    if (msg.includes("fetch failed") || msg.includes("econnreset") || msg.includes("etimedout")) {
      return true;
    }
  }

  return false;
}

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms between retries. Default: 500 */
  baseDelayMs?: number;
  /** Label for logging. Default: "retryAsync" */
  label?: string;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 500,
  label: "retryAsync",
};

export async function retryAsync<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isTransientError(err) || attempt === config.maxAttempts) {
        throw err;
      }

      const delay = config.baseDelayMs * attempt;
      console.warn(
        `[${config.label}] Transient error on attempt ${attempt}/${config.maxAttempts}, retrying in ${delay}ms`,
        err instanceof Error ? { name: err.name, message: err.message } : err
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
