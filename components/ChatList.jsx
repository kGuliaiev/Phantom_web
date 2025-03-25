// Файл: /components/ChatList.jsx
import React from 'react';

export default function ChatList({ chats, onSelect }) {
  return (
    <div className="chat-list">
      <h3>Список чатов</h3>
      {chats.map(chat => (
      <div key={chat.identifier || chat._id || chat.username} onClick={() => onSelect(chat)}>
        {chat.username}
      </div>
    ))}
    </div>
  );
}