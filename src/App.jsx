import React, { useEffect, useState } from 'react';
import './App.css';
import { CryptoManager } from './crypto/CryptoManager';
import { API } from './config';
import ChatList from '../components/ChatList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import AddContactForm from '../components/AddContactForm';
import ContactList from '../components/ContactList';
import AuthTabs from '../components/AuthTabs';
import RegisterStep from '../components/RegisterStep';
import RegisterFinalizeStep from '../components/RegisterFinalizeStep';

import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

const RegisterFlow = ({ onSuccess }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(null);
  const navigate = useNavigate();

  if (step === 1) {
    return (
      <RegisterStep onNext={(data) => {
        setFormData(data);
        setStep(2);
      }} />
    );
  }

  if (step === 2 && formData) {
    return (
      <RegisterFinalizeStep
        {...formData}
        onSuccess={() => {
          onSuccess();
          navigate('/chat');
        }}
      />
    );
  }

  return null;
};

function ChatApp({ userId, crypto }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatList, setChatList] = useState([]);

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

  useEffect(() => {
    fetchChats();
  }, [userId]);

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

  return (
    <div className="messenger">
      <h2>Добро пожаловать, {userId}</h2>
      <AddContactForm currentUser={userId} onContactAdded={fetchChats} />
      <ContactList currentUser={userId} onStartChat={(id) => setSelectedChat({ userId: id })} />
      <ChatList chats={chatList} onSelect={selectChat} />
      {selectedChat && (
        <ChatWindow
          selectedChat={selectedChat}
          messages={chatMessages}
          message={message}
          onMessageChange={setMessage}
          onSend={sendMessage}
        />
      )}
    </div>
  );
}

function App() {
  const [crypto, setCrypto] = useState(null);
  const [userId, setUserId] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const cm = new CryptoManager();
    setCrypto(cm);

    const savedUser = localStorage.getItem('phantom_username');
    if (savedUser) {
      setUserId(savedUser);
      setLoggedIn(true);
    }
  }, []);

  const handleAuthSuccess = () => {
    const savedUser = localStorage.getItem('phantom_username');
    if (savedUser) {
      setUserId(savedUser);
      setLoggedIn(true);
    }
  };

  if (!crypto) return <div>Загрузка криптографии...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to={loggedIn ? "/chat" : "/login"} />} />
        <Route path="/register" element={<RegisterFlow onSuccess={handleAuthSuccess} />} />
        <Route path="/login" element={<AuthTabs onSuccess={handleAuthSuccess} />} />
        <Route path="/chat" element={loggedIn ? <ChatApp userId={userId} crypto={crypto} /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;