import React, { useEffect, useState }                       from 'react';
import { Tabs, Form, Input, Button, Typography, message }   from 'antd';
import { useNavigate }                                      from 'react-router-dom';

const { Title } = Typography;

import '../src/App.css';


import MainPage                               from './MainPage';
import { KeyCryptoManager }                   from '../crypto/keysCrypto';
import   { cryptoManager }                    from '../crypto/CryptoManager';
import { saveEncryptedKey, loadEncryptedKey } from '../utils/dbKeys';
import { API }                                from '../src/config';
import socketManager                          from '../src/socketManager';
import { DB_NAME, DB_VERSION, STORE_KEYS,
  STORE_MESSAGES, STORE_HISTORY }       from '../src/config.js';
import { KeyDBManager } from '../utils/dbKeys';
import { clearAllMessages } from '../utils/dbMessages';




const AuthPage = ({ onSuccess = () => {} }) => {
  const navigate                              = useNavigate();
  const [identifier,      setIdentifier]      = useState('');
  const [registerForm]                        = Form.useForm();
  const [loginForm]                           = Form.useForm();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading,         setLoading]         = useState(false);


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
      // Очистка локального хранилища и IndexedDB хранилищ
      localStorage.clear();
      await new Promise((res, rej) => {
        const del = indexedDB.deleteDatabase(DB_NAME);
        del.onsuccess = res;
        del.onerror   = rej;
      });
      const cryptoM = cryptoManager;

      const usernameHash    = await cryptoM.hashPassword(username);
      const passwordHash    = await cryptoM.hashPassword(password);
      const credHash        = await cryptoM.deriveCredentialsHash(username, password);
      
      const identityKey     = await cryptoM.generateIdentityKeyPair();
      const signedPreKey    = await cryptoM.generateSignedPreKey(identityKey.privateKey);
      const oneTimePreKeys  = await cryptoM.generateOneTimePreKeys(5);

      

      const payload = {
        username:     usernameHash,
        password:     passwordHash,
        identifier,
        nickname,
        identityKey:  identityKey.publicKey,
        publicKey:    identityKey.publicKey,
        signedPreKey,
        oneTimePreKeys: oneTimePreKeys.map(k => ({
          keyId:      k.keyId,
          publicKey:  k.publicKey,
          createdAt:  k.createdAt
        }))
      };
      //console.log('📦 Payload при регистрации:', payload);

      const res = await fetch(API.registerURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.status === 409) {
        message.error('Имя пользователя уже занято.');
        return;
      }

      if (!res.ok) {
        const errorText = await res.text();
        message.error(`Ошибка регистрации: ${errorText}`);
        return;
      }
      else
      {
        // window.indexedDB.deleteDatabase('PhantomDB'); // (удалено, используем deleteAllEncryptedKeys и clearAllMessages)
        // Шифрование каждого ключа отдельно
          // identityPrivateKey - privateKey
          const encryptedIdentityPrivateKey = await KeyCryptoManager.encryptPrivateKey(identityKey.privateKey, credHash);
          await saveEncryptedKey('identityPrivateKey', encryptedIdentityPrivateKey);

          // identityPublicKey - публичный ключ сохраняем в открытом виде
          await saveEncryptedKey('identityPublicKey', { encrypted: identityKey.publicKey, iv: new Uint8Array() });

          // signedPreKey - privateKey
          const encryptedSignedPrePrivateKey = await KeyCryptoManager.encryptPrivateKey(signedPreKey.privateKey, credHash);
          await saveEncryptedKey('signedPrePrivateKey', encryptedSignedPrePrivateKey);
          
          // signedPreKeyPublicKey - публичный ключ сохраняем в открытом виде
          await saveEncryptedKey('signedPreKeyPublicKey', { encrypted: signedPreKey.publicKey, iv: new Uint8Array() });


          if (encryptedIdentityPrivateKey) {
            localStorage.setItem('identityPrivateKey', JSON.stringify(encryptedIdentityPrivateKey));
          }
          if (encryptedSignedPrePrivateKey) {
            localStorage.setItem('signedPrePrivateKey', JSON.stringify(encryptedSignedPrePrivateKey));
          }


          // oneTimePreKeys
          for (let i = 0; i < oneTimePreKeys.length; i++) {
            const pk = oneTimePreKeys[i];
            const encryptedOtpPrivateKey = await KeyCryptoManager.encryptPrivateKey(pk.privateKey, credHash);
            const encPub  = await cryptoM.encryptData(pk.publicKey, credHash);
            await saveEncryptedKey(`oneTimePreKey_${i}_private`, encryptedOtpPrivateKey);
            await saveEncryptedKey(`otp_${pk.keyId}_pub`, encPub);
          }
          const keyIds = oneTimePreKeys.map(k => k.keyId);

          localStorage.setItem('otpKeyIds',       JSON.stringify(keyIds));
          localStorage.setItem('identityPublicKey', identityKey.publicKey);

          localStorage.setItem('usernameHash',    usernameHash);
          localStorage.setItem('passwordHash',    passwordHash);
          localStorage.setItem('credHash',        credHash);
          localStorage.setItem('identifier',      data.identifier);
          localStorage.setItem('userId',          data.userId);
          localStorage.setItem("nickname",        nickname);
          localStorage.setItem('token',           data.token);
          
          
          message.success('Регистрация успешна');
          //console.log('🎉 Регистрация успешна');
          const token = data.token;
          socketManager.emit('identify', { identifier, usernameHash, token });
          setIsAuthenticated(true); // переход в MainPage
        onSuccess(); // вызов колбэка после успешной регистрации
        navigate('/'); // переход на главную страницу после регистрации
      }

    } catch (error) {
      console.error('Ошибка регистрации:', error);
      message.error(`Ошибка при регистрации: ${error.message}`);
    }
  };

  // АВТОРИЗАЦИЯ  
  const handleLogin = async (values) => {
    const { username, password } = values;

    try {
      const cryptoM = cryptoManager;
      const usernameHash  = await cryptoM.hashPassword(username);
      const passwordHash  = await cryptoM.hashPassword(password);
      const credHash      = await cryptoM.deriveCredentialsHash(username, password);
  
      
      const res = await fetch(API.loginURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameHash, password: passwordHash })
      });
      
      if (res.status === 429) {
        message.error('Слишком много попыток входа. Попробуйте позже.');
        return;
      }
      
      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        message.error('Ошибка при обработке ответа сервера (невалидный JSON).');
        return;
      }
      const { token, userId, identifier, nickname } = data;
      //console.log('💾 data = await res.json(); после авторизации):', { token, usernameHash, passwordHash, credHash, identifier, userId, nickname });


      const allKeyIds = JSON.parse(localStorage.getItem('otpKeyIds') || '[]');

      if (res.ok) {          
        // Загрузка и расшифровка каждого ключа
        const encryptedIdentity     = await loadEncryptedKey('identityPrivateKey');
        const encryptedSignedPreKey = await loadEncryptedKey('signedPrePrivateKey');
       // Копируем зашифрованные ключи из IndexedDB в localStorage для оперативного доступа (в зашифрованном виде)
        if (encryptedIdentity) {
          localStorage.setItem('identityPrivateKey', JSON.stringify(encryptedIdentity));
        }
        if (encryptedSignedPreKey) {
          localStorage.setItem('signedPrePrivateKey', JSON.stringify(encryptedSignedPreKey));
        }
        if (!encryptedIdentity) {
          console.warn('identityPrivateKey не найден в IndexedDB');
        }
        if (!encryptedSignedPreKey) {
          console.warn('signedPrePrivateKey не найден в IndexedDB');
        }
  
        const identityPrivateKey = await KeyCryptoManager.decryptPrivateKey(encryptedIdentity,     credHash);
        const signedPreKeyPriv   = await KeyCryptoManager.decryptPrivateKey(encryptedSignedPreKey, credHash);       

        //  console.log('✅ Расшифрованный identityPrivateKey:', identityPrivateKey);
        //  console.log('✅ Расшифрованный signedPreKeyPriv:', signedPreKeyPriv);


        const oneTimePreKeys = [];
        for (let key of allKeyIds) {
          const encryptedPriv = await loadEncryptedKey(`otp_${key}_priv`);
          const encryptedPub  = await loadEncryptedKey(`otp_${key}_pub`);

          if (!encryptedPriv || !encryptedPub) {
            console.warn(`⚠️ Не найден один из ключей: otp_${key}_priv / otp_${key}_pub`);
            continue;
          }

          const privateKey = await cryptoM.decryptPrivateKey(encryptedPriv, credHash);
          const publicKey  = await cryptoM.decryptPrivateKey(encryptedPub, credHash);

          oneTimePreKeys.push({ keyId: key, privateKey, publicKey });
        }
          console.log(`🔐 Загружено одноразовых ключей: ${oneTimePreKeys.length}`);
          console.log('🔓 Ключи успешно расшифрованы при входе');
      
      localStorage.setItem('nickname',          nickname);
      localStorage.setItem('usernameHash',      usernameHash);
      localStorage.setItem('passwordHash',      passwordHash);
      localStorage.setItem('credHash',          credHash);
      localStorage.setItem('identifier',        identifier);
      localStorage.setItem('token',             token);
      localStorage.setItem('userId',            userId);
      
      
      socketManager.emit('identify', { identifier, usernameHash, token });
      console.log('📡 Первичный identify после авторизации');
      // setTimeout(() => {
      //   socketManager.emit('identify', { identifier, usernameHash, token });
      //   console.log('📡 Повторный identify через 1с после авторизации');
      // }, 1000);
      setIsAuthenticated(true);
      onSuccess(); // вызов колбэка после успешного входа
        
      } else {
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
                      rules={[{ required: true, message: 'Введите пароль' }]
                    }>
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
