import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import { API } from '../src/config';

const AuthTabs = ({ onSuccess }) => {
  const [activeTab, setActiveTab] = useState('login');

  const handleStartRegister = async () => {
    try {
      const res = await fetch(`${API.generateIdentifierURL}`);
      const data = await res.json();
      localStorage.setItem('phantom_identifier', data.identifier);
      console.log('🆔 [AuthTabs] Получен ID при старте регистрации:', data.identifier);
      setActiveTab('register');
    } catch (err) {
      console.error('❌ Не удалось получить идентификатор:', err);
      alert('Ошибка при инициализации регистрации');
    }
  };

  return (
    <div className="auth-tabs">
      <div className="tabs">
        <button
          className={activeTab === 'login' ? 'active' : ''}
          onClick={() => setActiveTab('login')}
        >
          Вход
        </button>
        <button
          className={activeTab === 'register' ? 'active' : ''}
          onClick={handleStartRegister}
        >
          Регистрация
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'login' && <LoginForm onSuccess={onSuccess} />}
        {activeTab === 'register' && <RegisterForm onSuccess={onSuccess} />}
      </div>
    </div>
  );
};

export default AuthTabs;