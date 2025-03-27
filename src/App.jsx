// App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Spin } from 'antd';

import MainPage from '../components/MainPage';
import AuthPage from '../components/AuthPage';
import Logout from '../components/Logout';
import { API } from '../src/config';
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token         = localStorage.getItem('token');
    const usernameHash      = localStorage.getItem('usernameHash');
    const passwordHash  = localStorage.getItem('passwordHash');
    const identifier    = localStorage.getItem('identifier');

    console.log('💾 localStorage при старте:', { token, usernameHash, passwordHash, identifier });

    const validate = async () => {
      if (token && usernameHash && passwordHash && identifier) {
        try {
          const res = await fetch(API.validateTokenURL, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            console.log('✅ Токен действителен, автоматический вход выполнен');
            setIsAuthenticated(true);
          } else {
            console.warn('❌ Токен недействителен');
            localStorage.clear();
            setIsAuthenticated(false);
          }
        } catch (err) {
          console.error('Ошибка проверки токена:', err);
          setIsAuthenticated(false);
        }
      } else {
        console.warn('⚠️ Отсутствуют данные в localStorage');
        setIsAuthenticated(false);
      }
      setCheckingAuth(false);
    };

    validate();
  }, []);

  if (checkingAuth) {
    return (
      <div className="spinner-wrapper">
        <Spin size="large" tip="Проверка токена..." />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/logout"
          element={<Logout setIsAuthenticated={setIsAuthenticated} />}
        />
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <MainPage />
            ) : (
              <AuthPage onSuccess={() => setIsAuthenticated(true)} />
            )
          }
        />
      </Routes>
    </Router>
  );
};

export default App;