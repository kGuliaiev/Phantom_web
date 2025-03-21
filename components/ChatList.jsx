// Файл: src/components/ChatList.jsx
import React from 'react';

export default function ChatList({ chats, onSelect }) {
  return (
    <div className="chat-list">
      <h3>Список чатов</h3>
      {chats.map(client => (
        <div key={client.userId} onClick={() => onSelect(client)} className="chat-user">
          {client.userId}
        </div>
      ))}
    </div>
  );
}