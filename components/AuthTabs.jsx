// import React, { useState } from 'react';
// import RegisterForm from './RegisterForm';
// import LoginForm from './LoginForm';
// import { API } from '../src/config';

// const AuthTabs = ({ onSuccess }) => {
//   const [tab, setTab] = useState('login');
//   const [identifier, setIdentifier] = useState('');
//   const [errorMessage, setErrorMessage] = useState('');

//   const handleStartRegister = async () => {
//     try {
//       const res = await fetch(API.generateIdentifierURL);
//       const data = await res.json();
//       console.log('🆔 [AuthTabs] Получен ID при старте регистрации:', data.identifier);
//       setIdentifier(data.identifier);
//       setTab('register');
//     } catch (err) {
//       console.error('❌ Не удалось получить идентификатор:', err);
//       setErrorMessage('❗ Не удалось подключиться к серверу. Попробуйте позже.');
//     }
//   };

//   return (
//     <div className="auth-tabs">
//       <div className="tab-buttons">
//         <button onClick={() => setTab('login')}>🔐 Войти</button>
//         <button onClick={handleStartRegister}>📝 Регистрация</button>
//       </div>

//       {errorMessage && <div className="error-message">{errorMessage}</div>}

//       {tab === 'login' && <LoginForm onSuccess={onSuccess} />}
//       {tab === 'register' && <RegisterForm identifier={identifier} onSuccess={onSuccess} />}
//     </div>
//   );
// };

// export default AuthTabs;