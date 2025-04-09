import React, { useEffect, useState, useRef }     from 'react';
import { useNavigate }                    from 'react-router-dom';

import {
  Layout, Menu, Button, Tabs, List, Avatar, Input, Modal, message, Tooltip
}                              from 'antd';

import {
  UserOutlined,
  MessageOutlined,
  LogoutOutlined,
  SendOutlined,
  PlusOutlined,
  DeleteOutlined
}                               from '@ant-design/icons';


import { cryptoManager }        from '../crypto/CryptoManager';
import { API }                  from '../src/config';
import socket                   from '../src/socket';

import '../src/App.css';
import {Messages}               from './Messages';

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;

const MainPage = () => {
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedTab, setSelectedTab] = useState('contacts');
  const [selectedChat, setSelectedChat] = useState(null);
  const selectedChatRef = useRef(null);
  const [messageValue, setMessageValue] = useState('');
  const [contacts, setContacts] = useState([]);
  const [chats] = useState([]);
  const [messages] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [identifierInput, setIdentifierInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [isIdentifierValid, setIsIdentifierValid] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const identifierInputRef  = React.useRef(null);
  const nicknameInputRef    = React.useRef(null);

  const token         = localStorage.getItem('token');
  const usernameHash  = localStorage.getItem('usernameHash');
  const passwordHash  = localStorage.getItem('passwordHash');
  const credHash      = localStorage.getItem('credHash');
  const identifier    = localStorage.getItem('identifier');
  const userId        = localStorage.getItem('userId');
  const nickname      = localStorage.getItem('nickname');
  

  //console.log('💾 localStorage при старте (MainPage.jsx):', { token, usernameHash, passwordHash, credHash, identifier, userId, nickname });

  const cryptoM = cryptoManager;

  const saveEncryptedContacts = async (data, key) => {
    if (!Array.isArray(data)) {
      console.warn('❗️Попытка сохранить невалидные контакты:', data);
      return;
    }
    const encrypted = await cryptoM.encryptData(JSON.stringify(data), key);
    localStorage.setItem('contactsEncrypted', encrypted);
  };

  const loadContactsFromServer = async () => {
    if (!identifier) return;
    try {
      const response = await fetch(API.getContactsURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          token,
          identifier,
        })
      });

      const data = await response.json();
      //console.log('📥 Ответ сервера:', data);
      
      if (response.status === 401) {
        message.error('Токен недействителен, требуется повторная авторизация');
        localStorage.clear();
        navigate('/logout');
        return;
      }

      if (!response.ok) {
        throw new Error('Некорректный ответ сервера');
      }

      setContacts(data);

      const encrypted = await cryptoM.encryptData(JSON.stringify(data), credHash);
      localStorage.setItem('contactsEncrypted', encrypted);
      
    } catch (error) {
      console.error('Ошибка загрузки контактов:', error);
      message.error('Не удалось загрузить контакты');
    }
  };

  const loadEncryptedContacts = async () => {
    const encrypted = localStorage.getItem('contactsEncrypted');
  
    if (
      !encrypted ||
      typeof encrypted !== 'string' ||
      encrypted === 'undefined' ||
      encrypted.length < 10 ||
      /[^A-Za-z0-9+/=]/.test(encrypted) // содержит недопустимые символы
    ) {
      //console.warn('🧹 Удаляю битую строку contactsEncrypted:', encrypted);
      localStorage.removeItem('contactsEncrypted');
      return;
    }
  
    try {
      const decrypted = await cryptoM.decryptData(encrypted, credHash);
      const parsed = JSON.parse(decrypted);
      if (Array.isArray(parsed)) {
        setContacts(parsed);
      } else {
        throw new Error('Расшифрованные данные не являются массивом');
      }
    } catch (err) {
      console.warn('Не удалось расшифровать контакты:', err);
      localStorage.removeItem('contactsEncrypted');
    }
  };

  + useEffect(() => {
       selectedChatRef.current = selectedChat;
     }, [selectedChat]);


  useEffect(() => {
    loadContactsFromServer();
    loadEncryptedContacts();
  }, []);

  useEffect(() => {
    if (identifierInput.length === 8) {
      handleCheckIdentifier();
    }
  }, [identifierInput]);

  useEffect(() => {
    let intervalId;
    const handleConnect = () => {
      console.log('✅ Соединение с сервером установлено');
      setIsConnected(true);
      
      const identifier    = localStorage.getItem('identifier');
      const usernameHash  = localStorage.getItem('usernameHash');
      const token         = localStorage.getItem('token');
  
      if (identifier && usernameHash && token) {
        socket.emit('identify', { identifier, usernameHash, token });
  
        intervalId = setInterval(() => {
          socket.emit('identify', {
            identifier:   localStorage.getItem('identifier'),
            usernameHash: localStorage.getItem('usernameHash'),
            token:        localStorage.getItem('token'),
          });
          console.log('⏱️ Повторная отправка identify для поддержки онлайн-статуса');
        }, 600000);
      }
    };
  
    const handleDisconnect = () => {
      console.warn('❌ Потеря соединения с сервером');
      setIsConnected(false);
    };
  
    const handleOnlineUsers = (data) => {
      const updated = data.includes(identifier) ? data : [...data, identifier];
      setIsConnected(true);
      setOnlineUsers(updated);
      console.log('🧾 Обновлён список онлайн-пользователей:', updated);
      console.log('📡 Получен список онлайн-пользователей:', updated);
    };
  
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('onlineUsers', handleOnlineUsers);
    socket.on('userOnline', ({ identifier: changedId, isOnline }) => {
      setOnlineUsers(prev => {
        const isCurrentlyOnline = prev.includes(changedId);
        if ((isOnline && isCurrentlyOnline) || (!isOnline && !isCurrentlyOnline)) {
          return prev; // Статус не изменился — не обновляем
        }

        const updatedSet = new Set(prev);
        if (isOnline) {
          updatedSet.add(changedId);
        } else {
          updatedSet.delete(changedId);
        }

        const contact = contacts.find(c => c.contactId === changedId);
        const nickname = contact?.nickname || changedId;

        console.log(`🔄 Изменение статуса: ${changedId} - ${nickname} стал ${isOnline ? 'онлайн' : 'оффлайн'}`);

        return Array.from(updatedSet);
      });
    });
  
    return () => {
      clearInterval(intervalId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('onlineUsers', handleOnlineUsers);
      socket.off('userOnline');
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };
  
  const resendPendingMessages = async () => {
    const dbOpenRequest = indexedDB.open('SecureMessengerDB', 1);
    const db = await new Promise((resolve, reject) => {
      dbOpenRequest.onsuccess = () => resolve(dbOpenRequest.result);
      dbOpenRequest.onerror = () => reject(dbOpenRequest.error);
    });

    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = async () => {
      const allMessages = getAllRequest.result;
      const pending = allMessages.filter(msg => msg.status === 'sent');
      for (const msg of pending) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(API.sendMessageURL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              senderId: msg.sender,
              receiverId: msg.receiver,
              chatId: msg.chatId || `${msg.sender}_${msg.receiver}`,
              encryptedContent: msg.encrypted,
              iv: msg.encrypted.slice(0, 16)
            })
          });
          const data = await response.json();
          if (response.ok && data?.newMessage?.messageId) {
            await updateMessageStatus(msg.id, 'server');
            socket.emit('message', {
              to: msg.receiver,
              encrypted: msg.encrypted,
              timestamp: msg.timestamp,
              messageId: data.newMessage.messageId
            });
            console.log(`📤 Повторно отправлено сообщение ${msg.id}`);
          }
        } catch (err) {
          console.warn('⚠️ Не удалось повторно отправить сообщение:', msg.id, err);
        }
      }
    };
  };

  const handleCheckIdentifier = async () => {
    if (!identifierInput) return message.warning('Введите ID пользователя');

    if (identifierInput === identifier) {
        message.warning('Нельзя добавить самого себя');
        setIsIdentifierValid(false);
        return;
      }
    
    setChecking(true);
    try {
      const res = await fetch(`${API.checkUserURL}?identifier=${identifierInput}`);
      const data = await res.json();
      if (res.ok && data?.publicKey) {
        setNicknameInput(data.nickname || '');
        setTimeout(() => {
          nicknameInputRef.current?.focus();
        }, 100);
        setIsIdentifierValid(true);
        message.success(`Пользователь найден: ${data.nickname}`);
      } else {
        message.error(data.message || 'Пользователь не найден');
        setIsIdentifierValid(false);
      }
    } catch (error) {
      console.error('Ошибка при проверке идентификатора:', error);
      message.error('Ошибка при проверке идентификатора');
      setIsIdentifierValid(false);
    } finally {
      setChecking(false);
    }
  };

  const handleAddContact = async () => {
    if (!identifierInput || !nicknameInput) {
      return message.warning('Введите ID и никнейм');
    }

    setAdding(true);
    try {
      const res = await fetch(API.addContactURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          owner: identifier,
          contactId: identifierInput,
          nickname: nicknameInput
        })
      });

      const data = await res.json();
      console.log('🔁 Получен ответ от сервера (добавлен контакт):', data);
      if (!Array.isArray(data.contacts)) {
        throw new Error("Сервер вернул некорректный список контактов");
      }
      
      if (res.ok && Array.isArray(data.contacts)) {
        await saveEncryptedContacts(data.contacts, credHash);
      setContacts(data.contacts);
      const updatedIds = data.contacts.map(c => c.contactId);
      if (socket && typeof socket.emit === 'function') {
        socket.emit('identify', {
          identifier:   localStorage.getItem('identifier'),
          usernameHash: localStorage.getItem('usernameHash'),
          token:        localStorage.getItem('token'),
        });
        console.log('📡 Повторная отправка identify после добавления контакта');
      }
        message.success('Контакт добавлен');
        setIsModalOpen(false);
        setIdentifierInput('');
        setNicknameInput('');
        setIsIdentifierValid(false);
      } else {
        message.warning('Контакт добавлен, но список не получен');
      }
    }
      catch (error) {
      console.error('Ошибка добавления:', error);
      message.error('Ошибка при добавлении');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteContact = (contactId) => {
    Modal.confirm({
      title: 'Удалить контакт?',
      onOk: async () => {
        try {
          const res = await fetch(`${API.deleteContactURL}/${identifier}/${contactId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (!res.ok) throw new Error();
          

          const updated = await res.json();
          if (!Array.isArray(updated)) {
            throw new Error('Некорректный ответ от сервера');
          }
          
          await saveEncryptedContacts(updated, credHash);
          setContacts(updated);

          if (selectedChat?.contactId === contactId) setSelectedChat(null);
          message.success('Контакт удалён');
        } catch (err) {
          console.error('Ошибка при удалении контакта:', err);
          message.error('Ошибка при удалении');
        }
      }
    });
  };

  const handleSend = () => {
    if (messageValue.trim()) {
      console.log('Отправка сообщения:', messageValue);
      setMessageValue('');
    }
  };

  return (
    <Layout className="main-layout" style={{ minHeight: '100vh' }}>
      <Header className="main-header">
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: isConnected ? 'green' : 'red',
            }}
            title={isConnected ? 'Онлайн (соединение есть)' : 'Оффлайн (соединение отсутствует)'}
          />
          <div style={{ fontWeight: 'bold', color: 'white' }}>
            {nickname} ({identifier})
          </div>
        </div>

        <div className="header-right">
          <Button type="primary" danger onClick={() => navigate('/logout')}>
            Выйти
          </Button>
        </div>
      </Header>

      <Layout>
        <Sider width={260} className="sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', marginBottom: 8 }}>
          <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            Контакты ({contacts.filter(c => onlineUsers.includes(c.contactId)).length}/{contacts.length})
          </div>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              setIsModalOpen(true);
              setTimeout(() => {
                identifierInputRef.current?.focus();
              }, 100);
            }}
          />
        </div>
        <List
          itemLayout="horizontal"
          dataSource={contacts}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Tooltip title="Удалить контакт" key="delete">
                  <Button type="text" icon={<DeleteOutlined />} onClick={() => handleDeleteContact(item.contactId)} />
                </Tooltip>
              ]}
              onClick={() => {
                setSelectedChat(item);
                setSelectedTab('chats');
                setTimeout(() => {
                  const input = document.querySelector('textarea');
                  if (input) input.focus();
                }, 100);
              }}
              className={`list-item ${selectedChat?.contactId === item.contactId ? 'selected-chat' : ''}`}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={<UserOutlined />}
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                }
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: onlineUsers.includes(String(item.contactId)) ? 'green' : 'red',
                      }}
                      title={onlineUsers.includes(String(item.contactId)) ? 'Онлайн' : 'Оффлайн'}
                    />
                    <span>{item.nickname || item.contactId}</span>
                    {item.publicKey && <span>🔒</span>}
                  </div>
                }
              />
            </List.Item>
          )}
        />
        </Sider>

        <Content className="chat-area">
          <Tabs activeKey={selectedTab} onChange={setSelectedTab}>
            <Tabs.TabPane tab="Чаты" key="chats">
              <Messages
                selectedChat={selectedChat}
                identifier={identifier}
                nickname={nickname}
                onlineUsers={onlineUsers}
                crypto={crypto}
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab="Задачи" key="tasks">
              <div style={{ padding: 16 }}>
                <h3>Планировщик задач</h3>
                <p>Здесь будет список задач, управление приоритетами и напоминания.</p>
              </div>
            </Tabs.TabPane>
            <Tabs.TabPane tab="Документы" key="documents">
              Документы (в разработке)
            </Tabs.TabPane>
            <Tabs.TabPane tab="Заметки" key="notes">
              Заметки (в разработке)
            </Tabs.TabPane>
            <Tabs.TabPane tab="Встречи" key="meetings">
              Встречи (в разработке)
            </Tabs.TabPane>
          </Tabs>
        </Content>
      </Layout>

      <Modal
        open={isModalOpen}
        title="Добавить контакт"
        onCancel={() => {
          setIsModalOpen(false);
          setIdentifierInput('');
          setNicknameInput('');
          setIsIdentifierValid(false);
        }}
        onOk={handleAddContact}
        okText="Добавить"
        confirmLoading={adding}
        okButtonProps={{ disabled: !isIdentifierValid }}
      >
        <Input.Group compact style={{ marginBottom: 8 }}>
        <Input
          ref={identifierInputRef}
          style={{ width: 'calc(100% - 100px)' }}
          placeholder="Идентификатор пользователя"
          value={identifierInput}
          onChange={(e) => {
            const input = e.target.value.toUpperCase();
            setIdentifierInput(input);
            setIsIdentifierValid(false);
          }}
          onPressEnter={() => {
            if (identifierInput.length === 8) {
              handleCheckIdentifier();
            }
          }}
        />
        <Button loading={checking} onClick={handleCheckIdentifier} type="primary">
            Найти
        </Button>
        </Input.Group>
        {isIdentifierValid && (
          <Input
            placeholder="Никнейм"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            onPressEnter={() => {
              if (isIdentifierValid) handleAddContact();
            }}
          />
        )}
      </Modal>
    </Layout>
  );
};

// TODO: Если логика регистрации реализована в другом месте, добавить:
// socket.emit('identify', { identifier, usernameHash, token });
export default MainPage;

// Обработчик изменения статуса: сообщение доставлено
      // socket.on('messageDelivered', ({ messageId }) => {
      //   setMessages((prevMessages) =>
      //     prevMessages.map((msg) =>
      //       msg.id === messageId ? { ...msg, status: 'delivered' } : msg
      //     )
      //   );
      //   // Временно выводим уведомление на клиенте и логируем в консоль
      //   antdMessage.info(`Статус сообщения ${messageId} изменен на "delivered" (API: ${API.sendMessageURL})`);
      //   console.log(`DEBUG: Сообщение ${messageId} статус обновлен до delivered, получено через API: ${API.sendMessageURL}`);
      // });

      // // Обработчик изменения статуса: сообщение получено
      // socket.on('messageReceived', ({ messageId }) => {
      //   setMessages((prevMessages) =>
      //     prevMessages.map((msg) =>
      //       msg.id === messageId ? { ...msg, status: 'received' } : msg
      //     )
      //   );
      //   // Временно выводим уведомление на клиенте и логируем в консоль
      //   antdMessage.info(`Статус сообщения ${messageId} изменен на "received" (API: ${API.receiveMessagesURL})`);
      //   console.log(`DEBUG: Сообщение ${messageId} статус обновлен до received, получено через API: ${API.receiveMessagesURL}`);
      // });

      // // Обработчик изменения статуса: сообщение прочитано
      // socket.on('messageRead', ({ messageId }) => {
      //   setMessages((prevMessages) =>
      //     prevMessages.map((msg) =>
      //       msg.id === messageId ? { ...msg, status: 'read' } : msg
      //     )
      //   );
      //   // Временно выводим уведомление на клиенте и логируем в консоль
      //   antdMessage.info(`Статус сообщения ${messageId} изменен на "read" (API: ${API.sendMessageURL})`);
      //   console.log(`DEBUG: Сообщение ${messageId} статус обновлен до read, обновлено через API: ${API.sendMessageURL}`);
      // });

    socket.on('newMessage', async (message) => {
      await saveEncryptedMessageToDB(message);
      showNotification('Новое сообщение', message.text);
      setMessages((prev) => [...prev, message]);
      scrollToFirstUnreadMessage();
      socket.emit('messageRead', { messageId: message.id });
    });

     socket.on('chatClearedAck', ({ contactId, clearedBy, from }) => {
        console.log(`📨 chatClearedAck получен от ${from} (очищено для contactId=${contactId})`);
        // Если текущий выбранный чат соответствует полученному contactId, удаляем локальные сообщения и уведомляем инициатора.
        if (selectedChatRef.current && contactId === selectedChatRef.current.contactId) {
          setMessages([]);
          antdMessage.success(`Абонент ${from} удалил переписку локально`);
        }
        // Отправляем уведомление инициатору, если необходимо
        const target = onlineUsers.get(clearedBy);
        if (target?.socketId) {
          io.to(target.socketId).emit('chatClearedAck', { contactId, from });
        }
      });