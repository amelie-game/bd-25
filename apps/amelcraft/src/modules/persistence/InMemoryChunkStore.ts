import {
  CHUNK_SERIALIZATION_VERSION,
  IChunkStore,
  SerializedChunk,
} from "./IChunkStore";

export class InMemoryChunkStore implements IChunkStore {
  private store = new Map<string, SerializedChunk>();

  async load(key: string): Promise<SerializedChunk | null> {
    return this.store.get(key) ?? null;
  }
  async save(key: string, data: SerializedChunk): Promise<void> {
    // Ensure version is stamped
    data.version = CHUNK_SERIALIZATION_VERSION;
    this.store.set(key, { ...data });
  }
  async delete(key: string) {
    this.store.delete(key);
  }
  async keys() {
    return Array.from(this.store.keys());
  }
}
