// Файл: src/App.jsx
import React, { useEffect, useState } from 'react';
import './App.css';
import { CryptoManager } from './crypto/CryptoManager';
import { API } from './config';
import ChatList from '../components/ChatList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import AuthForm from '../components/AuthForm.jsx';

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
    if (!crypto) return alert("CryptoManager не инициализирован");

    const identityKeyPair = await crypto.generateIdentityKeyPair();
    const signedPreKey = await crypto.generateSignedPreKey(identityKeyPair.privateKey);
    const oneTimePreKeys = await crypto.generateOneTimePreKeys(10);
    const identifier = `id_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const payload = {
        username: userId,
        password: password,
        identifier: identifier,
        publicKey: identityKeyPair.publicKey,
        identityKey: identityKeyPair.publicKey,
        signedPreKey: signedPreKey,
        oneTimePreKeys: oneTimePreKeys
    };

    console.log("📤 Отправка данных на сервер:", payload);

    try {
        const response = await fetch(`${API.registerUserURL}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log("📥 Ответ от сервера:", result);

        if (response.ok) {
            console.log("✅ Регистрация успешна");
            localStorage.setItem("privateKey", identityKeyPair.privateKey);
            setLoggedIn(true);
            fetchChats();
        } else {
            alert(result.message || "Ошибка регистрации");
        }
    } catch (err) {
        console.error("❗ Ошибка при регистрации:", err);
        alert("Ошибка при подключении к серверу");
    }
};

  const loginUser = async () => {
    try {
      const res = await fetch(`${API.validateUserURL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userId, password })
      });

      const result = await res.json();

      if (res.ok) {
        setLoggedIn(true);
        fetchChats();
      } else {
        alert(result.message || 'Ошибка входа');
      }
    } catch (err) {
      alert("Ошибка при подключении к серверу");
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch(`${API.usersListURL}`);
      const users = await res.json();
      const filtered = users.filter(u => u.username !== userId);
      setChatList(filtered);
    } catch (err) {
      console.error("Ошибка загрузки чатов:", err);
    }
  };

  const selectChat = async (receiver) => {
    setSelectedChat(receiver);
    try {
      const res = await fetch(`${API.receiveMessagesURL}?receiverId=${userId}`);
      const messages = await res.json();

      const relevantMessages = messages.filter(
        (m) => m.senderId === receiver.username || m.receiverId === receiver.username
      );

      const decryptedMessages = await Promise.all(
        relevantMessages.map(async (msg) => {
          try {
            const decrypted = await crypto.decryptMessage(msg.text);
            return `${msg.senderId}: ${decrypted}`;
          } catch (e) {
            return `${msg.senderId}: [Ошибка дешифрования]`;
          }
        })
      );

      setChatMessages(decryptedMessages);
    } catch (err) {
      console.error("Ошибка загрузки сообщений:", err);
    }
  };

  const sendMessage = async () => {
    if (!selectedChat) return;
    
    try {
      const receiverId = selectedChat.username;
      const receiverPublicKeyRes = await fetch(`${API.checkUserURL}?userId=${receiverId}`);
      const { publicKey: receiverPubKey } = await receiverPublicKeyRes.json();

      const encrypted = await crypto.encryptMessage(receiverPubKey, message);

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
      selectChat(selectedChat);
    } catch (err) {
      console.error("Ошибка отправки сообщения:", err);
    }
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