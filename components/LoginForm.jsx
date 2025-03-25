// // Файл: src/components/LoginForm.jsx
// import React, { useState } from 'react';
// import { CryptoManager } from '../src/crypto/CryptoManager';

// const LoginForm = ({ onSuccess }) => {
//   const [username, setUsername] = useState('');
//   const [password, setPassword] = useState('');
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async () => {
//     setLoading(true);
//     setError(null);

//     try {
//       const crypto = new CryptoManager();
//       const hashedPassword = await crypto.hashPassword(password);

//       const res = await fetch('http://localhost:5001/api/auth/login', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ username, password: hashedPassword })
//       });

//       const text = await res.text();
//         console.log("📨 Ответ сервера:", res.status, text);

//         let result;
//         try {
//         result = JSON.parse(text);
//         } catch {
//         result = { message: text };
//         }

//       if (!res.ok) {
//         setError(result.message || 'Ошибка входа');
//         return;
//       }

//       const privateKey = await crypto.loadPrivateKey(hashedPassword);
//       if (!privateKey) {
//         setError('Не удалось расшифровать локальный приватный ключ');
//         return;
//       }

//       localStorage.setItem('phantom_username', username);
//       onSuccess();
//     } catch (err) {
//       console.error('Ошибка входа:', err);
//       setError('Ошибка входа: ' + err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="login-form">
//       <h2>Вход</h2>
//       <input
//         type="text"
//         placeholder="Логин"
//         value={username}
//         onChange={(e) => setUsername(e.target.value)}
//       />
//       <input
//         type="password"
//         placeholder="Пароль"
//         value={password}
//         onChange={(e) => setPassword(e.target.value)}
//       />
//       <button onClick={handleLogin} disabled={loading}>Войти</button>
//       {error && <p style={{ color: 'red' }}>{error}</p>}
//     </div>
//   );
// };

// export default LoginForm;