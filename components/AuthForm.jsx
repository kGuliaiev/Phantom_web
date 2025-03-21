// Файл: src/components/AuthForm.jsx
import React from 'react';

export default function AuthForm({ isRegistering, userId, password, onUserIdChange, onPasswordChange, onRegister, onLogin, toggleMode }) {
  return (
    <div>
      <h2>{isRegistering ? 'Регистрация' : 'Вход'}</h2>
      <input placeholder="Ваш ID" value={userId} onChange={e => onUserIdChange(e.target.value)} />
      <input placeholder="Пароль" type="password" value={password} onChange={e => onPasswordChange(e.target.value)} />
      {isRegistering ? (
        <>
          <button onClick={onRegister}>Зарегистрироваться</button>
          <p onClick={toggleMode}>Уже есть аккаунт? Войти</p>
        </>
      ) : (
        <>
          <button onClick={onLogin}>Войти</button>
          <p onClick={toggleMode}>Нет аккаунта? Зарегистрироваться</p>
        </>
      )}
    </div>
  );
}