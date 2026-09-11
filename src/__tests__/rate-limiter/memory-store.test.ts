import { MemoryStore } from '@/lib/rate-limiter/stores/memory-store';

describe('MemoryStore', () => {
  let store: MemoryStore<string>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    // Use a long cleanup interval so it doesn't interfere with tests
    store = new MemoryStore<string>(300_000);
  });

  afterEach(() => {
    store.destroy();
    jest.useRealTimers();
  });

  it('stores and retrieves values', () => {
    store.set('key-1', 'value-1', 60_000);
    expect(store.get('key-1')).toBe('value-1');
  });

  it('returns undefined for missing keys', () => {
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('returns undefined for expired keys', () => {
    store.set('key-1', 'value-1', 5_000);

    // Advance past TTL
    jest.advanceTimersByTime(5_001);

    expect(store.get('key-1')).toBeUndefined();
  });

  it('returns value within TTL', () => {
    store.set('key-1', 'value-1', 5_000);

    jest.advanceTimersByTime(4_999);

    expect(store.get('key-1')).toBe('value-1');
  });

  it('deletes a specific key', () => {
    store.set('key-1', 'value-1', 60_000);
    store.set('key-2', 'value-2', 60_000);

    store.delete('key-1');

    expect(store.get('key-1')).toBeUndefined();
    expect(store.get('key-2')).toBe('value-2');
  });

  it('clear() removes all entries', () => {
    store.set('key-1', 'value-1', 60_000);
    store.set('key-2', 'value-2', 60_000);

    store.clear();

    expect(store.get('key-1')).toBeUndefined();
    expect(store.get('key-2')).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('overwrites existing keys', () => {
    store.set('key-1', 'old', 60_000);
    store.set('key-1', 'new', 60_000);

    expect(store.get('key-1')).toBe('new');
  });

  it('handles per-key isolation', () => {
    store.set('key-1', 'value-1', 60_000);
    store.set('key-2', 'value-2', 60_000);
    store.set('key-3', 'value-3', 60_000);

    expect(store.get('key-1')).toBe('value-1');
    expect(store.get('key-2')).toBe('value-2');
    expect(store.get('key-3')).toBe('value-3');
    expect(store.size).toBe(3);
  });

  it('cleanup interval removes expired entries', () => {
    const shortCleanupStore = new MemoryStore<string>(1_000);

    shortCleanupStore.set('key-1', 'value-1', 2_000);
    shortCleanupStore.set('key-2', 'value-2', 10_000);
    expect(shortCleanupStore.size).toBe(2);

    // Advance past first key's TTL and past cleanup interval
    jest.advanceTimersByTime(3_000);

    // After cleanup sweep, only key-2 should remain
    expect(shortCleanupStore.size).toBe(1);
    expect(shortCleanupStore.get('key-1')).toBeUndefined();
    expect(shortCleanupStore.get('key-2')).toBe('value-2');

    shortCleanupStore.destroy();
  });

  it('works with complex value types', () => {
    const complexStore = new MemoryStore<{ count: number; timestamps: number[] }>(300_000);

    complexStore.set('key-1', { count: 5, timestamps: [1, 2, 3] }, 60_000);

    const value = complexStore.get('key-1');
    expect(value).toEqual({ count: 5, timestamps: [1, 2, 3] });

    complexStore.destroy();
  });
});
