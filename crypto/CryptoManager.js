import { KeyCryptoManager } from './keysCrypto';

class CryptoManager {
  _log(message) {
    const now = new Date().toISOString();
    //console.log(`[CryptoManager][${now}] ${message}`);
  }
  
  // вне класса
  arrayBufferToPEM(buffer, label) {
  const base64 = window.btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const formatted = base64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${label}-----\n${formatted}\n-----END ${label}-----`;
}

  async decryptDataFromKeyStorage({ encrypted, iv }) {
    try {
      const passwordHash = localStorage.getItem('credHash');
      if (!passwordHash) throw new Error("Хэш пароля не найден");
  
      const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passwordHash),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );
  
      const key = await window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: new Uint8Array(16),
          iterations: 100000,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
  
      if (!(iv instanceof Uint8Array)) {
        this._log(`⚠️ Преобразуем iv в Uint8Array`);
        iv = new Uint8Array(iv);
      }
      if (!(encrypted instanceof Uint8Array)) {
        this._log(`⚠️ Преобразуем encrypted в Uint8Array`);
        encrypted = new Uint8Array(encrypted);
      }
      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encrypted
      );
  
      return decrypted;
    } catch (error) {
      this._log(`❌ Ошибка decryptDataFromKeyStorage: ${error.message}`);
      throw error;
    }
  }
  
  async deriveAESKey(importedKey) {
    try {
    let storedKey = localStorage.getItem('identityPrivateKey');
    if (!storedKey) {
      throw new Error('Отсутствует сохранённый приватный ключ (identityPrivateKey)');
    }

    // Если ключ хранится в зашифрованном виде (JSON), расшифровываем его с использованием credHash
    let identityPrivateKeyPEM;
    try {
      const parsed = JSON.parse(storedKey);
      const credHash = localStorage.getItem('credHash');
      if (!credHash) {
        throw new Error('Хэш учетных данных (credHash) не найден');
      }
      identityPrivateKeyPEM = await KeyCryptoManager.decryptPrivateKey(parsed, credHash);
    } catch (e) {
      // Если не удалось распарсить JSON, предполагаем, что ключ уже в формате PEM
      identityPrivateKeyPEM = storedKey;
    }

    // Конвертируем PEM в ArrayBuffer
    const privateKeyBuffer = this.pemToArrayBuffer(identityPrivateKeyPEM);

    // Импортируем приватный ключ для алгоритма ECDH с корректными key usages
    const importedPrivateKey = await window.crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey']
    );

    // Вычисляем общий AES-ключ с параметрами AES-GCM
    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: importedKey
      },
      importedPrivateKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    this._log('✅ AES ключ успешно получен через deriveAESKey');
    return aesKey;
    } catch (err) {
      this._log(`❌ Ошибка deriveAESKey: ${err.message}`);
      throw err;
    }
  }
 
  async encryptMessage(plainText, receiverPublicKeyBase64) {
    try {
      if (!receiverPublicKeyBase64 || typeof receiverPublicKeyBase64 !== 'string' || receiverPublicKeyBase64.length < 50) {
        throw new Error("Недопустимый публичный ключ");
      }
      const importedKey = await this.importReceiverKey(receiverPublicKeyBase64);
      const aesKey = await this.deriveAESKey(importedKey);
  
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plainText);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encoded
      );
  
      const fullEncrypted = new Uint8Array(iv.length + encrypted.byteLength);
      fullEncrypted.set(iv, 0);
      fullEncrypted.set(new Uint8Array(encrypted), iv.length);
  
      return btoa(String.fromCharCode(...fullEncrypted));
    } catch (err) {
      this._log(`❌ Ошибка encryptMessage: ${err.message}`);
      throw err;
    }
  }

  async importReceiverKey(base64Key) {
    try {
      if (!base64Key || typeof base64Key !== 'string' || base64Key.length < 50) {
        console.log(`[CryptoManager] ❌ Публичный ключ некорректен или не base64`);
        throw new Error("Публичный ключ некорректен или не base64");
      }
      const isBase64 = (str) => {
        try {
          return btoa(atob(str)) === str;
        } catch (e) {
          return false;
        }
      };
      
      // Предотвращаем импорт собственного публичного ключа
      const ownPublicKey = localStorage.getItem('identityPublicKey');
      if (ownPublicKey && ownPublicKey === base64Key) {
        throw new Error("Нельзя импортировать собственный публичный ключ");
      }
  
      const binary = atob(base64Key);
      this._log(`📦 Импортируемый публичный ключ: ${base64Key}`);
      const raw = Uint8Array.from(binary, c => c.charCodeAt(0));
  
      const importedKey = await window.crypto.subtle.importKey(
        'spki',
        raw,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [] // Публичный ключ не используется напрямую для криптографических операций
      );

      this._log(`✅ Ключ успешно импортирован для deriveKey`);
      this._log(`🔑 Публичный ключ успешно импортирован`);
      return importedKey;
    } catch (error) {
      this._log(`❌ Ошибка importReceiverKey: ${error.message}`);
      throw error;
    }
  }
  
  async getKeyMaterial(password) {
    const enc = new TextEncoder();
    return await window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );
  }
  
  async encryptData(plainText, passwordHash) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(plainText);
     // const passwordHash = localStorage.getItem('credHash');
      if (!passwordHash) throw new Error("Хэш пароля не найден");

      const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passwordHash),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );

      const key = await window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: new Uint8Array(16),
          iterations: 100000,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
      );

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        data
      );

      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv, 0);
      result.set(new Uint8Array(encrypted), iv.length);

      return btoa(String.fromCharCode(...result));
    } catch (error) {
      this._log(`❌ Ошибка encryptData: ${error.message}`);
      throw error;
    }
  }

  async decryptData(cipherTextBase64) {
    try {
      const encryptedData = Uint8Array.from(atob(cipherTextBase64), c => c.charCodeAt(0));
      const iv = encryptedData.slice(0, 12);
      const encrypted = encryptedData.slice(12);

      const passwordHash = localStorage.getItem('credHash');
      if (!passwordHash) throw new Error("Хэш пароля не найден");

      const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passwordHash),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );

      const key = await window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: new Uint8Array(16),
          iterations: 100000,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["decrypt"]
      );

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encrypted
      );

      //console.log('🔓 Расшифрованное сообщение:', decrypted);
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      this._log(`❌ Ошибка decryptData: ${error.message}`);
      throw error;
    }
  }

  async generateSharedKeyIfNeeded(contactId, receiverPublicKey) {
    const importedKey = await this.importReceiverKey(receiverPublicKey);
    await this.deriveAESKey(importedKey);
  }

  async decryptMessage(encryptedBase64, receiverPublicKeyBase64) {
    try {
      // const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const sanitized = encryptedBase64.replace(/\s/g, '');
    const encryptedData = Uint8Array.from(atob(sanitized), c => c.charCodeAt(0));

      // Ensure iv and encrypted are extracted only once to avoid duplication
      let iv = encryptedData.slice(0, 12);
      let encrypted = encryptedData.slice(12);

      const publicKey = receiverPublicKeyBase64 || localStorage.getItem('lastPublicKey');
      if (!publicKey) {
        throw new Error('Публичный ключ получателя не найден');
      }

      const importedKey = await this.importReceiverKey(publicKey);
      const aesKey = await this.deriveAESKey(importedKey);

      if (!(iv instanceof Uint8Array)) {
        this._log(`⚠️ Преобразуем iv в Uint8Array`);
        iv = new Uint8Array(iv);
      }
      if (!(encrypted instanceof Uint8Array)) {
        this._log(`⚠️ Преобразуем encrypted в Uint8Array`);
        encrypted = new Uint8Array(encrypted);
      }
      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      this._log(`❌ Ошибка decryptMessage: ${error.message}`);
      throw error;
    }
  }
//НЕ УДАЛЯТЬ
  async deriveCredentialsHash(username, password) {
    const data = new TextEncoder().encode(`${username}:${password}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  //НЕ УДАЛЯТЬ
  async hashPassword(password) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // логирование события
      const logEntry = `[${new Date().toISOString()}] [CryptoManager.js] [hashPassword] IP: client-browser, HASH_OK\n`;
      await this.appendLog(logEntry);

      return hashHex;
    } catch (error) {
      const logEntry = `[${new Date().toISOString()}] [CryptoManager.js] [hashPassword] IP: client-browser, ERROR: ${error.message}\n`;
      await this.appendLog(logEntry);
      throw error;
    }
  }

  async appendLog(entry) {
    try {
      const existing = localStorage.getItem('phantom_log') || '';
      const updated = existing + entry;
      localStorage.setItem('phantom_log', updated);
    } catch (e) {
      console.error('Ошибка логирования:', e);
    }
  }
  //НЕ УДАЛЯТЬ
  async generateSignedPreKey(identityPrivateKey) {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );
 
    const now = Date.now();
    const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
 
    const dataToSign = new TextEncoder().encode(publicKeyBase64);
    const signatureBuffer = await window.crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      identityPrivateKey,
      dataToSign
    );
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
 
    console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] Сгенерирован SignedPreKey: ${publicKeyBase64}`);
 
    return {
      keyId: `${now}`,
      createdAt: now,
      publicKey: publicKeyBase64,
      privateKey: keyPair.privateKey,
      signature: signatureBase64
    };
  }

//НЕ УДАЛЯТЬ
  async generateIdentityKeyPair() {
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
 
    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyPEM = this.arrayBufferToPEM(privateKeyBuffer, "PRIVATE KEY");
 
    // Сохраняем приватный и публичный ключи в localStorage для дальнейшего использования
    localStorage.setItem("identityPrivateKey", privateKeyPEM);
    localStorage.setItem("identityPublicKey", publicKeyBase64);
 
    console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] Сгенерирован IdentityKey: ${publicKeyBase64}`);
 
    return {
      publicKey: publicKeyBase64,
      privateKey: keyPair.privateKey
    };
  }

