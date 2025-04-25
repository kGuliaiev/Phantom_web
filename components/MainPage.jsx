import React, { useEffect, useState, useRef }     from 'react';
import { useNavigate }                            from 'react-router-dom';


import {
  Layout, Menu, Badge, Button, Tabs, List, notification,
  Avatar, Input, Modal, message as antdMessage, 
  Tooltip
}                                                 from 'antd';

import {
  UserOutlined,
  MessageOutlined,
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  BellOutlined, 
  LogoutOutlined
}                                                 from '@ant-design/icons';

import { clearAllMessagesForContact, getMessagesByReceiverId,
  updateMessageStatusRecord, openDB }                     from '../utils/dbMessages';
import { cryptoManager }                          from '../crypto/CryptoManager';
import {Messages}                                 from './Messages';
import { API }                                    from '../src/config.js';
import { DB_NAME, DB_VERSION, STORE_KEYS,
  STORE_MESSAGES, STORE_HISTORY }                 from '../src/config.js';
import socketManager                              from '../src/socketManager';
import '../src/App.css';

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;

const MainPage = () => {
  const navigate                              = useNavigate();
  const [onlineUsers, setOnlineUsers]         = useState([]);
  const [selectedTab, setSelectedTab]         = useState('contacts');
  const [selectedChat, setSelectedChat]       = useState(null);
  const selectedChatRef                       = useRef(null);
  const [messageValue, setMessageValue]       = useState('');
  const [contacts, setContacts]               = useState([]);
  const [chats]                               = useState([]);
  const [messages]                            = useState([]);
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [isModalVisible, setIsModalVisible]   = useState(false);
  const [identifierInput, setIdentifierInput] = useState('');
  const [nicknameInput, setNicknameInput]     = useState('');
  const [checking, setChecking]               = useState(false);
  const [adding, setAdding]                   = useState(false);
  const [isIdentifierValid, setIsIdentifierValid] = useState(false);
  const [isConnected, setIsConnected]         = useState(false);
  const identifierInputRef                    = React.useRef(null);
  const nicknameInputRef                      = React.useRef(null);
  const contactsRef                           = useRef([]);
  const [unreadCounts, setUnreadCounts]       = useState({});
  const [totalUnread,   setTotalUnread]       = useState(0);
  
  const cryptoM = cryptoManager;

  const token         = localStorage.getItem('token');
  const usernameHash  = localStorage.getItem('usernameHash');
  const passwordHash  = localStorage.getItem('passwordHash');
  const credHash      = localStorage.getItem('credHash');
  const identifier    = localStorage.getItem('identifier');
  const userId        = localStorage.getItem('userId');
  const nickname      = localStorage.getItem('nickname');


  //console.log('💾 localStorage при старте (MainPage.jsx):', { token, usernameHash, passwordHash, credHash, identifier, userId, nickname });


  // ---------vvvvvvvvv------РАБОТА С КОНТАКТАМИ------------vvvvvvvvv-----------
  // Загрузка контактов с сервера
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
        antdMessage.error('Токен недействителен, требуется повторная авторизация');
        localStorage.clear();
        navigate('/logout');
        return;
      }

      if (!response.ok) {
        throw new Error('Некорректный ответ сервера');
      }

      setContacts(data);
      await recalcUnread();
      const encrypted = await cryptoM.encryptData(JSON.stringify(data), credHash);
      localStorage.setItem('contactsEncrypted', encrypted);
      //await recalcUnread(encrypted);
      
    } catch (error) {
      console.error('Ошибка загрузки контактов:', error);
      antdMessage.error('Не удалось загрузить контакты');
    }
    
  };

  // Загрузка зашифрованных контактов из localStorage
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

  // Сохранение зашифрованных контактов в localStorage
  const saveEncryptedContacts = async (data, key) => {
    if (!Array.isArray(data)) {
      console.warn('❗️Попытка сохранить невалидные контакты:', data);
      return;
    }
    const encrypted = await cryptoM.encryptData(JSON.stringify(data), key);
    localStorage.setItem('contactsEncrypted', encrypted);
  };

  //Проверка идентификатора пользователя на сервере
  const handleCheckIdentifier = async () => {
    if (!identifierInput) return antdMessage.warning('Введите ID пользователя');

    if (identifierInput === identifier) {
        antdMessage.warning('Нельзя добавить самого себя');
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
          nicknameInputRef.current?.focus(); // <- не срабатывает, проверить
        }, 100);
        setIsIdentifierValid(true);
        antdMessage.success(`Пользователь найден: ${data.nickname}`);
      } else {
        antdMessage.error(data.message || 'Пользователь не найден');
        setIsIdentifierValid(false);
      }
    } catch (error) {
      console.error('Ошибка при проверке идентификатора:', error);
      antdMessage.error('Ошибка при проверке идентификатора');
      setIsIdentifierValid(false);
    } finally {
      setChecking(false);
    }
  };

  //Добавление контакта
  const handleAddContact = async () => {
    if (!identifierInput || !nicknameInput) {
      return antdMessage.warning('Введите ID и никнейм');
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
          owner:      identifier,
          contactId:  identifierInput,
          nickname:   nicknameInput
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
        socketManager.emit('identify', {
          identifier:   localStorage.getItem('identifier'),
          usernameHash: localStorage.getItem('usernameHash'),
          token:        localStorage.getItem('token'),
        });
        console.log('📡 Повторная отправка identify после добавления контакта');
        antdMessage.success('Контакт добавлен');
        
        // Убедимся, что вызов setIsModalOpen(false) присутствует только один раз
        setIsModalOpen(false);
        setIsModalVisible(false);
        setIdentifierInput('');
        setNicknameInput('');
        setIsIdentifierValid(false);
      } else {
        antdMessage.warning('Контакт добавлен, но список не получен');
      }
    }
      catch (error) {
      console.error('Ошибка добавления:', error);
      antdMessage.error('Ошибка при добавлении');
    } finally {
      setAdding(false);
    }
  };
  
  //Удаление контакта
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
          setIsModalOpen(false);
          setIsModalVisible(false);
          if (selectedChat?.contactId === contactId) setSelectedChat(null);
          antdMessage.success('Контакт удалён');
          setIsModalOpen(false);
        } catch (err) {
          console.error('Ошибка при удалении контакта:', err);
          antdMessage.error('Ошибка при удалении');
        }
      }
    });
  };

  // Прогрузка контактов при загрузке страницы
  useEffect(() => {
    loadContactsFromServer();
    loadEncryptedContacts();
    // Dump all stored messages for inspection
    (async () => {
      const db = await openDB();
      const tx = db.transaction(STORE_MESSAGES, 'readonly');
      const store = tx.objectStore(STORE_MESSAGES);
      const request = store.getAll();
      request.onsuccess = () => {
        console.group('IndexedDB: All messages');
        console.table(request.result);
        console.groupEnd();
      };
    })();
  }, []);
 
  useEffect(() => {
    if (identifierInput.length === 8) {
      handleCheckIdentifier();
    }
  }, [identifierInput]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);
  // ---------^^^^^^^^^^------РАБОТА С КОНТАКТАМИ------------^^^^^^^^^^^-----------




  // ---------vvvvvvvvv------ПРОСЧЕТ НОВЫХ СООБЩЕНИЙ------------vvvvvvvvv-----------
