import fs   from 'fs';
import path  from 'path';
import { Plugin, ToolDefinition } from '../types';

const MAX_READ_BYTES   = 256 * 1024; // 256KB
const MAX_LIST_ENTRIES = 200;

function safeResolve(filePath: string, root?: string): string {
  const resolved = path.resolve(filePath);
  if (root) {
    const rootResolved = path.resolve(root);
    if (!resolved.startsWith(rootResolved)) {
      throw new Error(`path traversal blocked: ${filePath}`);
    }
  }
  return resolved;
}

export class FileSystemPlugin implements Plugin {
  name    = 'filesystem';
  version = '0.2.0';

  private root?: string;

  constructor(root?: string) {
    this.root = root;
  }

  tools: ToolDefinition[] = [
    {
      name: 'fs_read',
      description: 'Read the contents of a file from the local filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path:       { type: 'string', description: 'Absolute or relative file path' },
          encoding:   { type: 'string', description: 'File encoding (default: utf-8)' },
          maxBytes:   { type: 'number', description: 'Max bytes to read' },
        },
        required: ['path'],
      },
    },
    {
      name: 'fs_write',
      description: 'Write content to a file. Creates the file and any parent directories if they do not exist.',
      parameters: {
        type: 'object',
        properties: {
          path:    { type: 'string', description: 'File path to write to' },
          content: { type: 'string', description: 'Content to write' },
          append:  { type: 'boolean', description: 'If true, appends instead of overwriting' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'fs_list',
      description: 'List files and directories at a given path.',
      parameters: {
        type: 'object',
        properties: {
          path:      { type: 'string', description: 'Directory path to list' },
          recursive: { type: 'boolean', description: 'If true, list recursively (max 200 entries)' },
        },
        required: ['path'],
      },
    },
    {
      name: 'fs_delete',
      description: 'Delete a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to delete' },
        },
        required: ['path'],
      },
    },
    {
      name: 'fs_exists',
      description: 'Check whether a file or directory exists.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to check' },
        },
        required: ['path'],
      },
    },
  ];

  async execute(toolName: string, args: Record<string, unknown>): Promise<string> {
    switch (toolName) {
      case 'fs_read':   return this.read(args);
      case 'fs_write':  return this.write(args);
      case 'fs_list':   return this.list(args);
      case 'fs_delete': return this.delete_(args);
      case 'fs_exists': return this.exists(args);
      default: throw new Error(`unknown tool: ${toolName}`);
    }
  }

  private async read(args: Record<string, unknown>): Promise<string> {
    const resolved = safeResolve(args['path'] as string, this.root);
    const maxBytes = (args['maxBytes'] as number) ?? MAX_READ_BYTES;

    const stat = fs.statSync(resolved);
    if (!stat.isFile()) throw new Error(`not a file: ${resolved}`);

    const fd     = fs.openSync(resolved, 'r');
    const buf    = Buffer.alloc(Math.min(maxBytes, stat.size));
    const nRead  = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);

    const content = buf.slice(0, nRead).toString('utf-8');
    const truncated = nRead < stat.size;
    return truncated ? content + `\n\n[truncated — ${stat.size - nRead} bytes omitted]` : content;
  }

  private async write(args: Record<string, unknown>): Promise<string> {
    const resolved = safeResolve(args['path'] as string, this.root);
    const content  = args['content'] as string;
    const append   = (args['append'] as boolean) ?? false;

    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    if (append) {
      fs.appendFileSync(resolved, content, 'utf-8');
    } else {
      fs.writeFileSync(resolved, content, 'utf-8');
    }
    return `written ${Buffer.byteLength(content)} bytes to ${resolved}`;
  }

  private async list(args: Record<string, unknown>): Promise<string> {
    const resolved  = safeResolve(args['path'] as string, this.root);
    const recursive = (args['recursive'] as boolean) ?? false;
    const entries: string[] = [];

    const walk = (dir: string, depth: number): void => {
      if (entries.length >= MAX_LIST_ENTRIES) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const rel  = path.relative(resolved, full);
        entries.push(entry.isDirectory() ? `${rel}/` : rel);
        if (recursive && entry.isDirectory() && depth < 4) walk(full, depth + 1);
        if (entries.length >= MAX_LIST_ENTRIES) return;
      }
    };

    walk(resolved, 0);
    return entries.join('\n') || '(empty directory)';
  }

  private async delete_(args: Record<string, unknown>): Promise<string> {
    const resolved = safeResolve(args['path'] as string, this.root);
    fs.unlinkSync(resolved);
    return `deleted: ${resolved}`;
  }

  private async exists(args: Record<string, unknown>): Promise<string> {
    const resolved = safeResolve(args['path'] as string, this.root);
    return fs.existsSync(resolved) ? 'exists' : 'does not exist';
  }
}
