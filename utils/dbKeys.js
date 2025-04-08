// utils/dbKeys.js
const DB_NAME = 'PhantomDB';
const DB_VERSION = 2;
const STORE_NAME = 'keys';

class KeyDBManager {

  async getDB() {
    if (!this.db) {
      this.db = await this.openDB();
    }
    return this.db;
  }

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'keyName' });
        }
      };

      request.onsuccess = () => {
        console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] Открыта база данных ${DB_NAME}`);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`[ERROR] [${new Date().toISOString()}] [IP: unknown] Ошибка открытия БД: ${request.error}`);
        reject(request.error);
      };
    });
  }


// ✅ Сохраняет набор ключей (по отдельности)
  async saveEncryptedKey(keyName, encryptedKey) {
  console.log("saveEncryptedKey ▶️", keyName);
  try {
    const db = await this.getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const entry = { keyName, ...encryptedKey }; // ключ и содержимое

    const request = store.put(entry);
    request.onsuccess = () => {
      console.log(`📥 Ключ '${keyName}' успешно записан в хранилище`);
    };

    request.onerror = (e) => {
      console.error(`❌ Ошибка при сохранении ключа '${keyName}':`, e.target.error);
    };
  } catch (error) {
    console.error("❌ Ошибка saveEncryptedKey (catch):", error);
    throw error;
  }
}

// ✅ Загружает отдельный зашифрованный ключ по его имени
async loadEncryptedKey(keyName) {
  return new Promise(async (resolve, reject) => {
    const db = await this.getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(keyName);

    request.onsuccess = () => {
      const result = request.result;
      if (!result) return resolve(null);

      try {
        resolve({
          iv: new Uint8Array(result.iv),
          encrypted: new Uint8Array(result.encrypted)
        });
      } catch (err) {
        console.error(`❌ Ошибка при парсинге ключа '${keyName}':`, err);
        reject(err);
      }
    };

    request.onerror = (event) => {
      console.error(`❌ Ошибка при получении ключа '${keyName}':`, event.target.error);
      reject(event.target.error);
    };
  });
}

// 🗑️ Удаляет все сохранённые ключи
 async  deleteAllEncryptedKeys() {
  try {
    const db = await this.getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.objectStore(STORE_NAME).clear();
    console.log('🗑️ Все зашифрованные ключи удалены');
  } catch (error) {
    console.error('❌ Ошибка удаления зашифрованных ключей:', error);
  }
}

}

const keyDBInstance = new KeyDBManager();
export { keyDBInstance as KeyDBManager };
export const saveEncryptedKey = keyDBInstance.saveEncryptedKey.bind(keyDBInstance);
export const loadEncryptedKey = keyDBInstance.loadEncryptedKey.bind(keyDBInstance);
export const saveKeyToIndexedDB = keyDBInstance.saveEncryptedKey.bind(keyDBInstance);


  // async saveKeyToIndexedDB(keyName, encryptedKeyObject) {
  //   const db = await this.openDB();
  //   return new Promise((resolve, reject) => {
  //     const tx = db.transaction(STORE_NAME, 'readwrite');
  //     const store = tx.objectStore(STORE_NAME);
  //     const request = store.put({ keyName, data: encryptedKeyObject });

  //     request.onsuccess = () => {
  //       console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] Ключ '${keyName}' сохранён в IndexedDB`);
  //       resolve(true);
  //     };

  //     request.onerror = () => {
  //       console.error(`[ERROR] [${new Date().toISOString()}] [IP: unknown] Ошибка при сохранении ключа '${keyName}': ${request.error}`);
  //       reject(request.error);
  //     };
  //   });
  // }

  // async getKeyFromIndexedDB(keyName) {
  //   const db = await this.openDB();
  //   return new Promise((resolve, reject) => {
  //     const tx = db.transaction(STORE_NAME, 'readonly');
  //     const store = tx.objectStore(STORE_NAME);
  //     const request = store.get(keyName);

  //     request.onsuccess = () => {
  //       if (request.result) {
  //         console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] Ключ '${keyName}' успешно извлечён из IndexedDB`);
  //         resolve(request.result.data);
  //       } else {
  //         console.warn(`[WARN] [${new Date().toISOString()}] [IP: unknown] Ключ '${keyName}' не найден`);
  //         reject(new Error('Key not found'));
  //       }
  //     };

  //     request.onerror = () => {
  //       console.error(`[ERROR] [${new Date().toISOString()}] [IP: unknown] Ошибка при извлечении ключа '${keyName}': ${request.error}`);
  //       reject(request.error);
  //     };
  //   });
  // }