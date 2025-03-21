// Файл: src/components/ChatWindow.jsx
import React from 'react';

export default function ChatWindow({ selectedChat, messages, message, onMessageChange, onSend }) {
  return (
    <div className="chat-window">
      {selectedChat ? (
        <>
          <h4>Чат с: {selectedChat.userId}</h4>
          <div className="chat">
            {messages.map((msg, i) => <div key={i} className="chat-message">{msg}</div>)}
          </div>
          <input placeholder="Сообщение" value={message} onChange={e => onMessageChange(e.target.value)} />
          <button onClick={onSend}>Отправить</button>
        </>
      ) : (
        <p>Выберите чат</p>
      )}
    </div>
  );
}