//НЕ УДАЛЯТЬ
  async generateOneTimePreKeys(count = 5) {
    const keys = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        true,
        ['deriveKey']
      );

      const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
      const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

      console.log(`[LOG] [${new Date().toISOString()}] [IP: unknown] Сгенерирован OTPK ${i}: ${publicKeyBase64}`);

      keys.push({
        keyId: `${now}-${i}`,
        createdAt: now,
        publicKey: publicKeyBase64
        //privateKey: keyPair.privateKey
      });
    }

    return keys;
  }

  // async getKeyMaterial(password) {
  //   const enc = new TextEncoder();
  //   return await window.crypto.subtle.importKey(
  //     "raw",
  //     enc.encode(password),
  //     { name: "PBKDF2" },
  //     false,
  //     ["deriveBits", "deriveKey"]
  //   );
  // }

  pemToArrayBuffer(pem) {
    // Удаляем заголовки, футер и все пробельные символы, чтобы получить чистую Base64 строку
    const base64String = pem
      .replace(/-----BEGIN [^-]+-----/, '')
      .replace(/-----END [^-]+-----/, '')
      .replace(/\s+/g, '');
    try {
      const binaryString = atob(base64String);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      throw new Error('Неверно закодированная PEM-строка: ' + error.message);
    }
  }


  
    //НЕ УДАЛЯТЬ
  async encryptPrivateKey(privateKey, credHash) {
    privateKey = this.pemToArrayBuffer(privateKey);
    if (!(privateKey instanceof CryptoKey)) {
      console.warn("🔁 Конвертация privateKey из JWK...");
      privateKey = await window.crypto.subtle.importKey(
          "jwk",
          privateKey,
          {
              name: "ECDSA",
              namedCurve: "P-256",
          },
          true,
          ["sign"]
      );
  }
    
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(credHash),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const key = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new Uint8Array(16),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

   
    const exportedKey = await window.crypto.subtle.exportKey('pkcs8', privateKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      exportedKey
    );

    return {
      encrypted: new Uint8Array(encrypted),
      iv: new Uint8Array(iv)
    };
  }
}

export const cryptoManager = new CryptoManager();




function logCryptoEvent(message, req = null, error = null) {
  const timestamp = new Date().toISOString();
  const ip = req ? getClientIp(req) : 'unknown_ip';
  const logMessage = `[${timestamp}] IP: ${ip} | ${message}${error ? ` | ERROR: ${error.message}` : ''}\n`;

  const logPath = path.join(__dirname, 'logs', 'crypto.log');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, logMessage);
}

// export function getKeyMaterial(password) {
//   const enc = new TextEncoder();
//   return window.crypto.subtle.importKey(
//     "raw",
//     enc.encode(password),
//     "PBKDF2",
//     false,
//     ["deriveBits", "deriveKey"]
//   );
// }
