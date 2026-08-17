import '@testing-library/jest-dom/vitest'

type StorageLike = Pick<Storage, 'clear' | 'getItem' | 'key' | 'removeItem' | 'setItem'> & {
  readonly length: number
}

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(String(key)) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(String(key))
    },
    setItem(key, value) {
      values.set(String(key), String(value))
    },
  }
}

function getStorage(name: 'localStorage' | 'sessionStorage'): StorageLike {
  try {
    const storage = window[name]
    if (storage && typeof storage.clear === 'function') return storage
  } catch {
    // jsdom can expose Storage through a getter that throws for an opaque origin.
  }
  return createMemoryStorage()
}

// Node 26 no longer exposes an in-memory global localStorage by default. Vitest's
// jsdom environment can therefore leave the global used by application code and
// tests undefined, even though jsdom itself is active. Keep this fallback scoped to
// the test setup; production code continues to use the browser-provided Storage.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: getStorage('localStorage'),
})
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: getStorage('sessionStorage'),
})
