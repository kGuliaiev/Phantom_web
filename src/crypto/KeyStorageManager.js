// Файл: src/crypto/KeyStorageManager.js
const DB_NAME = 'PhantomKeysDB';
const STORE_NAME = 'keys';

const getDB = () => new Promise((resolve, reject) => {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(STORE_NAME);
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});

export const saveEncryptedKey = async (encryptedKey, hashKey) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await store.put(encryptedKey, hashKey);
  await tx.complete;
  db.close();
};

export const loadEncryptedKey = async (hashKey) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const result = await new Promise((resolve, reject) => {
    const req = store.get(hashKey);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
};