const store = new Map();

export const cache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
    return entry.value;
  },
  set(key, value, ttlMs) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  },
  del(key) { store.delete(key); },
  clear() { store.clear(); },
};
