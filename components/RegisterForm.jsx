// Файл: src/components/RegisterForm.jsx
import React, { useState } from 'react';
import { CryptoManager } from '../src/crypto/CryptoManager';

const RegisterForm = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const crypto = new CryptoManager();
      const identityKeyPair = await crypto.generateIdentityKeyPair();
      const signedPreKey = await crypto.generateSignedPreKey(identityKeyPair.privateKey);
      const oneTimePreKeys = await crypto.generateOneTimePreKeys(5);
      const hashedPassword = await crypto.hashPassword(password);

      const identifier = localStorage.getItem('phantom_identifier');
      if (!identifier) throw new Error('Идентификатор не найден');

      const payload = {
        login: username,
        password: hashedPassword,
        identifier,
        publicKey: identityKeyPair.publicKey,
        identityKey: identityKeyPair.publicKey,
        signedPreKey,
        oneTimePreKeys
      }

console.log("🚀 Payload отправки на сервер:", payload);

function validateRegisterPayload(payload) {
  const requiredFields = ['login', 'passwordHash', 'identifier', 'identityKey', 'signedPreKey', 'oneTimePreKeys'];
  for (const field of requiredFields) {
    if (!payload[field]) {
      console.error(`❌ Отсутствует поле: ${field}`);
      return false;
    }
  }

  if (typeof payload.signedPreKey !== 'object') {
    console.error("❌ signedPreKey должен быть объектом");
    return false;
  }

  const spk = payload.signedPreKey;
  const spkFields = ['keyId', 'publicKey', 'privateKey', 'signature', 'createdAt'];
  for (const field of spkFields) {
    if (!spk[field] || (typeof spk[field] !== 'string' && field !== 'keyId' && field !== 'createdAt')) {
      console.error(`❌ Поле signedPreKey.${field} некорректно`);
      return false;
    }
  }

  if (!Array.isArray(payload.oneTimePreKeys) || payload.oneTimePreKeys.length === 0) {
    console.error("❌ oneTimePreKeys должен быть непустым массивом");
    return false;
  }

  for (const [i, otp] of payload.oneTimePreKeys.entries()) {
    const otpFields = ['keyId', 'publicKey', 'privateKey', 'createdAt'];
    for (const field of otpFields) {
      if (!otp[field]) {
        console.error(`❌ Ключ oneTimePreKeys[${i}] не содержит поле ${field}`);
        return false;
      }
    }
  }

  return true;
}

if (!validateRegisterPayload(payload)) {
  console.error("⛔ Payload не прошёл валидацию, регистрация прервана");
  return;
}
;

      const res = await fetch('http://localhost:5001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (res.ok) {
        await crypto.storePrivateKey(identityKeyPair.privateKey, hashedPassword);
        localStorage.setItem('phantom_username', username);
        onSuccess();
      } else {
        setError(result.message || 'Ошибка регистрации');
      }
    } catch (err) {
      console.error('Ошибка регистрации:', err);
      setError(err.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-form">
      <h2>Регистрация</h2>
      <input
        type="text"
        placeholder="Логин"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        placeholder="Подтвердите пароль"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <button onClick={handleRegister} disabled={loading}>Зарегистрироваться</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default RegisterForm;
