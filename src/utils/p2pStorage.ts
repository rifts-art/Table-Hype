/**
 * Memory-safe chunk storage for peer-to-peer file transfer.
 * Uses IndexedDB when available to prevent multi-gigabyte files from
 * crashing browser JavaScript heaps on mobile and low-spec systems.
 */

const DB_NAME = 'TableP2PStorage';
const DB_VERSION = 1;
const STORE_NAME = 'video_chunks';

export class P2PStorage {
  private db: IDBDatabase | null = null;
  private dbInitPromise: Promise<boolean> | null = null;
  private memoryChunks: ArrayBuffer[] = [];
  private useIndexedDB: boolean = false;
  private currentSessionId: string = '';

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<boolean> {
    if (this.dbInitPromise) return this.dbInitPromise;

    this.dbInitPromise = new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        this.useIndexedDB = false;
        resolve(false);
        return;
      }

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e: any) => {
          const db = e.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };

        request.onsuccess = (e: any) => {
          this.db = e.target.result;
          this.useIndexedDB = true;
          resolve(true);
        };

        request.onerror = () => {
          this.useIndexedDB = false;
          resolve(false);
        };
      } catch {
        this.useIndexedDB = false;
        resolve(false);
      }
    });

    return this.dbInitPromise;
  }

  public async startSession(sessionId: string, expectedSize: number): Promise<void> {
    await this.initDB();
    this.currentSessionId = sessionId;
    this.memoryChunks = [];

    // If expected size > 250MB and IndexedDB is supported, strictly prefer IndexedDB to save RAM
    if (this.useIndexedDB && this.db) {
      await this.clearSession(sessionId);
    }
  }

  public async appendChunk(chunkIndex: number, chunk: ArrayBuffer): Promise<void> {
    if (this.useIndexedDB && this.db && this.currentSessionId) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put({
            id: `${this.currentSessionId}_${chunkIndex}`,
            sessionId: this.currentSessionId,
            chunkIndex,
            data: chunk
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        return;
      } catch (err) {
        console.warn('IndexedDB write failed, falling back to in-memory buffers:', err);
      }
    }

    // Fallback: in-memory chunks
    this.memoryChunks.push(chunk);
  }

  public async assembleBlob(mimeType: string, totalChunks?: number): Promise<Blob> {
    if (this.useIndexedDB && this.db && this.currentSessionId) {
      try {
        const chunks: ArrayBuffer[] = [];
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const request = store.openCursor();

          request.onsuccess = (e: any) => {
            const cursor = e.target.result;
            if (cursor) {
              if (cursor.value.sessionId === this.currentSessionId) {
                chunks.push(cursor.value.data);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => reject(tx.error);
        });

        if (chunks.length > 0) {
          return new Blob(chunks, { type: mimeType || 'video/mp4' });
        }
      } catch (err) {
        console.warn('IndexedDB blob assembly failed, falling back to memory:', err);
      }
    }

    const blob = new Blob(this.memoryChunks, { type: mimeType || 'video/mp4' });
    this.memoryChunks = [];
    return blob;
  }

  public async clearSession(sessionId?: string): Promise<void> {
    this.memoryChunks = [];
    const targetSession = sessionId || this.currentSessionId;
    if (this.useIndexedDB && this.db && targetSession) {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.openCursor();

        request.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value.sessionId === targetSession) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
      } catch (err) {
        console.warn('Error clearing IndexedDB session:', err);
      }
    }
  }
}

export const p2pStorage = new P2PStorage();
