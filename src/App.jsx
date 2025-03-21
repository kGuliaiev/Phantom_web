// Файл: src/App.jsx
import React, { useEffect, useState } from 'react';
import './App.css';
import { CryptoManager } from './crypto/CryptoManager';
import { API } from './config';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import AuthForm from '../components/AuthForm';

function App() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatList, setChatList] = useState([]);

  const [crypto, setCrypto] = useState(null);

  useEffect(() => {
    setCrypto(new CryptoManager());
  }, []);

  const registerUser = async () => {
    const { publicKeyBase64, privateKey } = await crypto.generateKeys();
    const hashedPassword = await crypto.hashPassword(password);

    await fetch(`${API.registerUserURL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        password: hashedPassword,
        publicKey: publicKeyBase64,
      })
    });

    localStorage.setItem('privateKey', privateKey);
    setLoggedIn(true);
  };

  const loginUser = async () => {
    const hashedPassword = await crypto.hashPassword(password);
    const res = await fetch(`${API.validateUserURL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password: hashedPassword })
    });
    const result = await res.json();

    if (result.success) {
      setLoggedIn(true);
      fetchChats();
    }
  };

  const fetchChats = async () => {
    const res = await fetch(`${API.usersListURL}`);
    const users = await res.json();
    const filtered = users.filter(u => u.userId !== userId);
    setChatList(filtered);
  };

  const selectChat = async (receiver) => {
    setSelectedChat(receiver);
    const res = await fetch(`${API.receiveMessagesURL}?receiverId=${userId}`);
    const messages = await res.json();

    const relevantMessages = messages.filter(
      m => m.senderId === receiver.userId || m.receiverId === receiver.userId
    );

    const decryptedMessages = await Promise.all(relevantMessages.map(async msg => {
      try {
        const decrypted = await crypto.decryptMessage(msg.text);
        return `${msg.senderId}: ${decrypted}`;
      } catch (e) {
        return `${msg.senderId}: [Ошибка дешифрования]`;
      }
    }));

    setChatMessages(decryptedMessages);
  };

  const sendMessage = async () => {
    const receiverId = selectedChat.userId;
    const receiverPublicKeyRes = await fetch(`${API.checkUserURL}?userId=${receiverId}`);
    const { publicKey: receiverPubKey } = await receiverPublicKeyRes.json();

    const encrypted = await crypto.encryptMessage(receiverPubKey, message);

    await fetch(`${API.sendMessageURL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: userId,
        receiverId,
        text: encrypted,
      })
    });

    setMessage('');
    selectChat(selectedChat);
  };

  if (!crypto) return <div>Загрузка криптографии...</div>;

  return (
    <div className="App">
      {!loggedIn ? (
        <AuthForm
          isRegistering={isRegistering}
          userId={userId}
          password={password}
          onUserIdChange={setUserId}
          onPasswordChange={setPassword}
          onRegister={registerUser}
          onLogin={loginUser}
          toggleMode={() => setIsRegistering(prev => !prev)}
        />
      ) : (
        <div className="messenger">
          <ChatList chats={chatList} onSelect={selectChat} />
          <ChatWindow
            selectedChat={selectedChat}
            messages={chatMessages}
            message={message}
            onMessageChange={setMessage}
            onSend={sendMessage}
          />
        </div>
      )}
    </div>
  );
}

export default App;
