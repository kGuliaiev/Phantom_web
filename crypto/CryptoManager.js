// Файл: src/crypto/CryptoManager.js

export class CryptoManager {
    async generateKeys() {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveKey']
      );
  
      const privateKey = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
      const publicKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
  
      const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKey)));
      localStorage.setItem('privateKey', JSON.stringify(privateKey));
  
      return { publicKeyBase64, privateKey: JSON.stringify(privateKey) };
    }
  
    async importReceiverKey(base64Key) {
      const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
      return await window.crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
      );
    }
  
    async deriveAESKey(publicKey) {
      const privateKeyJwk = JSON.parse(localStorage.getItem('privateKey'));
      const privateKey = await window.crypto.subtle.importKey(
        'jwk',
        privateKeyJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey']
      );
  
      return await window.crypto.subtle.deriveKey(
        {
          name: 'ECDH',
          public: publicKey
        },
        privateKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    }
  
    async encryptMessage(publicKeyBase64, message) {
      const receiverKey = await this.importReceiverKey(publicKeyBase64);
      const aesKey = await this.deriveAESKey(receiverKey);
  
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(message);
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encoded
      );
  
      return btoa(String.fromCharCode(...iv) + String.fromCharCode(...new Uint8Array(ciphertext)));
    }
  
    async decryptMessage(encryptedBase64) {
      const encrypted = atob(encryptedBase64);
      const iv = new Uint8Array([...encrypted].slice(0, 12).map(c => c.charCodeAt(0)));
      const data = new Uint8Array([...encrypted].slice(12).map(c => c.charCodeAt(0)));
  
      const aesKey = await this.deriveAESKeyCache();
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        data
      );
  
      return new TextDecoder().decode(decrypted);
    }
  
    async deriveAESKeyCache() {
      const lastPublicKey = localStorage.getItem('lastPublicKey');
      if (!lastPublicKey) throw new Error('Нет публичного ключа собеседника');
      const imported = await this.importReceiverKey(lastPublicKey);
      return await this.deriveAESKey(imported);
    }
  
    async hashPassword(password) {
      const encoded = new TextEncoder().encode(password);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
      return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    }
  }