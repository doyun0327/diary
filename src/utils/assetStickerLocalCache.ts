/**
 * 일러스트(/stikers) 스티커 — 탭에 한 번 들어오면 IndexedDB에 받아 두고
 * 이후에는 blob URL로 로컬 표시·배치.
 */
import {
  ASSET_STICKER_SRCS,
  isAssetStickerSrc,
  toAssetStickerUrl,
} from './assetStickers';

const DB_NAME = 'pageby-asset-stickers-v1';
const STORE = 'blobs';
const DB_VERSION = 1;
/** 목록이 바뀌면 캐시 무효화 */
const MANIFEST_KEY = `v1:${ASSET_STICKER_SRCS.length}:${ASSET_STICKER_SRCS[0]}:${ASSET_STICKER_SRCS[ASSET_STICKER_SRCS.length - 1]}`;
const META_ID = '__manifest__';

type BlobRecord = { id: string; blob: Blob };
type MetaRecord = { id: string; manifest: string };

const memoryUrls = new Map<string, string>();
const listeners = new Set<() => void>();
let warming: Promise<void> | null = null;
let hydrated = false;

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

export function subscribeAssetStickerLocalCache(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** 동기: 메모리에 있으면 blob URL, 없으면 네트워크 경로 */
export function resolveAssetStickerSrc(src: string): string {
  if (!isAssetStickerSrc(src)) return src;
  return memoryUrls.get(src) ?? toAssetStickerUrl(src);
}

export function isAssetStickerLocallyReady(src: string): boolean {
  return isAssetStickerSrc(src) && memoryUrls.has(src);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB tx aborted'));
  });
}

function rememberBlob(path: string, blob: Blob) {
  const prev = memoryUrls.get(path);
  if (prev) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      // ignore
    }
  }
  memoryUrls.set(path, URL.createObjectURL(blob));
}

async function hydrateFromIdb(): Promise<void> {
  if (hydrated) return;
  if (typeof indexedDB === 'undefined') {
    hydrated = true;
    return;
  }
  try {
    const db = await openDb();
    try {
      const readTx = db.transaction(STORE, 'readonly');
      const store = readTx.objectStore(STORE);
      const metaReq = store.get(META_ID);
      const allReq = store.getAll();
      const [meta, all] = await Promise.all([
        idbReq(metaReq) as Promise<MetaRecord | undefined>,
        idbReq(allReq) as Promise<Array<BlobRecord | MetaRecord>>,
        txDone(readTx),
      ]);

      if (meta?.manifest && meta.manifest !== MANIFEST_KEY) {
        const clearTx = db.transaction(STORE, 'readwrite');
        clearTx.objectStore(STORE).clear();
        await txDone(clearTx);
        hydrated = true;
        return;
      }

      for (const row of all) {
        if (!row || row.id === META_ID) continue;
        if ('blob' in row && row.blob instanceof Blob) {
          rememberBlob(row.id, row.blob);
        }
      }
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn('[stickers] local hydrate failed', err);
  }
  hydrated = true;
}

async function putBlob(path: string, blob: Blob): Promise<void> {
  rememberBlob(path, blob);
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put({ id: path, blob } satisfies BlobRecord);
      store.put({ id: META_ID, manifest: MANIFEST_KEY } satisfies MetaRecord);
      await txDone(tx);
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn('[stickers] local put failed', path, err);
  }
}

async function fetchAndStore(path: string): Promise<void> {
  if (memoryUrls.has(path)) return;
  const url = toAssetStickerUrl(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  await putBlob(path, blob);
}

/** 일러스트 탭 진입 시 호출 — 한 번 받아 IndexedDB + 메모리에 보관 */
export function warmAssetStickerLocalCache(): Promise<void> {
  if (warming) return warming;
  warming = (async () => {
    await hydrateFromIdb();
    notify();

    const missing = ASSET_STICKER_SRCS.filter((src) => !memoryUrls.has(src));
    if (missing.length === 0) return;

    const CONCURRENCY = 6;
    let cursor = 0;
    let changed = false;

    const worker = async () => {
      while (cursor < missing.length) {
        const i = cursor;
        cursor += 1;
        const path = missing[i];
        try {
          await fetchAndStore(path);
          changed = true;
          if (i % 8 === 0) notify();
        } catch (err) {
          console.warn('[stickers] warm failed', path, err);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, missing.length) }, () => worker()),
    );
    if (changed) notify();
  })().finally(() => {
    warming = null;
  });
  return warming;
}
