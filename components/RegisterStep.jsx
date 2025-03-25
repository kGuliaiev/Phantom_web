import React, { useEffect, useState } from 'react';

const RegisterStep = ({ onNext }) => {
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5001/api/auth/identifier')
      .then(res => res.json())
      .then(data => {
        setIdentifier(data.identifier);
        localStorage.setItem('phantom_identifier', data.identifier);
      })
      .catch(err => setError('Ошибка получения идентификатора'));
  }, []);

  const handleContinue = () => {
    if (!username || !password) {
      setError('Заполните все поля');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    onNext({ identifier, username, password });
  };

  return (
    <div>
      <h2>Регистрация</h2>
      <p><strong>Ваш ID:</strong> {identifier || 'Загрузка...'}</p>

      <input
        type="text"
        placeholder="Логин"
        value={username}
        onChange={e => setUsername(e.target.value)}
      /><br />

      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={e => setPassword(e.target.value)}
      /><br />

      <input
        type="password"
        placeholder="Повторите пароль"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
      /><br />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={handleContinue}>Продолжить</button>
    </div>
  );
};

export default RegisterStep;