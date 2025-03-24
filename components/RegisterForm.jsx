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
        username,
        password: hashedPassword,
        identifier,
        publicKey: identityKeyPair.publicKey,
        identityKey: identityKeyPair.publicKey,
        signedPreKey,
        oneTimePreKeys
      };

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
