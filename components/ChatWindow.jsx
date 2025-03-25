import React, { useEffect, useRef } from 'react';

const ChatWindow = ({ selectedChat, messages, message, onMessageChange, onSend }) => {
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h3>💬 {selectedChat.username}</h3>
      </div>

      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className="chat-bubble">{msg}</div>
        ))}
        <div ref={messageEndRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите сообщение..."
        />
        <button onClick={onSend}>Отправить</button>
      </div>
    </div>
  );
};

export default ChatWindow;