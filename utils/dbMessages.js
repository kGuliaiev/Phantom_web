//   utils/dbMessages.js
import { DB_NAME, DB_VERSION, STORE_KEYS,  STORE_MESSAGES, STORE_HISTORY } from '../src/config.js';



export function openDB() {
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
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        console.warn(`❌ Object store "${STORE_MESSAGES}" не найден в IndexedDB. Возможно, база повреждена или версия DB устарела.`);
        db.close();
        indexedDB.deleteDatabase(DB_NAME); // Сброс базы
        location.reload(); // Перезагрузка страницы для повторной инициализации
        return;
      }
      resolve(db);
    };

    request.onerror = () => {
      console.error('Ошибка открытия базы данных IndexedDB');
      reject(request.error);
    };
  });
}




export async function saveMessage(message) {
  try {
    const db = await openDB(DB_NAME);
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    store.put(message);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    console.log('💾 Сообщение сохранено локально:', message);
  } catch (error) {
    console.error('Ошибка при сохранении сообщения:', error);
  }
}



export async function getMessagesByReceiverId(receiverId, userId = localStorage.getItem('identifier')) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, 'readonly');
    const store = tx.objectStore(STORE_MESSAGES);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const allMessages = request.result;
        const currentUser = userId;
        const filtered = allMessages.filter(m =>
          (m.receiverId === receiverId) || (m.senderId === receiverId)
        );
        //console.log('🔍 Все записи из IndexedDB:', allMessages);
        //console.log(`🔍 Отфильтрованные сообщения для receiverId=${receiverId}, userId=${currentUser}:`, filtered);
        resolve(filtered);
      };
      request.onerror = (event) => {
        console.error('❌ Ошибка при чтении всех сообщений:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Ошибка при получении сообщений:', error);
    return [];
  }
}


export async function deleteMessageById(messageId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    store.delete(messageId);
    await tx.complete;
    console.log(`Сообщение с id=${messageId} удалено`);
  } catch (error) {
    console.error('Ошибка при удалении сообщения:', error);
  }
}

export async function clearAllStatusHistory() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    const store = tx.objectStore(STORE_HISTORY);
    store.clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    console.log('🗑 История статусов очищена из локальной БД');
  } catch (error) {
    console.error('Ошибка при очистке истории статусов:', error);
  }
}

export async function clearAllMessages() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    store.clear();
    await tx.complete;
    console.log('Все сообщения удалены из локальной базы данных');
  } catch (error) {
    console.error('Ошибка при очистке сообщений:', error);
  }
}

// dbMessages.js

export async function clearAllMessagesForContact(currentId, contactId) {
  const db = await openDB();
  const tx = db.transaction(STORE_MESSAGES, 'readwrite');
  const store = tx.objectStore(STORE_MESSAGES);

  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = async () => {
      const allMessages = request.result;
      // Фильтруем только те сообщения, где:
      //   (senderId == currentId && receiverId == contactId)
      //   или (senderId == contactId && receiverId == currentId).
      const toDelete = allMessages.filter(
        m =>
          (m.senderId   === currentId && m.receiverId === contactId) ||
          (m.senderId   === contactId && m.receiverId === currentId)
      );

      for (const msg of toDelete) {
        store.delete(msg.id);
      }

      await tx.complete;
      console.log(`Локально удалено ${toDelete.length} сообщений между ${currentId} и ${contactId}`);
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// /**
//  * Сохраняет запись об изменении статуса сообщения.
//  * @param {{messageId: string, status: string, updatedAt: string}} entry
//  */


export async function saveStatusHistory({ messageId, status, updatedAt }) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    const store = tx.objectStore(STORE_HISTORY);
    store.add({ messageId, status, updatedAt });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    console.log(`История статуса сохранена: ${messageId} → ${status} @ ${updatedAt}`);
  } catch (error) {
    console.error('Ошибка при сохранении истории статусов:', error);
  }
}

// /**
//  * Обновляет поле status и statusUpdatedAt в объекте сообщения.
//  * @param {string} messageId
//  * @param {string} newStatus
//  * @param {string} updatedAt ISO timestamp
//  */

export async function updateMessageStatusRecord(messageId, newStatus, updatedAt) {
  const db  = await openDB();
  const tx  = db.transaction(STORE_MESSAGES, 'readwrite');
  const store = tx.objectStore(STORE_MESSAGES);
  const getReq = store.get(messageId);

  getReq.onsuccess = () => {
    const record = getReq.result;
    if (record) {
      record.status = newStatus;
      if (typeof updatedAt !== 'undefined') {
        record.statusUpdatedAt = updatedAt;
      }
      store.put(record);
    }
  };

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}
/**
 * Загружает историю статусов для заданного messageId.
 * @param {string} messageId
 * @returns {Promise<Array<{messageId: string, status: string, updatedAt: string}>>}
 */
export async function getStatusHistory(messageId) {
  const db = await openDB();
  const tx = db.transaction(STORE_HISTORY, 'readonly');
  const store = tx.objectStore(STORE_HISTORY);
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result.filter(entry => entry.messageId === messageId));
    };
    request.onerror = () => reject(request.error);
  });
}