// utils/dbKeys.js

import { DB_NAME, DB_VERSION, STORE_KEYS, STORE_MESSAGES, STORE_HISTORY} from '../src/config.js';

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
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_HISTORY)) {
          db.createObjectStore(STORE_HISTORY, { autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_KEYS)) {
          db.createObjectStore(STORE_KEYS, { keyPath: 'keyName' });
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

  // ✅ Загружает отдельный зашифрованный ключ по его имени
  async loadEncryptedKey(keyName) {
    return new Promise(async (resolve, reject) => {
      const db = await this.getDB();
      const tx = db.transaction(STORE_KEYS, 'readonly');
      const store = tx.objectStore(STORE_KEYS);
      const request = store.get(keyName);
      request.onsuccess = () => {
           const result = request.result;
           if (!result) return resolve(null);
           try {
             resolve({
               iv: result.iv, // iv сохранён как Base64-строка
               cipher: result.cipher ? result.cipher : (result.encrypted || ''),
               salt: result.salt || null
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

// ✅ Сохраняет набор ключей (по отдельности)
async saveEncryptedKey(keyName, encryptedKey) {
    
  try {
    const db = await this.getDB();
    const transaction = db.transaction(STORE_KEYS, 'readwrite');
    const store = transaction.objectStore(STORE_KEYS);

    const entry = { keyName, ...encryptedKey }; // ключ и содержимое

    const request = store.put(entry);
    request.onsuccess = () => {
      console.log(`📥 Ключ '${keyName}' успешно записан в хранилище - '${encryptedKey}'`);
      
    };

    request.onerror = (e) => {
      console.error(`❌ Ошибка при сохранении ключа '${keyName}':`, e.target.error);
    };
  } catch (error) {
      console.error("❌ Ошибка saveEncryptedKey (catch):", error);
      throw error;
  }
}



// 🗑️ Удаляет все сохранённые ключи
async  deleteAllEncryptedKeys() {
  try {
    const db = await this.getDB();
    const tx = db.transaction(STORE_KEYS, 'readwrite');
    await tx.objectStore(STORE_KEYS).clear();
    console.log('🗑️ Все зашифрованные ключи удалены');
  } catch (error) {
    console.error('❌ Ошибка удаления зашифрованных ключей:', error);
  }
}

}

const keyDBInstance = new KeyDBManager();
export { keyDBInstance as KeyDBManager };

export const saveEncryptedKey   = keyDBInstance.saveEncryptedKey.bind(keyDBInstance);
export const loadEncryptedKey   = keyDBInstance.loadEncryptedKey.bind(keyDBInstance);
export const saveKeyToIndexedDB = keyDBInstance.saveEncryptedKey.bind(keyDBInstance);