import {
  CHUNK_SERIALIZATION_VERSION,
  IChunkStore,
  SerializedChunk,
} from "./IChunkStore";

const DB_NAME = "AmelcraftWorld";
const STORE_NAME = "chunks";
const DB_VERSION = 1;

export class IndexedDBChunkStore implements IChunkStore {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const openReq = indexedDB.open(DB_NAME, DB_VERSION);
      openReq.onupgradeneeded = () => {
        const db = openReq.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      openReq.onsuccess = () => resolve(openReq.result);
      openReq.onerror = () => reject(openReq.error);
    });
  }

  private async withStore(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => void
  ) {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      try {
        run(store);
      } catch (e) {
        reject(e);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async load(key: string): Promise<SerializedChunk | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const value = req.result as any;
        resolve(value ? (value.data as SerializedChunk) : null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async save(key: string, data: SerializedChunk): Promise<void> {
    data.version = CHUNK_SERIALIZATION_VERSION; // stamp version
    await this.withStore("readwrite", (store) => {
      store.put({ key, data });
    });
  }
  async delete(key: string) {
    await this.withStore("readwrite", (store) => store.delete(key));
  }
  async keys(): Promise<string[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  }
}
