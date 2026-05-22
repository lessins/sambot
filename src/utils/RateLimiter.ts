export class RateLimiter {
  private queue:    Array<() => void> = [];
  private running   = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly maxPerMinute: number,
    private readonly maxConcurrent = 5,
  ) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.running = Math.max(0, this.running - 1);
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; backoffMs?: number; jitter?: boolean } = {},
): Promise<T> {
  const { maxAttempts = 3, backoffMs = 1000, jitter = true } = opts;

  const attempt = async (n: number): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (n >= maxAttempts) throw err;
      const base  = backoffMs * Math.pow(2, n - 1);
      const delay = jitter ? base + Math.random() * 300 : base;
      await new Promise((r) => setTimeout(r, delay));
      return attempt(n + 1);
    }
  };

  return attempt(1);
}
