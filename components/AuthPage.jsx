import React, { useEffect, useState } from 'react';
import { Tabs, Form, Input, Button, Typography, message } from 'antd';
import { API } from '../src/config';
import { CryptoManager } from '../crypto/CryptoManager';
import MainPage from './MainPage';
import '../src/App.css';

const { Title } = Typography;

const AuthPage = ({ onSuccess = () => {} }) => {
  const [identifier, setIdentifier]           = useState('');
  const [registerForm]                        = Form.useForm();
  const [loginForm]                           = Form.useForm();
  const [isAuthenticated, setIsAuthenticated] = useState(false);



  const generateIdentifier = async () => {
    try {
      const res = await fetch(API.generateIdentifierURL);
      const data = await res.json();
      setIdentifier(data.identifier);
      console.log('✅ Уникальный идентификатор получен:', data.identifier);
    } catch (error) {
      console.error('❌ Не удалось получить идентификатор:', error);
      message.error('Сервер недоступен. Попробуйте позже.');
    }
  };


  // РЕГИСТРАЦИЯ
  const handleRegister = async (values) => {
    const { username, password, confirm, nickname } = values;
    if (!identifier) return message.error('Сначала получите идентификатор');
    if (password !== confirm) return message.error('Пароли не совпадают');

    try {
      const crypto = new CryptoManager();

      const usernameHash = await crypto.hashPassword(username);
      const passwordHash = await crypto.hashPassword(password);
      const credHash = await crypto.deriveCredentialsHash(username, password);
      
      const identityKey = await crypto.generateIdentityKeyPair();
      const signedPreKey = await crypto.generateSignedPreKey(identityKey.privateKey);
      const oneTimePreKeys = await crypto.generateOneTimePreKeys(5);

      const payload = {
        username: usernameHash,
        password: passwordHash,
        identifier,
        nickname,
        identityKey: identityKey.publicKey,
        publicKey: identityKey.publicKey,
        signedPreKey,
        oneTimePreKeys: oneTimePreKeys.map(k => ({
          keyId: k.keyId,
          publicKey: k.publicKey,
          createdAt: k.createdAt
        }))
      };

      const res = await fetch(API.registerURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        
        localStorage.setItem('usernameHash', usernameHash);
        localStorage.setItem('passwordHash', passwordHash);
        localStorage.setItem('credHash', credHash);

        localStorage.setItem('identifier', data.identifier);
        localStorage.setItem('token', data.token);
        localStorage.setItem('userid', data.userId);
        localStorage.setItem('nickname', data.nickname);
        
        await crypto.storePrivateKey(identityKey.privateKey, credHash);
        await crypto.storePrivateKey(signedPreKey.privateKey, credHash);
        for (const preKey of oneTimePreKeys) {
          await crypto.storePrivateKey(preKey.privateKey, credHash);
        }

        message.success('Регистрация прошла успешно!');
        setIsAuthenticated(true);
      } else {
        const data = await res.json();
        message.error(`Ошибка: ${data.message}`);
      }
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      message.error('Ошибка при регистрации');
    }
  };

  // АВТОРИЗАЦИЯ  
  const handleLogin = async (values) => {
    const { username, password } = values;
    try {
      const crypto = new CryptoManager();
      const usernameHash = await crypto.hashPassword(username);
      const passwordHash = await crypto.hashPassword(password);
      const credHash = await crypto.deriveCredentialsHash(username, password);
      
      
      
      const res = await fetch(API.loginURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameHash, password: passwordHash })
      });

      const data = await res.json();

      if (res.ok) {
        

        
        localStorage.setItem('usernameHash',  usernameHash);
        localStorage.setItem('passwordHash',  passwordHash);
        localStorage.setItem('credHash',      credHash);
        
        localStorage.setItem('identifier',    data.identifier);
        localStorage.setItem('token',         data.token);
        localStorage.setItem('userid',        data.userId);
        localStorage.setItem('nickname',      data.nickname);
        
        const privateKey = await crypto.loadPrivateKey(credHash);
        if (!privateKey) {
          message.error('Не удалось расшифровать локальный ключ. Проверьте пароль.');
          return;
        }

        setIsAuthenticated(true);
      } else {
        const data = await res.json();
        message.error(`Ошибка входа: ${data.message}`);
      }
    } catch (err) {
      console.error('Ошибка входа:', err);
      message.error('Ошибка при попытке входа');
    }
  };

  if (isAuthenticated) return <MainPage onLogout={() => {
    localStorage.clear(); // удаляет всё
    window.location.reload(); // перезагрузка страницы
    setIsAuthenticated(false);
  }} />;



  return (
    <div className="auth-page">
      <div className="auth-container">
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Title level={2}>🔐 Phantom</Title>
        </div>
        <Tabs
          defaultActiveKey="login"
          centered
          onChange={(key) => key === 'register' && generateIdentifier()}
          items={[
            {
              key: 'login',
              label: 'Войти',
              children: (
                <Form form={loginForm} onFinish={handleLogin} layout="vertical">
                  <Form.Item name="username" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}>
                    <Input.Password />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block>
                      Войти
                    </Button>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'register',
              label: 'Регистрация',
              children: (
                <>
                  <div className="identifier-box">
                    ID: <strong>{identifier || '—'}</strong>
                    <Button onClick={generateIdentifier} size="small" style={{ marginLeft: '10px' }}>
                      🔁 Обновить ID
                    </Button>
                  </div>
                  <Form form={registerForm} onFinish={handleRegister} layout="vertical">
                    <Form.Item
                      name="nickname"
                      label="Никнейм"
                      rules={[{ required: true, message: 'Введите никнейм' }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name="username"
                      label="Логин"
                      rules={[{ required: true, message: 'Введите логин' }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name="password"
                      label="Пароль"
                      rules={[{ required: true, message: 'Введите пароль' }]}
                    >
                      <Input.Password />
                    </Form.Item>
                    <Form.Item
                      name="confirm"
                      label="Повтор пароля"
                      dependencies={['password']}
                      rules={[
                        { required: true, message: 'Подтвердите пароль' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            return value === getFieldValue('password')
                              ? Promise.resolve()
                              : Promise.reject(new Error('Пароли не совпадают'));
                          }
                        })
                      ]}
                    >
                      <Input.Password />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" block>
                        Зарегистрироваться
                      </Button>
                    </Form.Item>
                  </Form>
                </>
              )
            }
          ]}
        />
      </div>
    </div>
  );
};

export default AuthPage;