const recalcUnread = async () => {
  // 1. Load all messages from store
  const db = await openDB();
  const tx = db.transaction(STORE_MESSAGES, 'readonly');
  const store = tx.objectStore(STORE_MESSAGES);
  const allMessages = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // 2. Filter only delivered messages from contacts (not self)
  const delivered = allMessages.filter(m => m.status === 'delivered' && m.senderId !== userId);

  // 3. Count delivered by senderId
  const groupCounts = delivered.reduce((acc, msg) => {
    acc[msg.senderId] = (acc[msg.senderId] || 0) + 1;
    return acc;
  }, {});

  // 4. Map counts to contacts array, defaulting zero
  const counts = {};
  for (const contact of contacts) {
    counts[contact.contactId] = groupCounts[contact.contactId] || 0;
  }

  // 5. Total unread
  const allUnseenMess = Object.values(counts).reduce((sum, n) => sum + n, 0);

  // 6. Update state and show feedback
  setUnreadCounts(counts);
  setTotalUnread(allUnseenMess);
  //antdMessage.success(`Обновлен просчет бейджей: всего непрочитанных сообщений ${allUnseenMess}`);
};

useEffect(() => {
  const handleStatusUpdate = () => recalcUnread();
  window.addEventListener('messageStatusUpdated', handleStatusUpdate);
  return () => window.removeEventListener('messageStatusUpdated', handleStatusUpdate);
}, [contacts, selectedChat]);

 useEffect(() => {
     // сразу же пересчитываем
     recalcUnread();

     // при поступлении любого нового события — тоже
     socketManager.on('message',                recalcUnread);
     socketManager.on('newMessage',             recalcUnread);
     socketManager.on('messageAttributeChanged', recalcUnread);
    window.addEventListener('messagesUpdated',  recalcUnread);
 
     return () => {
       socketManager.off('message',                recalcUnread);
       socketManager.off('newMessage',             recalcUnread);
       socketManager.off('messageAttributeChanged', recalcUnread);
       window.removeEventListener('messagesUpdated', recalcUnread);
     };
   }, [contacts, selectedChat]);

