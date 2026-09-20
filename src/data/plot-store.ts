import { Plot } from '../almanac/plan';

const STORAGE_KEY = 'farm-plots-v1';

// 纯函数形式，方便测试时注入存储
export function loadPlots(storage: Pick<Storage, 'getItem'> = safeStorage()): Plot[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Plot[];
  } catch {
    return [];
  }
}

export function savePlots(plots: Plot[], storage: Pick<Storage, 'setItem'> = safeStorage()) {
  storage.setItem(STORAGE_KEY, JSON.stringify(plots));
}

export function clearPlots(storage: Pick<Storage, 'removeItem'> = safeStorage()) {
  storage.removeItem(STORAGE_KEY);
}

// SSR / 无痕模式下 localStorage 可能不可用，降级为内存存储
let memoryStore = new Map<string, string>();
function safeStorage(): Storage {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* fall through */ }
  return {
    getItem: (k: string) => memoryStore.get(k) ?? null,
    setItem: (k: string, v: string) => { memoryStore.set(k, v); },
    removeItem: (k: string) => { memoryStore.delete(k); },
    clear: () => { memoryStore.clear(); },
    key: (i: number) => [...memoryStore.keys()][i] ?? null,
    get length() { return memoryStore.size; }
  } as Storage;
}
