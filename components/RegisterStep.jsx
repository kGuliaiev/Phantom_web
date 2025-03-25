import React, { useEffect, useState } from 'react';
import { API } from '../src/config';

const RegisterStep = ({ onContinue }) => {
  const [identifier, setIdentifier] = useState('');

  useEffect(() => {
    const existingId = localStorage.getItem('phantom_identifier');
  
    if (!existingId) {
      fetch(`${API.generateIdentifierURL}`)
        .then(res => res.json())
        .then(data => {
          console.log('🆔 [RegisterStep] Получен идентификатор от сервера:', data.identifier);
          localStorage.setItem('phantom_identifier', data.identifier);
          setIdentifier(data.identifier);
        })
        .catch(err => {
          console.error('❌ [RegisterStep] Ошибка получения идентификатора:', err);
        });
    } else {
      console.log('ℹ️ [RegisterStep] Уже есть сохранённый ID:', existingId);
      setIdentifier(existingId);
    }
  }, []);

  const handleNext = () => {
    if (!identifier) {
      alert('Идентификатор не получен. Попробуйте позже.');
      return;
    }
    onContinue(); // переходим к вводу логина и пароля
  };

  return (
    <div className="register-step">
      <h2>Регистрация</h2>
      <p>Ваш уникальный ID:</p>
      <code>{identifier || 'Загрузка...'}</code>

      <button onClick={handleNext} disabled={!identifier}>
        Продолжить
      </button>
    </div>
  );
};

export default RegisterStep;