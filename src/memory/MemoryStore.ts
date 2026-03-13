import Database from 'better-sqlite3';
import path      from 'path';
import fs        from 'fs';
import { MemoryEntry } from '../types';

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const p = dbPath ?? process.env.MEMORY_DB_PATH ?? './.sambot/memory.sqlite';
    fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true });
    this.db = new Database(p);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id         TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        content    TEXT NOT NULL,
        embedding  TEXT,
        metadata   TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_session ON memories(session_id);
      CREATE INDEX IF NOT EXISTS idx_created ON memories(created_at);
    `);
  }

  save(entry: Omit<MemoryEntry, 'createdAt'>): MemoryEntry {
    const now = Date.now();
    this.db.prepare(`
      INSERT OR REPLACE INTO memories (id, session_id, content, embedding, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.sessionId,
      entry.content,
      entry.embedding ? JSON.stringify(entry.embedding) : null,
      entry.metadata  ? JSON.stringify(entry.metadata)  : null,
      now,
    );

    return { ...entry, createdAt: new Date(now) };
  }

  getBySession(sessionId: string, limit = 20): MemoryEntry[] {
    const rows = this.db.prepare(`
      SELECT * FROM memories WHERE session_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(sessionId, limit) as Array<Record<string, unknown>>;
    return rows.map(this.rowToEntry);
  }

  getRecent(limit = 50): MemoryEntry[] {
    const rows = this.db.prepare(`
      SELECT * FROM memories ORDER BY created_at DESC LIMIT ?
    `).all(limit) as Array<Record<string, unknown>>;
    return rows.map(this.rowToEntry);
  }

  search(query: string, limit = 10): MemoryEntry[] {
    const rows = this.db.prepare(`
      SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?
    `).all(`%${query}%`, limit) as Array<Record<string, unknown>>;
    return rows.map(this.rowToEntry);
  }

  cosineSimilaritySearch(queryEmbedding: number[], limit = 10): MemoryEntry[] {
    const all = this.db.prepare(
      `SELECT * FROM memories WHERE embedding IS NOT NULL`,
    ).all() as Array<Record<string, unknown>>;

    const scored = all
      .map((row) => {
        const emb: number[] = JSON.parse(row['embedding'] as string);
        return { entry: this.rowToEntry(row), score: cosineSim(queryEmbedding, emb) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => s.entry);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  }

  clearSession(sessionId: string): void {
    this.db.prepare('DELETE FROM memories WHERE session_id = ?').run(sessionId);
  }

  close(): void {
    this.db.close();
  }

  private rowToEntry(row: Record<string, unknown>): MemoryEntry {
    return {
      id:        row['id'] as string,
      sessionId: row['session_id'] as string,
      content:   row['content'] as string,
      embedding: row['embedding'] ? JSON.parse(row['embedding'] as string) : undefined,
      metadata:  row['metadata']  ? JSON.parse(row['metadata']  as string) : undefined,
      createdAt: new Date(row['created_at'] as number),
    };
  }
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
