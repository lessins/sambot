import fs   from 'fs';
import path  from 'path';
import os    from 'os';
import { FileSystemPlugin } from '../src/tools/FileSystemTool';
import { Sandbox }          from '../src/sandbox/Sandbox';

// --- FileSystemPlugin ---

describe('FileSystemPlugin', () => {
  let tmpDir: string;
  let plugin: FileSystemPlugin;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sambot-test-'));
    plugin = new FileSystemPlugin(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes and reads a file', async () => {
    const filePath = path.join(tmpDir, 'hello.txt');
    await plugin.execute('fs_write', { path: filePath, content: 'hello world' });
    const content = await plugin.execute('fs_read', { path: filePath });
    expect(content).toBe('hello world');
  });

  it('lists directory contents', async () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a');
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'b');
    const listing = await plugin.execute('fs_list', { path: tmpDir });
    expect(listing).toContain('a.txt');
    expect(listing).toContain('b.txt');
  });

  it('checks existence', async () => {
    const fp = path.join(tmpDir, 'check.txt');
    expect(await plugin.execute('fs_exists', { path: fp })).toBe('does not exist');
    fs.writeFileSync(fp, 'x');
    expect(await plugin.execute('fs_exists', { path: fp })).toBe('exists');
  });

  it('deletes a file', async () => {
    const fp = path.join(tmpDir, 'del.txt');
    fs.writeFileSync(fp, 'bye');
    await plugin.execute('fs_delete', { path: fp });
    expect(fs.existsSync(fp)).toBe(false);
  });

  it('appends to file', async () => {
    const fp = path.join(tmpDir, 'append.txt');
    await plugin.execute('fs_write', { path: fp, content: 'line1\n' });
    await plugin.execute('fs_write', { path: fp, content: 'line2\n', append: true });
    const content = fs.readFileSync(fp, 'utf-8');
    expect(content).toBe('line1\nline2\n');
  });

  it('throws on unknown tool', async () => {
    await expect(plugin.execute('fs_unknown', {})).rejects.toThrow('unknown tool');
  });
});

// --- Sandbox ---

describe('Sandbox', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = new Sandbox({ timeoutMs: 5000, maxOutputBytes: 8192 });
  });

  afterEach(() => sandbox.cleanup());

  it('runs python and returns stdout', async () => {
    const result = await sandbox.run('print("hello from python")', 'python');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello from python');
    expect(result.timedOut).toBe(false);
  });

  it('captures stderr for syntax errors', async () => {
    const result = await sandbox.run('def broken(:', 'python');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('runs javascript and returns stdout', async () => {
    const result = await sandbox.run('console.log(2 + 2)', 'javascript');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('4');
  });

  it('times out long-running code', async () => {
    const sb     = new Sandbox({ timeoutMs: 500 });
    const result = await sb.run('import time; time.sleep(10)', 'python');
    expect(result.timedOut).toBe(true);
    sb.cleanup();
  });
});
