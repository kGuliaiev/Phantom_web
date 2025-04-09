//   utils/dbMessages.js
const DB_NAME = 'PhantomDB';
const DB_VERSION = 2;
const STORE_NAME = 'messages';




export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Ошибка открытия базы данных IndexedDB');
      reject(request.error);
    };
  });
}




export async function saveMessage(message) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(message);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    console.log('Сообщение сохранено локально:', message);
  } catch (error) {
    console.error('Ошибка при сохранении сообщения:', error);
  }
}



export async function getMessagesByReceiverId(receiverId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const allMessages = request.result;
        const filtered = allMessages.filter(m => m.receiverId === receiverId || m.senderId === receiverId);
        resolve(filtered);
      };
      request.onerror = () => {
        reject(request.error);
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
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(messageId);
    await tx.complete;
    console.log(`Сообщение с id=${messageId} удалено`);
  } catch (error) {
    console.error('Ошибка при удалении сообщения:', error);
  }
}

export async function clearAllMessages() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    await tx.complete;
    console.log('Все сообщения удалены из локальной базы данных');
  } catch (error) {
    console.error('Ошибка при очистке сообщений:', error);
  }
}