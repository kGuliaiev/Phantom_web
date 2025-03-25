// CryptoManager.js (обновлённая версия с генерацией реальных ключей и логированием)
import { saveEncryptedKey, loadEncryptedKey } from './KeyStorageManager';

export class CryptoManager {
  async generateIdentityKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );
  
    const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKey)));
    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
  
    this._log('✅ Сгенерирована identityKey пара (ECDSA)');
  
    return {
      publicKey: publicKeyBase64,
      privateKey: JSON.stringify(privateKeyJwk)
    };
  }

  async generateSignedPreKey(identityPrivateKeyJwk) {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );

    const publicKeySpki = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeySpki)));
    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

    const identityPrivateKey = await window.crypto.subtle.importKey(
      'jwk',
      JSON.parse(identityPrivateKeyJwk),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await window.crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      identityPrivateKey,
      publicKeySpki
    );
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    this._log('✅ Сгенерирован signedPreKey и подписан identityPrivateKey');

    return {
      keyId: Math.floor(Math.random() * 1e6),
      publicKey: publicKeyBase64,
      privateKey: JSON.stringify(privateKeyJwk),
      signature: signatureBase64,
      createdAt: Date.now()
    };
  }

  async generateOneTimePreKeys(count = 10) {
    const preKeys = [];

    for (let i = 0; i < count; i++) {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveBits', 'deriveKey']
      );

      const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
      const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKey)));
      const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

      preKeys.push({
        keyId: Math.floor(Math.random() * 1e6),
        publicKey: publicKeyBase64,
        privateKey: JSON.stringify(privateKeyJwk),
        createdAt: Date.now()
      });
    }

    this._log(`✅ Сгенерировано ${count} одноразовых preKeys`);

    return preKeys;
  }

  async importReceiverKey(base64Key) {
    try {
      const binary = atob(base64Key);
      const raw = Uint8Array.from(binary, c => c.charCodeAt(0));
      return await window.crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
      );
    } catch (error) {
      this._log(`❌ Ошибка importReceiverKey: ${error}`);
      throw error;
    }
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

  async decryptMessage(base64String) {
    const isBase64 = (str) => {
      try {
        return btoa(atob(str)) === str;
      } catch (err) {
        return false;
      }
    };
    const encrypted = isBase64(base64String) ? atob(base64String) : base64String;
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

  async encryptPrivateKey(jwkPrivateKey, passwordHash) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveAESKeyFromHash(passwordHash);
    const encoded = new TextEncoder().encode(jwkPrivateKey);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    return { encrypted: Array.from(new Uint8Array(encrypted)), iv: Array.from(iv) };
  }

  async decryptPrivateKey(payload, passwordHash) {
    const key = await this.deriveAESKeyFromHash(passwordHash);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(payload.iv) },
      key,
      new Uint8Array(payload.encrypted)
    );
    return new TextDecoder().decode(decrypted);
  }

  async deriveAESKeyFromHash(base64Hash) {
    const raw = Uint8Array.from(atob(base64Hash), c => c.charCodeAt(0));
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', raw, { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(16),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async storePrivateKey(jwkPrivateKey, hashPassword) {
    const encryptedPayload = await this.encryptPrivateKey(jwkPrivateKey, hashPassword);
    await saveEncryptedKey(encryptedPayload, hashPassword);
  }

  async loadPrivateKey(hashPassword) {
    const encrypted = await loadEncryptedKey(hashPassword);
    if (!encrypted) return null;
    return await this.decryptPrivateKey(encrypted, hashPassword);
  }

  _log(message) {
    const now = new Date().toISOString();
    const ip = 'n/a'; // можно вставить IP из WebRTC или сервера при расширении
    console.log(`[${now}] [CryptoManager] [IP: ${ip}] ${message}`);
  }
}
export async function clearAll() {
  try {
    localStorage.clear();
    if ('indexedDB' in window) {
      const req = window.indexedDB.deleteDatabase('phantom_keys');
      req.onsuccess = () => console.log('✅ IndexedDB очищен');
      req.onerror = () => console.error('❌ Ошибка удаления IndexedDB');
    }
  } catch (err) {
    console.error('❌ Ошибка при очистке всех данных:', err);
  }
}