// crypto/keysCrypto.js

import { cryptoManager } from './CryptoManager';



 class KeyCryptoManager {
// Генерация ключевой пары для идентификации
// Использует ECDSA с кривой P-256
// Важно: этот код должен выполняться в контексте браузера, так как использует Web Crypto API

//  async  generateIdentityKeyPair() {
//   const keyPair = await window.crypto.subtle.generateKey(
//     {
//       name: "ECDSA",
//       namedCurve: "P-256"
//     },
//     true,
//     ["sign", "verify"]
//   );

//   const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
//   const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

//   console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] Сгенерирован IdentityKey: ${publicKeyBase64}`);

//   return {
//     publicKey: publicKeyBase64,
//     privateKey: keyPair.privateKey
//   };
// }


// Шифрование   ключа с использованием AES-GCM
 async encryptPrivateKey(keyData, credHash) {
    const salt  = crypto.getRandomValues(new Uint8Array(16));
    const iv    = crypto.getRandomValues(new Uint8Array(12));
  
    console.log(`[DEBUG] [${new Date().toISOString()}] [keysCrypto.js] Сгенерирована соль: ${this.arrayBufferToBase64(salt)} (byteLength: ${salt.byteLength})`);
    console.log(`[DEBUG] [${new Date().toISOString()}] [keysCrypto.js] Сгенерирован iv: ${this.arrayBufferToBase64(iv)} (byteLength: ${iv.byteLength})`);

    const keyMaterial = await cryptoManager.getKeyMaterial(credHash);
    const aesKey      = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 250000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  
    let dataToEncrypt;

    if (keyData instanceof CryptoKey) {
      // Экспортируем CryptoKey в формате pkcs8
      dataToEncrypt = await window.crypto.subtle.exportKey('pkcs8', keyData);
    } else {
      dataToEncrypt = new TextEncoder().encode(keyData);
    }
  
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      dataToEncrypt
    );
  
    // Логирование операции шифрования
    console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] [keysCrypto.js] Успешно зашифрованный ключ`);
   
    console.log(`[DEBUG] [${new Date().toISOString()}] [keysCrypto.js] Результат шифрования:`, {
      cipher: this.arrayBufferToBase64(ciphertext),
      salt: this.arrayBufferToBase64(salt),
      iv: this.arrayBufferToBase64(iv)
    });
  
    return {
      cipher: this.arrayBufferToBase64(ciphertext),
      salt:   this.arrayBufferToBase64(salt),
      iv:     this.arrayBufferToBase64(iv)
    };
  }
  

  // Дешифрует зашифрованный ключ
  async decryptPrivateKey({ cipher, salt, iv }, credHash) {
    try {
      // Декодирование Base64 в ArrayBuffer
      const effectiveSalt = salt ? this.base64ToArrayBuffer(salt) : new Uint8Array(16);
      const decodedIv     = this.base64ToArrayBuffer(iv);
      
      const keyMaterial   = await cryptoManager.getKeyMaterial(credHash);
      const aesKey        = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: effectiveSalt,
          iterations: 250000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
  
      const cipherBuffer = this.base64ToArrayBuffer(cipher);
  
      // Вывод отладочной информации перед расшифрованием
      //console.log(`[DEBUG] [${new Date().toISOString()}] [keysCrypto.js] cipherBuffer   byteLength: ${new Uint8Array(cipherBuffer).byteLength}`);
      // console.log(`[DEBUG] [${new Date().toISOString()}] [keysCrypto.js] decodedIv      byteLength: ${new Uint8Array(decodedIv).byteLength}`);
      // console.log(`[DEBUG] [${new Date().toISOString()}] [keysCrypto.js] effectiveSalt  byteLength: ${new Uint8Array(effectiveSalt).byteLength}`);
  
      // if (new Uint8Array(cipherBuffer).byteLength < 16) {
      //   throw new Error('Размер зашифрованных данных слишком мал');
      // }
  
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: decodedIv },
        aesKey,
        cipherBuffer
      );
  
      // const decryptedText = new TextDecoder().decode(decrypted);
      // console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] [keysCrypto.js] Успешно расшифрованный ключ`);
      // return decryptedText;

      // Преобразуем ArrayBuffer в Base64
      const decryptedBase64 = this.arrayBufferToBase64(decrypted);
      // Формируем PEM-формат с правильными заголовками и разбивкой строк по 64 символа
      const lines = decryptedBase64.match(/.{1,64}/g) || [];
      const pem = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
      console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] [keysCrypto.js] Успешно расшифрованный ключ в PEM`);
      return pem;

    } catch (error) {
      console.error(`[ERROR] [${new Date().toISOString()}] [IP: unknown] [keysCrypto.js] Ошибка расшифрования: ${error.message}`);
      throw error;
    }
  }
  

  // Вспомогательные функции
  // Преобразует ArrayBuffer в Base64
   arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }
  
  // Преобразует Base64 в ArrayBuffer
  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

const keyCryptoInstance = new KeyCryptoManager();
export { keyCryptoInstance as KeyCryptoManager };