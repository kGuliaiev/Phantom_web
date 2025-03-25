import React, { useEffect, useState } from 'react';
import { CryptoManager } from '../src/crypto/CryptoManager';

const RegisterFinalizeStep = ({ identifier, username, password, onSuccess }) => {
  const [status, setStatus] = useState('⏳ Генерация ключей...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const register = async () => {
      try {
        const crypto = new CryptoManager();
        const identityKeyPair = await crypto.generateIdentityKeyPair();
        const signedPreKey = await crypto.generateSignedPreKey(identityKeyPair.privateKey);
        const oneTimePreKeys = await crypto.generateOneTimePreKeys(5);
        const hashedPassword = await crypto.hashPassword(password);

        const payload = {
          username,
          password: hashedPassword,
          identifier,
          publicKey: identityKeyPair.publicKey,
          identityKey: identityKeyPair.publicKey,
          signedPreKey,
          oneTimePreKeys
        };

        setStatus('📡 Отправка данных на сервер...');
        const res = await fetch('http://localhost:5001/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Ошибка регистрации');

        setStatus('🔐 Сохранение приватного ключа...');
        await crypto.storePrivateKey(identityKeyPair.privateKey, hashedPassword);
        localStorage.setItem('phantom_username', username);

        setStatus('✅ Успешно! Переход к чатам...');
        onSuccess();
      } catch (err) {
        console.error('Ошибка регистрации:', err);
        setError(err.message);
        setStatus(null);
      }
    };

    register();
  }, []);

  return (
    <div>
      <h2>Завершение регистрации</h2>
      {status && <p>{status}</p>}
      {error && <p style={{ color: 'red' }}>❌ {error}</p>}
    </div>
  );
};

export default RegisterFinalizeStep;