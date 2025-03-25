import React, { useEffect, useState } from 'react';
import { API } from '../src/config';

const ChatList = ({ currentUser, onSelect }) => {
  const [chats, setChats] = useState([]);
  const [lastStatus, setLastStatus] = useState({}); // { username: "read" }

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await fetch(`${API.usersListURL}`);
        const users = await res.json();
        const filtered = users.filter(u => u.username !== currentUser);
        setChats(filtered);
        fetchStatuses(filtered);
      } catch (err) {
        console.error("Ошибка загрузки списка чатов:", err);
      }
    };

    const fetchStatuses = async (chatList) => {
      try {
        const res = await fetch(`${API.receiveMessagesURL}?receiverId=${currentUser}`);
        const messages = await res.json();

        const statusMap = {};

        chatList.forEach((chat) => {
          const sentMessages = messages
            .filter(m => m.senderId === currentUser && m.receiverId === chat.username);
          if (sentMessages.length > 0) {
            const last = sentMessages[sentMessages.length - 1];
            statusMap[chat.username] = last.status || 'sent';
          }
        });

        setLastStatus(statusMap);
      } catch (err) {
        console.error("Ошибка получения статуса сообщений:", err);
      }
    };

    if (currentUser) fetchChats();
  }, [currentUser]);

  const renderStatusIcon = (status) => {
    switch (status) {
      case 'read':
        return '✓✓'; // Прочитано
      case 'delivered':
        return '✓'; // Доставлено
      case 'sent':
        return '⏳'; // Отправлено, но не доставлено
      default:
        return '';
    }
  };

  return (
    <div className="chat-list">
      <h3>💬 Чаты</h3>
      {chats.length === 0 ? (
        <p>Нет активных чатов</p>
      ) : (
        <ul>
          {chats.map((chat) => (
            <li key={chat.username}>
              <button onClick={() => onSelect(chat)}>
                👤 {chat.username}
                <span className="chat-status">
                  {renderStatusIcon(lastStatus[chat.username])}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ChatList;