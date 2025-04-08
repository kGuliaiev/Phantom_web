// import React, { useEffect, useState } from 'react';
// import { API } from '../src/config';

// const ChatList = ({ currentUser, onSelect }) => {
//   const [chats, setChats] = useState([]);
//   const [lastStatus, setLastStatus] = useState({}); // { username: "read" }

//   useEffect(() => {
//     const fetchChats = async () => {
//       try {
//     const res = await fetch(`${API.getContactsURL}`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${localStorage.getItem('token')}`
//       },
//       body: JSON.stringify({ identifier: currentUser })
//     });
//     const users = await res.json();
//     const filtered = users.filter(c => c.contactId !== currentUser);
//         setChats(filtered);
//         fetchStatuses(filtered);
//       } catch (err) {
//         console.error("Ошибка загрузки списка чатов:", err);
//       }
//     };

//     const fetchStatuses = async (chatList) => {
//       try {
//         const res = await fetch(`${API.receiveMessagesURL}?receiverId=${currentUser}`);
//         const messages = await res.json();
//         if (!Array.isArray(messages)) throw new Error('Некорректный формат сообщений');

//         const statusMap = {};

//         chatList.forEach((chat) => {
//         const sentMessages = messages
//             .filter(m => m.senderId === currentUser && m.receiverId === chat.contactId);
//           if (sentMessages.length > 0) {
//             const last = sentMessages[sentMessages.length - 1];
//             statusMap[chat.username] = last.status || 'sent';
//           }
//         });

//         setLastStatus(statusMap);
//       } catch (err) {
//         console.error("Ошибка получения статуса сообщений:", err);
//       }
//     };

//     if (currentUser) fetchChats();
//   }, [currentUser]);

//   const renderStatusIcon = (status) => {
//     switch (status) {
//       case 'read':
//         return '✓✓'; // Прочитано
//       case 'delivered':
//         return '✓'; // Доставлено
//       case 'sent':
//         return '⏳'; // Отправлено, но не доставлено
//       default:
//         return '';
//     }
//   };

//   return (
//     <div className="chat-list">
//       <h3>💬 Чаты</h3>
//       {chats.length === 0 ? (
//         <p>Нет активных чатов</p>
//       ) : (
//         <ul>
//         {chats.map((chat) => (
//             <li key={chat.contactId}>
//               <button onClick={() => onSelect(chat)}>
//                 👤 {chat.nickname || chat.contactId}
//                 <span className="chat-status">
//                   {renderStatusIcon(lastStatus[chat.contactId])}
//                 </span>
//               </button>
//             </li>
//           ))}
//         </ul>
//       )}
//     </div>
//   );
// };

// export default ChatList;