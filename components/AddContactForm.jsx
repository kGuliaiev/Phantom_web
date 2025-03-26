// // Файл: src/components/AddContactForm.jsx
// import React, { useState } from 'react';

// const AddContactForm = ({ currentUser, onContactAdded }) => {
//   const [contactId, setContactId] = useState('');
//   const [status, setStatus] = useState(null);

//   const handleAdd = async () => {
//     if (!contactId) return;
//     try {
//       const res = await fetch('http://localhost:5001/api/contacts/add', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ owner: currentUser, contactId })
//       });
//       const result = await res.json();
//       if (res.ok) {
//         setStatus('✅ Добавлено');
//         onContactAdded();
//         setContactId('');
//       } else {
//         setStatus(result.message || 'Ошибка');
//       }
//     } catch (err) {
//       setStatus('Ошибка запроса');
//     }
//   };

//   return (
//     <div className="add-contact">
//       <input
//         type="text"
//         placeholder="ID пользователя"
//         value={contactId}
//         onChange={(e) => setContactId(e.target.value)}
//       />
//       <button onClick={handleAdd}>Добавить</button>
//       {status && <p>{status}</p>}
//     </div>
//   );
// };

// export default AddContactForm;
