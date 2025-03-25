import React, { useEffect, useState } from 'react';
import './App.css';
import { CryptoManager } from './crypto/CryptoManager';
import { API } from './config';
import ChatWindow from '../components/ChatWindow.jsx';
import ContactList from '../components/ContactList';
import ChatList from '../components/ChatList';
import AuthTabs from '../components/AuthTabs';

function App() {
  const [crypto, setCrypto] = useState(null);
  const [userId, setUserId] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('chats'); // 'contacts' | 'chats'

  useEffect(() => {
    setCrypto(new CryptoManager());
    const saved = localStorage.getItem('phantom_username');
    if (saved) {
      setUserId(saved);
      setLoggedIn(true);
    }
  }, []);

  const handleAuthSuccess = () => {
    const saved = localStorage.getItem('phantom_username');
    if (saved) {
      setUserId(saved);
      setLoggedIn(true);
    }
  };

  const selectChat = async (user) => {
    setSelectedChat(user);
  
    try {
      const res = await fetch(`${API.receiveMessagesURL}?receiverId=${userId}`);
      const messages = await res.json();
  
      const relevant = messages.filter(
        (m) =>
          (m.senderId === user.username && m.receiverId === userId) ||
          (m.senderId === userId && m.receiverId === user.username)
      );
  
      const decryptedMessages = await Promise.all(
        relevant.map(async (msg) => {
          try {
            const plain = await crypto.decryptMessage(msg.text);
            return {
              id: msg._id,
              text: `${msg.senderId}: ${plain}`,
              status: msg.status || 'sent'
            };
          } catch {
            return {
              id: msg._id,
              text: `${msg.senderId}: [Ошибка дешифрования]`,
              status: msg.status || 'sent'
            };
          }
        })
      );
  
      setChatMessages(decryptedMessages.map((m) => m.text));
  
      // 📨 Отправим подтверждение о прочтении входящих сообщений
      const unreadIds = relevant
        .filter((m) => m.receiverId === userId && m.status !== 'read')
        .map((m) => m._id);
  
      if (unreadIds.length > 0) {
        await fetch(`${API.confirmReadURL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageIds: unreadIds })
        });
      }
    } catch (err) {
      console.error("Ошибка загрузки сообщений:", err);
    }
  };

  const sendMessage = async () => {
    if (!selectedChat) return;
    try {
      const receiverId = selectedChat.username;
      const res = await fetch(`${API.checkUserURL}?userId=${receiverId}`);
      const { publicKey } = await res.json();
      const encrypted = await crypto.encryptMessage(publicKey, message);

      await fetch(`${API.sendMessageURL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: userId,
          receiverId,
          text: encrypted
        })
      });

      setMessage('');
      selectChat(selectedChat); // обновим сообщения
    } catch (err) {
      console.error('Ошибка отправки сообщения:', err);
    }
  };

  if (!crypto) return <div>Загрузка шифрования...</div>;

  if (!loggedIn) return <AuthTabs onSuccess={handleAuthSuccess} />;

  return (
    <div className="App">
      <header>
        <h2>👤 {userId}</h2>
        <div className="tabs">
          <button onClick={() => setTab('contacts')} className={tab === 'contacts' ? 'active' : ''}>Контакты</button>
          <button onClick={() => setTab('chats')} className={tab === 'chats' ? 'active' : ''}>Чаты</button>
        </div>
      </header>

      <main className="main-layout">
        <div className="sidebar">
          {tab === 'contacts' ? (
            <ContactList currentUser={userId} onSelect={selectChat} />
          ) : (
            <ChatList currentUser={userId} onSelect={selectChat} />
          )}
        </div>

        <div className="content">
          {selectedChat ? (
            <ChatWindow
              selectedChat={selectedChat}
              messages={chatMessages}
              message={message}
              onMessageChange={setMessage}
              onSend={sendMessage}
            />
          ) : (
            <div className="no-chat">Выберите чат или контакт</div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;