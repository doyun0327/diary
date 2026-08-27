/** 일기 그림·캔버스 레이어는 localStorage 용량을 넘기기 쉬워 IndexedDB에 보관 */

const DB_NAME = 'picture-diary-images-v1';
const STORE = 'images';
const DB_VERSION = 1;

type ImageRecord = { id: string; dataUrl: string };

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

function canvasKey(entryId: string) {
  return `${entryId}__canvas`;
}

export async function putDiaryImage(entryId: string, dataUrl: string): Promise<void> {
  if (!entryId || !dataUrl) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await idbReq(tx.objectStore(STORE).put({ id: entryId, dataUrl } satisfies ImageRecord));
  } finally {
    db.close();
  }
}

export async function getDiaryImage(entryId: string): Promise<string | undefined> {
  if (!entryId) return undefined;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const row = await idbReq<ImageRecord | undefined>(
      tx.objectStore(STORE).get(entryId),
    );
    return row?.dataUrl || undefined;
  } finally {
    db.close();
  }
}

export async function putDiaryCanvasJson(
  entryId: string,
  json: string,
): Promise<void> {
  if (!entryId || !json) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await idbReq(
      tx.objectStore(STORE).put({ id: canvasKey(entryId), dataUrl: json }),
    );
  } finally {
    db.close();
  }
}

export async function getDiaryCanvasJson(
  entryId: string,
): Promise<string | undefined> {
  if (!entryId) return undefined;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const row = await idbReq<ImageRecord | undefined>(
      tx.objectStore(STORE).get(canvasKey(entryId)),
    );
    return row?.dataUrl || undefined;
  } finally {
    db.close();
  }
}

export async function deleteDiaryCanvasJson(entryId: string): Promise<void> {
  if (!entryId) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await idbReq(tx.objectStore(STORE).delete(canvasKey(entryId)));
  } finally {
    db.close();
  }
}

export async function deleteDiaryImage(entryId: string): Promise<void> {
  if (!entryId) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await idbReq(tx.objectStore(STORE).delete(entryId));
    await idbReq(tx.objectStore(STORE).delete(canvasKey(entryId)));
  } finally {
    db.close();
  }
}

export async function clearDiaryImages(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await idbReq(tx.objectStore(STORE).clear());
  } finally {
    db.close();
  }
}

export function isEmbeddedDataUrl(src: string | undefined | null): boolean {
  return Boolean(src?.startsWith('data:'));
}