// Listen for message status updates (delivered, read, etc.) to trigger recalcUnread
useEffect(() => {
  const handleStatusUpdate = () => recalcUnread();
  window.addEventListener('messageStatusUpdated', handleStatusUpdate);
  return () => window.removeEventListener('messageStatusUpdated', handleStatusUpdate);
}, [contacts, selectedChat, identifier]);
  // ---------^^^^^^^^^^------ПРОСЧЕТ НОВЫХ СООБЩЕНИЙ------------^^^^^^^^^^^-----------

  
  
  // ---------vvvvvvvvv------ПОЛУЧЕНИЕ НОВОГО СООБЩЕНИЯ------------vvvvvvvvv-----------
  // Регистрируем обработчик нового сообщения один раз при монтировании MainPage
// useEffect(() => {
//   const handleNewMessage = async (message) => {
//    // console.log('MainPage: Получено новое сообщение:', message);

//     // Определяем sender по sender или senderId
//     const senderId = message.sender || message.senderId;

//     // Ищем отправителя в актуальном списке контактов из ref
//     const senderContact = contactsRef.current.find(contact =>
//       String(contact.contactId).toLowerCase() === String(senderId).toLowerCase()
//     );

//     // Если найден nickname, используем его, иначе senderId или "Неизвестный"
//     const senderName = senderContact && senderContact.nickname 
//       ? senderContact.nickname 
//       : (senderId || 'Неизвестный');
//     showNewMessageNotification(`Новое сообщение от ${senderName}`, message.text);
//     message.antdMessage ('vvvvvvvvv------ПОЛУЧЕНИЕ НОВОГО СООБЩЕНИЯ------------vvvvvvvvv');
//   };

//   socketManager.on('newMessage', handleNewMessage);
//   return () => {
//     socketManager.off('newMessage', handleNewMessage);
//   };
// }, []); // регистрируем один раз

// Typewriter effect for notification text


