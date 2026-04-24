import fs   from 'fs';
import path  from 'path';
import os    from 'os';
import { MemoryStore } from '../src/memory/MemoryStore';

describe('MemoryStore', () => {
  let store: MemoryStore;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `sambot-mem-${Date.now()}.sqlite`);
    store  = new MemoryStore(dbPath);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('saves and retrieves by session', () => {
    store.save({ id: 'e1', sessionId: 'sess-a', content: 'first entry' });
    store.save({ id: 'e2', sessionId: 'sess-a', content: 'second entry' });
    store.save({ id: 'e3', sessionId: 'sess-b', content: 'other session' });

    const results = store.getBySession('sess-a');
    expect(results).toHaveLength(2);
    expect(results.some((r) => r.content === 'first entry')).toBe(true);
  });

  it('full-text search', () => {
    store.save({ id: 'x1', sessionId: 's', content: 'bitcoin price analysis' });
    store.save({ id: 'x2', sessionId: 's', content: 'weather in new york' });
    const results = store.search('bitcoin');
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('bitcoin');
  });

  it('cosine similarity search', () => {
    const emb = (v: number): number[] => Array(8).fill(0).map((_, i) => i === v ? 1 : 0);

    store.save({ id: 'v1', sessionId: 's', content: 'vec 0', embedding: emb(0) });
    store.save({ id: 'v2', sessionId: 's', content: 'vec 1', embedding: emb(1) });
    store.save({ id: 'v3', sessionId: 's', content: 'vec 2', embedding: emb(2) });

    const results = store.cosineSimilaritySearch(emb(1), 1);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('vec 1');
  });

  it('deletes an entry', () => {
    store.save({ id: 'del1', sessionId: 's', content: 'to be deleted' });
    store.delete('del1');
    const results = store.search('to be deleted');
    expect(results).toHaveLength(0);
  });

  it('clears a session', () => {
    store.save({ id: 'c1', sessionId: 'clear-me', content: 'one' });
    store.save({ id: 'c2', sessionId: 'clear-me', content: 'two' });
    store.clearSession('clear-me');
    expect(store.getBySession('clear-me')).toHaveLength(0);
  });
});
