// Файл: src/crypto/CryptoManager.js

export class CryptoManager {
  async generateIdentityKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256' // Можно заменить на 'X25519' в будущем через WebAssembly
      },
      true,
      ['deriveKey']
    );

    const publicKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

    return {
      publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
      privateKey: JSON.stringify(privateKey)
    };
  }

  async generateSignedPreKey(privateKeyJwk) {
    const text = new TextEncoder().encode('signed-prekey');
    const key = await window.crypto.subtle.importKey(
      'jwk',
      JSON.parse(privateKeyJwk),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey']
    );
    const derived = await window.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: await this.importReceiverKey(this.staticReceiverPublicKey())
      },
      key,
      256
    );
    return btoa(String.fromCharCode(...new Uint8Array(derived.slice(0, 32))));
  }

  async generateOneTimePreKeys(count = 10) {
    const preKeys = [];
    for (let i = 0; i < count; i++) {
      const { publicKey } = await this.generateIdentityKeyPair();
      preKeys.push(publicKey);
    }
    return preKeys;
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
    
    const isBase64 = (str) => {
      try {
          return btoa(atob(str)) === str;
      } catch (err) {
          return false;
      }
  };
  console.log("🔎 Base64 строка перед декодированием:", base64String);
  const binaryData = isBase64(base64String) ? atob(base64String) : base64String;
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

  staticReceiverPublicKey() {
    // Временно используемый публичный ключ для генерации signedPreKey
    // В реальном протоколе используется ключ сервера, замените как нужно
    return "BASE64_ENCODED_FAKE_SERVER_KEY==";
  }
}
