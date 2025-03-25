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
      const filtered = messages.filter(
        m => m.senderId === user.username || m.receiverId === user.username
      );

      const decrypted = await Promise.all(filtered.map(async (m) => {
        try {
          const plain = await crypto.decryptMessage(m.text);
          return `${m.senderId}: ${plain}`;
        } catch {
          return `${m.senderId}: [Ошибка дешифрования]`;
        }
      }));
      setChatMessages(decrypted);
    } catch (err) {
      console.error('Ошибка загрузки сообщений:', err);
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