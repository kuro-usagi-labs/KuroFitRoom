import type { Project } from '@/types';
import { validateProject } from './schema';

const DB_NAME = 'roomfit';
const DB_VERSION = 1;
const STORE = 'projects';

const memoryFallback = new Map<string, Project>();
let useMemory = typeof indexedDB === 'undefined';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (useMemory) return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      useMemory = true;
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      if (request.error?.name === 'SecurityError' || request.error?.name === 'InvalidStateError') {
        useMemory = true;
      }
      reject(request.error ?? new Error('Unable to open project database'));
    };
    request.onblocked = () => reject(new Error('Project database is blocked by another tab'));
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  if (useMemory) throw new Error('IndexedDB unavailable');
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let request: IDBRequest<T> | void;
    try {
      request = run(store);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => {
      if (request) resolve(request.result);
      else resolve(undefined as T);
    };
    tx.onerror = () => reject(tx.error ?? new Error('Project database operation failed'));
    tx.onabort = () => reject(tx.error ?? new Error('Project database operation aborted'));
  });
}

export async function listProjects(): Promise<Project[]> {
  if (useMemory) {
    return [...memoryFallback.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  try {
    const raw = await withStore<Project[]>('readonly', (store) => store.getAll());
    return raw
      .map((project) => {
        try {
          return validateProject(project);
        } catch {
          return null;
        }
      })
      .filter((project): project is Project => project !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    if (useMemory) return [...memoryFallback.values()];
    throw new Error('Could not read saved projects.');
  }
}

export async function loadProject(id: string): Promise<Project | null> {
  if (useMemory) return memoryFallback.get(id) ?? null;
  try {
    const raw = await withStore<Project | undefined>('readonly', (store) => store.get(id));
    return raw ? validateProject(raw) : null;
  } catch {
    if (useMemory) return memoryFallback.get(id) ?? null;
    throw new Error('Could not load that project.');
  }
}

export async function saveProject(project: Project): Promise<void> {
  const record: Project = { ...project, updatedAt: Date.now() };
  if (useMemory) {
    memoryFallback.set(record.id, record);
    return;
  }
  try {
    await withStore('readwrite', (store) => store.put(record));
  } catch (error) {
    if (useMemory) {
      memoryFallback.set(record.id, record);
      return;
    }
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Local storage is full. Export this project and remove older saves.');
    }
    throw new Error('Could not save the project.');
  }
}

export async function deleteProjectRecord(id: string): Promise<void> {
  if (useMemory) {
    memoryFallback.delete(id);
    return;
  }
  try {
    await withStore('readwrite', (store) => store.delete(id));
  } catch {
    if (useMemory) {
      memoryFallback.delete(id);
      return;
    }
    throw new Error('Could not delete that project.');
  }
}

export async function clearAllProjects(): Promise<void> {
  if (useMemory) {
    memoryFallback.clear();
    return;
  }
  await withStore('readwrite', (store) => store.clear());
}

export function isStorageFallback(): boolean {
  return useMemory;
}
