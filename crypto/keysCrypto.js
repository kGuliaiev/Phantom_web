// crypto/keysCrypto.js

import { cryptoManager } from './CryptoManager';



 class KeyCryptoManager {
// Генерация ключевой пары для идентификации
// Использует ECDSA с кривой P-256
// Важно: этот код должен выполняться в контексте браузера, так как использует Web Crypto API

 async  generateIdentityKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,
    ["sign", "verify"]
  );

  const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

  console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] Сгенерирован IdentityKey: ${publicKeyBase64}`);

  return {
    publicKey: publicKeyBase64,
    privateKey: keyPair.privateKey
  };
}


// Шифрование   ключа с использованием AES-GCM
 async  encryptPrivateKey(keyData, credHash) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
  
    const keyMaterial = await cryptoManager.getKeyMaterial(credHash);
    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  
    const encoded = new TextEncoder().encode(keyData);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoded
    );
  
    return {
      cipher: this.arrayBufferToBase64(ciphertext),
      salt: this.arrayBufferToBase64(salt),
      iv: this.arrayBufferToBase64(iv),
    };
  }
  

  // Дешифрует зашифрованный ключ
   async  decryptPrivateKey({ cipher, salt, iv }, credHash) {
    const keyMaterial = await cryptoManager.getKeyMaterial(credHash);
    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.base64ToArrayBuffer(iv) },
      aesKey,
      this.base64ToArrayBuffer(cipher)
    );
  
    return new TextDecoder().decode(decrypted);
  }
  

  // Вспомогательные функции
  
  // Преобразует ArrayBuffer в Base64
   arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }
  
  // Преобразует Base64 в ArrayBuffer
   base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    [...binary].forEach((char, i) => (bytes[i] = char.charCodeAt(0)));
    return bytes.buffer;
  }
}

const keyCryptoInstance = new KeyCryptoManager();
export { keyCryptoInstance as KeyCryptoManager };