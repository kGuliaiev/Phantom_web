// Файл: src/components/AuthTabs.jsx
import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthTabs = ({ onSuccess }) => {
  const [activeTab, setActiveTab] = useState('login');

  return (
    <div className="auth-tabs">
      <div className="tab-buttons">
        <button
          className={activeTab === 'login' ? 'active' : ''}
          onClick={() => setActiveTab('login')}
        >
          Вход
        </button>
        <button
          className={activeTab === 'register' ? 'active' : ''}
          onClick={() => setActiveTab('register')}
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