const showNewMessageNotification = (title, description) => {
  notification.open({
    message: title,
    description: description,
    duration: 3
  });
};

  // ---------^^^^^^^^^^------ПОЛУЧЕНИЕ НОВОГО СООБЩЕНИЯ------------^^^^^^^^^^^-----------



  // ---------vvvvvvvvv-------ONLINE/OFFLINE работа с сервером-----------vvvvvvvvv-----------
  //Соединение с сервером и обработка событий
  useEffect(() => {
    let intervalId;
    const handleConnect = () => {
      console.log('✅ Соединение с сервером установлено');
      antdMessage.success('Соединение с сервером установлено');
      setIsConnected(true);

      const identifier    = localStorage.getItem('identifier');
      const usernameHash  = localStorage.getItem('usernameHash');
      const token         = localStorage.getItem('token');
  
      if (identifier && usernameHash && token) {
        socketManager.emit('identify', { identifier, usernameHash, token });
  
        intervalId = setInterval(() => {
          socketManager.emit('identify', {
            identifier:   localStorage.getItem('identifier'),
            usernameHash: localStorage.getItem('usernameHash'),
            token:        localStorage.getItem('token'),
          });
          console.log('⏱️ Повторная отправка identify для поддержки онлайн-статуса');
        }, 60000);
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
      console.log('📡 Получен список онлайн-пользователей:', updated);
    };
  
    socketManager.on('connect',      handleConnect);
    socketManager.on('disconnect',   handleDisconnect);
    socketManager.on('onlineUsers',  handleOnlineUsers);
    socketManager.on('userOnline',   ({ identifier: changedId, isOnline }) => {
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
// ---------^^^^^^^^^^------ONLINE/OFFLINE работа с сервером------------^^^^^^^^^^^-----------


// ---------vvvvvvvvv-------УДАЛЕННОЕ УДАЛЕНИЕ СООБЩЕНИЙ-----------vvvvvvvvv-----------
// Обработчик для команды локального удаления для абонента Б:
socketManager.on('chatClearRemote', async ({ contactId }) => {
  console.log('🗑️ Messages: Получено событие chatClearRemote для удаления переписки. Полученный contactId:', contactId);
  try {
      await clearAllMessagesForContact(identifier, contactId);
      if (selectedChat && selectedChat.contactId === contactId) {
          setMessages([]);
      }
      antdMessage.success('Локальное удаление переписки выполнено');
      socketManager.emit('chatClearedAck', { contactId, from: identifier });
      console.log(`DEBUG: Подтверждение удаления отправлено с абонента ${identifier} для контакта ${contactId}`);
      // Recalculate unread and update badges after clearing chat
      await recalcUnread();
      window.dispatchEvent(new CustomEvent('messagesUpdated'));
  } catch (error) {
      console.error('Ошибка при удалении переписки локально:', error);
  }
});

// Обработчик для уведомления об удалении на сервере (для абонента Б)
socketManager.on('clearServerSuccess', ({ initiator, recipient }) => {
  if (identifier === recipient) {
    antdMessage.success('Удаление на сервере выполнено');
  }
});

// Обработчик подтверждения от абонента А (для абонента Б)
socketManager.on('chatClearedAck', ({ contactId, from }) => {
  // Если текущий пользователь является абонентом Б, получив подтверждение от А:
  // (Оставлено без изменений, возможно требует доработки логики)
});
// ---------^^^^^^^^^^------УДАЛЕННОЕ УДАЛЕНИЕ СООБЩЕНИЙ------------^^^^^^^^^^^-----------

  
  return () => {
    clearInterval(intervalId);
    socketManager.off('connect',     handleConnect);
    socketManager.off('disconnect',  handleDisconnect);
    socketManager.off('onlineUsers', handleOnlineUsers);
    socketManager.off('userOnline');
    socketManager.off('chatCleared');
    socketManager.off('clearServerSuccess');
    socketManager.off('chatClearedAck');
  };
  }, []);


// ---------vvvvvvvvv-------Выход из система и очистка localStorage-----------vvvvvvvvv-----------
  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
    console.log('🔑 Данные очищены из localStorage');
    antdMessage.success('🔑 Данные очищены из localStorage');
  };
  
  const resendPendingMessages = async () => {
    const dbOpenRequest = indexedDB.open(DB_NAME, DB_VERSION);
    const db = await new Promise((resolve, reject) => {
      dbOpenRequest.onsuccess = () => resolve(dbOpenRequest.result);
      dbOpenRequest.onerror = () =>   reject(dbOpenRequest.error);
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
              senderId:   msg.sender,
              receiverId: msg.receiver,
              chatId:     msg.chatId || `${msg.sender}_${msg.receiver}`,
              encryptedContent: msg.encrypted,
              iv:         msg.encrypted.slice(0, 16)
            })
          });
          const data = await response.json();
          if (response.ok && data?.newMessage?.messageId) {
            await updateMessageStatus(msg.id, 'sent');
            socketManager.emit('message', {
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
          <div>
          <Badge count={totalUnread}  style={{ marginLeft: 40 }}>
            <BellOutlined />
          </Badge>
          </div>
        </div>

        <div className="header-right">
        <Button
          type="primary"
          danger
          icon={<LogoutOutlined />}
          onClick={handleLogout}
        >
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
          renderItem={(contact) => (
            <List.Item
            actions={[
              // бейдж с количеством непрочитанных (отображается только если > 0)
              unreadCounts[contact.contactId] > 0 && (
                <Badge count={unreadCounts[contact.contactId] || 0} key={contact.contactId}>
                
              </Badge>
              ),
              // кнопка удаления
              <Tooltip title="Удалить контакт" key="delete">
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteContact(item.contactId)}
                />
              </Tooltip>
            ]}
            onClick={() => {
              setSelectedChat(contact);
              setSelectedTab('chats');
              recalcUnread();
              setTimeout(() => {
                const input = document.querySelector('textarea');
                if (input) input.focus();
              }, 100);
            }}
            className={`list-item ${
              selectedChat?.contactId === contact.contactId ? 'selected-chat' : ''
            }`}
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
                        backgroundColor: onlineUsers.includes(String(contact.contactId)) ? 'green' : 'red',
                      }}
                      title={onlineUsers.includes(String(contact.contactId)) ? 'Онлайн' : 'Оффлайн'}
                    />
                    <span>{contact.nickname || contact.contactId}</span>
                    {/* {item.publicKey && <span>🔒</span>} */}
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
                onMessagesUpdate={recalcUnread}
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


export default MainPage;
    