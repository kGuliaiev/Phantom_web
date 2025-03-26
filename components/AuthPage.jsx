import React, { useState } from 'react';
import { Tabs, Form, Input, Button, Typography, message } from 'antd';
import { API } from '../src/config';
import { CryptoManager } from '../crypto/CryptoManager';
import ChatList from './ChatList';
import '../src/App.css';

const { Title } = Typography;
const { TabPane } = Tabs;

const AuthPage = ({ onSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [registerForm] = Form.useForm();
  const [loginForm] = Form.useForm();
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

  const handleRegister = async (values) => {
    const { username, password, confirm } = values;
    if (!identifier) return message.error('Сначала получите идентификатор');
    if (password !== confirm) return message.error('Пароли не совпадают');

    try {
      const crypto = new CryptoManager();
      const passwordHash = await crypto.hashPassword(password);

      const identityKey = await crypto.generateIdentityKeyPair();
      const signedPreKey = await crypto.generateSignedPreKey(identityKey.privateKey);
      const oneTimePreKeys = await crypto.generateOneTimePreKeys(5);

      const payload = {
        username,
        password: passwordHash,
        identifier,
        identityKey: identityKey.publicKey,
        publicKey: identityKey.publicKey,
        signedPreKey,
        oneTimePreKeys: oneTimePreKeys.map(k => ({
          keyId: k.keyId,
          publicKey: k.publicKey,
          createdAt: k.createdAt
        }))
      };

      console.log('📦 Регистрация с данными:', payload);

      const res = await fetch(API.registerURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        console.log('✅ Пользователь успешно зарегистрирован');
        localStorage.setItem('phantom_identifier', identifier);
        await crypto.savePrivateData(password);
        message.success('Регистрация прошла успешно!');
        setIsAuthenticated(true);
      } else if (res.status === 409) {
        message.error('Пользователь с таким именем уже существует');
      } else {
        const data = await res.json();
        message.error(`Ошибка: ${data.message}`);
      }

    } catch (error) {
      console.error('Ошибка регистрации:', error);
      message.error('Ошибка при регистрации');
    }
  };

  const handleLogin = async (values) => {
    const { username, password } = values;
    try {
      const crypto = new CryptoManager();
      const passwordHash = await crypto.hashPassword(password);

      const res = await fetch(API.validateUserURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: passwordHash })
      });

      if (res.ok) {
        await crypto.loadFromIndexedDB(username, passwordHash);
        message.success('Вход выполнен');
        if (typeof onSuccess === 'function') {
          onSuccess();
        } else {
          console.warn('⚠️ onSuccess не является функцией');
        }
      } else {
        const data = await res.json();
        message.error(`Ошибка входа: ${data.message}`);
      }
    } catch (err) {
      console.error('Ошибка входа:', err);
      message.error('Ошибка при попытке входа');
    }
  };


  if (isAuthenticated) return <ChatList />;

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Title level={2}>🔐 Phantom</Title>
        </div>
        <Tabs defaultActiveKey="login" centered onChange={(key) => key === 'register' && generateIdentifier()}>
          <Tabs.TabPane tab="Войти" key="login">
            <Form form={loginForm} onFinish={handleLogin} layout="vertical">
              <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="Пароль" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  Войти
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPane>

          <Tabs.TabPane tab="Регистрация" key="register">
            <div className="identifier-box">
              ID: <strong>{identifier || '—'}</strong>
              <Button onClick={generateIdentifier} size="small" style={{ marginLeft: '10px' }}>
                🔁 Обновить ID
              </Button>
            </div>
            <Form form={registerForm} onFinish={handleRegister} layout="vertical">
              <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="Пароль" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item name="confirm" label="Повтор пароля" dependencies={['password']} rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    return value === getFieldValue('password')
                      ? Promise.resolve()
                      : Promise.reject(new Error('Пароли не совпадают'));
                  }
                })
              ]}>
                <Input.Password />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  Зарегистрироваться
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default AuthPage;