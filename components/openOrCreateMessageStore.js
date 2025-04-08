export function openOrCreateMessageStore(receiverId) {
    return new Promise((resolve, reject) => {
      const dbRequest = indexedDB.open('PhantomDB');
  
      dbRequest.onupgradeneeded = function (event) {
        const db = event.target.result;
        const storeName = `messages_${receiverId}`;
  
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
          console.log(`📁 Object store '${storeName}' создан`);
        }
      };
  
      dbRequest.onsuccess = function (event) {
        const db = event.target.result;
  
        // Проверяем, есть ли нужный store
        const storeName = `messages_${receiverId}`;
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
  
          // Пересоздаем с onupgradeneeded
          const version = db.version + 1;
          const upgradeRequest = indexedDB.open('PhantomDB', version);
  
          upgradeRequest.onupgradeneeded = function (event) {
            const upgradedDb = event.target.result;
            if (!upgradedDb.objectStoreNames.contains(storeName)) {
              upgradedDb.createObjectStore(storeName, { keyPath: 'id' });
              console.log(`📁 Store '${storeName}' добавлен в upgrade`);
            }
          };
  
          upgradeRequest.onsuccess = function (event) {
            resolve(event.target.result);
          };
  
          upgradeRequest.onerror = function (event) {
            reject(event.target.error);
          };
        } else {
          resolve(db);
        }
      };
  
      dbRequest.onerror = function (event) {
        reject(event.target.error);
      };
    });
  }