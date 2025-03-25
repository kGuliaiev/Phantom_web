// // App.jsx
// import React, { useState } from 'react';
// import { Tabs, Form, Input, Button, Typography, message } from 'antd';
// import { API } from '../src/config';
// import { CryptoManager } from '../crypto/CryptoManager';
// import ChatList from './ChatList';
// import './App.css';

// const { Title } = Typography;
// const { TabPane } = Tabs;

// function App() {
//   const [identifier, setIdentifier] = useState('');
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [loginForm] = Form.useForm();
//   const [registerForm] = Form.useForm();

//   const generateIdentifier = async () => {
//     try {
//       const res = await fetch(API.generateIdentifierURL);
//       const data = await res.json();
//       setIdentifier(data.identifier);
//       console.log('✅ Уникальный идентификатор получен:', data.identifier);
//     } catch (error) {
//       console.error('❌ Не удалось получить идентификатор:', error);
//       message.error('Сервер недоступен');
//     }
//   };

//   const handleRegister = async (values) => {
//     const { username, password, confirm } = values;
//     if (!identifier) return message.error('Сначала получите идентификатор');
//     if (password !== confirm) return message.error('Пароли не совпадают');

//     try {
//       const crypto = new CryptoManager();
//       const passwordHash = await crypto.hashPassword(password);

//       // Генерация ключей
//       await crypto.generateIdentityKeyPair();
//       await crypto.generateSignedPreKey();
//       await crypto.generateOneTimePreKeys(5);

//       const payload = {
//         username,
//         password: passwordHash,
//         identifier,
//         identityKey: crypto.keys.identityKey.publicKey,
//         publicKey: crypto.keys.identityKey.publicKey,
//         signedPreKey: {
//           keyId: crypto.keys.signedPreKey.keyId,
//           publicKey: crypto.keys.signedPreKey.publicKey,
//           signature: crypto.keys.signedPreKey.signature,
//           createdAt: crypto.keys.signedPreKey.createdAt,
//         },
//         oneTimePreKeys: crypto.keys.oneTimePreKeys.map(key => ({
//           keyId: key.keyId,
//           publicKey: key.publicKey,
//           createdAt: key.createdAt
//         }))
//       };

//       console.log('📦 Отправка данных на сервер:', payload);

//       const res = await fetch(API.registerUserURL, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload),
//       });

//       if (res.ok) {
//         console.log('✅ Пользователь успешно зарегистрирован');
//         localStorage.setItem('phantom_idыentifier', identifier);
//         await crypto.savePrivateData(password);
//         message.success('Регистрация прошла успешно!');
//         setIsAuthenticated(true);
//       } else if (res.status === 409) {
//         message.error('Пользователь с таким именем уже существует');
//       } else {
//         const data = await res.json();
//         message.error(`Ошибка: ${data.message}`);
//       }

//     } catch (error) {
//       console.error('Ошибка регистрации:', error);
//       message.error('Ошибка при регистрации');
//     }
//   };

//   const handleLogin = async (values) => {
//     const { username, password } = values;

//     try {
//       const crypto = new CryptoManager();
//       const passwordHash = await crypto.hashPassword(password);

//       const res = await fetch(API.validateUserURL, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ username, password: passwordHash }),
//       });

//       const data = await res.json();
//       if (res.ok) {
//         console.log('🔓 Вход выполнен, загружаем ключи...');
//         await crypto.loadPrivateData(password);
//         localStorage.setItem('phantom_identifier', data.identifier);
//         setIsAuthenticated(true);
//         message.success('Вход выполнен');
//       } else {
//         message.error(`Ошибка: ${data.message}`);
//       }
//     } catch (err) {
//       console.error('Ошибка входа:', err);
//       message.error('Ошибка при попытке входа');
//     }
//   };

//   if (isAuthenticated) return <ChatList />;

//   return (
//     <div className="auth-page">
//       <div className="auth-container">
//         <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
//           <Title level={2}>🔐 Phantom</Title>
//         </div>
//         <Tabs defaultActiveKey="login" centered onChange={key => key === 'register' && generateIdentifier()}>
//           <TabPane tab="Войти" key="login">
//             <Form form={loginForm} onFinish={handleLogin} layout="vertical">
//               <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
//                 <Input />
//               </Form.Item>
//               <Form.Item name="password" label="Пароль" rules={[{ required: true }]}>
//                 <Input.Password />
//               </Form.Item>
//               <Form.Item>
//                 <Button type="primary" htmlType="submit" block>
//                   Войти
//                 </Button>
//               </Form.Item>
//             </Form>
//           </TabPane>

//           <TabPane tab="Регистрация" key="register">
//             <div className="identifier-box">
//               ID: <strong>{identifier || '—'}</strong>
//               <Button onClick={generateIdentifier} size="small" style={{ marginLeft: '10px' }}>
//                 🔁 Обновить ID
//               </Button>
//             </div>
//             <Form form={registerForm} onFinish={handleRegister} layout="vertical">
//               <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
//                 <Input />
//               </Form.Item>
//               <Form.Item name="password" label="Пароль" rules={[{ required: true }]}>
//                 <Input.Password />
//               </Form.Item>
//               <Form.Item
//                 name="confirm"
//                 label="Повтор пароля"
//                 dependencies={['password']}
//                 rules={[
//                   { required: true },
//                   ({ getFieldValue }) => ({
//                     validator(_, value) {
//                       return value === getFieldValue('password')
//                         ? Promise.resolve()
//                         : Promise.reject(new Error('Пароли не совпадают'));
//                     }
//                   }),
//                 ]}
//               >
//                 <Input.Password />
//               </Form.Item>
//               <Form.Item>
//                 <Button type="primary" htmlType="submit" block>
//                   Зарегистрироваться
//                 </Button>
//               </Form.Item>
//             </Form>
//           </TabPane>
//         </Tabs>
//       </div>
//     </div>
//   );
// }

// export default App;