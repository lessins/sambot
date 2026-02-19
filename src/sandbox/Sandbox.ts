import { execFile }  from 'child_process';
import fs             from 'fs';
import os             from 'os';
import path           from 'path';
import { promisify }  from 'util';

const execFileAsync = promisify(execFile);

export type SupportedLang = 'python' | 'javascript' | 'typescript' | 'bash' | 'node';

export interface SandboxResult {
  stdout:    string;
  stderr:    string;
  exitCode:  number;
  timedOut:  boolean;
  duration:  number;
}

const LANG_EXT: Record<SupportedLang, string> = {
  python:     'py',
  javascript: 'js',
  typescript: 'ts',
  bash:       'sh',
  node:       'js',
};

const LANG_CMD: Record<SupportedLang, string> = {
  python:     'python3',
  javascript: 'node',
  typescript: 'ts-node',
  bash:       'bash',
  node:       'node',
};

export class Sandbox {
  private timeoutMs:    number;
  private maxOutputBytes: number;
  private tmpDir:       string;

  constructor(opts: { timeoutMs?: number; maxOutputBytes?: number } = {}) {
    this.timeoutMs      = opts.timeoutMs      ?? parseInt(process.env.SANDBOX_TIMEOUT_MS    ?? '15000', 10);
    this.maxOutputBytes = opts.maxOutputBytes ?? parseInt(process.env.SANDBOX_MAX_OUTPUT_BYTES ?? '65536', 10);
    this.tmpDir         = fs.mkdtempSync(path.join(os.tmpdir(), 'sambot-'));
  }

  async run(code: string, lang: SupportedLang = 'python'): Promise<SandboxResult> {
    const ext      = LANG_EXT[lang];
    const cmd      = LANG_CMD[lang];
    const filePath = path.join(this.tmpDir, `run_${Date.now()}.${ext}`);
    const start    = Date.now();

    fs.writeFileSync(filePath, code, 'utf-8');

    try {
      const { stdout, stderr } = await Promise.race([
        execFileAsync(cmd, [filePath], {
          timeout:    this.timeoutMs,
          maxBuffer:  this.maxOutputBytes,
          env: {
            ...process.env,
            // strip sensitive keys from child process
            OPENAI_API_KEY:    undefined,
            ANTHROPIC_API_KEY: undefined,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), this.timeoutMs),
        ),
      ]);

      return {
        stdout:   this.trim(stdout),
        stderr:   this.trim(stderr),
        exitCode: 0,
        timedOut: false,
        duration: Date.now() - start,
      };
    } catch (err: unknown) {
      const e = err as Error & { code?: number; stdout?: string; stderr?: string };
      if (e.message === 'TIMEOUT') {
        return { stdout: '', stderr: 'execution timed out', exitCode: -1, timedOut: true, duration: this.timeoutMs };
      }
      return {
        stdout:   this.trim(e.stdout ?? ''),
        stderr:   this.trim(e.stderr ?? e.message),
        exitCode: e.code ?? 1,
        timedOut: false,
        duration: Date.now() - start,
      };
    } finally {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
  }

  cleanup(): void {
    try { fs.rmSync(this.tmpDir, { recursive: true }); } catch { /* ignore */ }
  }

  private trim(s: string): string {
    if (Buffer.byteLength(s) > this.maxOutputBytes) {
      return s.slice(0, this.maxOutputBytes) + '\n[output truncated]';
    }
    return s.trim();
  }
}
