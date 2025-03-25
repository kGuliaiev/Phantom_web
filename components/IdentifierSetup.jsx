// // Файл: src/components/IdentifierSetup.jsx
// import React, { useEffect, useState } from 'react';

// const IdentifierSetup = ({ onContinue }) => {
//   const [identifier, setIdentifier] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     const saved = localStorage.getItem('phantom_identifier');
//     if (saved) {
//       setIdentifier(saved);
//       return;
//     }

//     const fetchIdentifier = async () => {
//       setLoading(true);
//       try {
//         const res = await fetch('http://localhost:5001/api/auth/generate-identifier');
//         const data = await res.json();
//         if (res.ok && data.identifier) {
//           localStorage.setItem('phantom_identifier', data.identifier);
//           setIdentifier(data.identifier);
//         } else {
//           setError(data.message || 'Ошибка генерации');
//         }
//       } catch (err) {
//         setError('Ошибка подключения к серверу');
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchIdentifier();
//   }, []);

//   return (
//     <div className="identifier-setup">
//       <h2>Ваш идентификатор:</h2>
//       {loading ? <p>Загрузка...</p> : <p><strong>{identifier}</strong></p>}
//       {error && <p style={{ color: 'red' }}>{error}</p>}
//       <button onClick={onContinue} disabled={!identifier}>Продолжить</button>
//     </div>
//   );
// };

// export default IdentifierSetup;