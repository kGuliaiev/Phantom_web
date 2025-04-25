import { v4 as uuidv4 }                   from 'uuid';
import React, { useEffect, 
  useState, useRef }                      from 'react';
import axios                              from 'axios';
import { Input, Button, List, 
  message as antdMessage, Tooltip, 
  notification, Modal }                   from 'antd';
  import { SendOutlined, 
    CheckOutlined, DeleteOutlined }       from '@ant-design/icons';
import dayjs                              from 'dayjs';
import relativeTime                       from 'dayjs/plugin/relativeTime';
import isToday                            from 'dayjs/plugin/isToday';
import isYesterday                        from 'dayjs/plugin/isYesterday';
import weekday                            from 'dayjs/plugin/weekday';
import isSameOrAfter                      from 'dayjs/plugin/isSameOrAfter';
import 'dayjs/locale/ru';


import { saveMessage, getMessagesByReceiverId, 
  deleteMessageById, clearAllMessages, 
  clearAllMessagesForContact,
  saveStatusHistory, getStatusHistory,
  updateMessageStatusRecord
}           from '../utils/dbMessages';
import { cryptoManager }                  from '../crypto/CryptoManager';

import { API }                            from '../src/config';
import { DB_NAME, DB_VERSION, STORE_KEYS,
    STORE_MESSAGES, STORE_HISTORY }       from '../src/config.js';
import { logEvent }                       from '../utils/logger';
import socketManager                      from '../src/socketManager';

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);
dayjs.locale('ru');

const HIGHLIGHT_DURATION = 5000;
const userId        = localStorage.getItem('identifier');

const showNotification = (title, description) => {
  notification.open({
    message: title,
    description: description,
    duration: 3
  });
};

const { TextArea } = Input;

const Messages = ({ selectedChat, identifier, nickname, onlineUsers }) => {
  const formatTimestamp = (timestamp) => {
    const d = dayjs(timestamp);
    const now = dayjs();
    if (d.isToday()) {
      return d.format('HH:mm');
    }
    if (d.isYesterday()) {
      return `вчера в ${d.format('HH:mm')}`;
    }
    if (d.isSame(now, 'week')) {
      return `${d.format('dddd')} в ${d.format('HH:mm')}`;
    }
    if (d.year() === now.year()) {
      return `${d.format('D MMMM')} в ${d.format('HH:mm')}`;
    }
    return `${d.format('DD.MM.YY')} в ${d.format('HH:mm')}`;
  };
  const [initialIds, setInitialIds] = useState([]);
  const [newMsgIds, setNewMsgIds] = useState([]);
  const [separatorId, setSeparatorId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [highlighted, setHighlighted] = useState({});
  
  const [messageValue, setMessageValue] = useState('');
  
  const [noMessages, setNoMessages]     = useState(false);
  const [sendOnEnter, setSendOnEnter]   = useState(true);
  const [loading, setLoading]           = useState(false);

  const messagesEndRef                  = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const messagesContainer = document.querySelector('.message-list');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!selectedChat) return;
    // Сохраняем список текущих ID для определения новых сообщений при входе
    (async () => {
      const localMsgs = await getMessagesByReceiverId(selectedChat.contactId) ;
      setInitialIds(localMsgs.map(m => m.id));
    })();

    const loadMessages = async () => {
      try {
        setLoading(true);
        const localMessages = await getMessagesByReceiverId(selectedChat.contactId);
        const decrypted = await Promise.all(localMessages.map(async msg => {
          let text = '';
          try {
            text = await cryptoManager.decryptMessage(msg.encrypted, selectedChat.publicKey);
          } catch (e) { /* ignore */ }
          return { ...msg, text };
        }));
        setMessages(decrypted);
        setNoMessages(decrypted.length === 0);
      } catch (error) {
        console.error('❌ Ошибка загрузки сообщений:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();


    const fetchAndUpdateMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API.receiveMessagesURL}?receiverId=${identifier}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) throw new Error('Ошибка получения сообщений с сервера');

        const data = await res.json();
        console.log('📡 Получены новые сообщения с сервера:', data);
       // Вычисляем новые сообщения при входе в чат
       const newOnes = data.filter(msg => !initialIds.includes(msg.messageId));
       if (newOnes.length > 0) {
         // Помечаем ID и устанавливаем разделитель перед первым новым
         setNewMsgIds(newOnes.map(msg => msg.messageId));
         setSeparatorId(newOnes[0].messageId);
         // Подсветка новых сообщений на 10 секунд
         newOnes.forEach(msg => {
           setHighlighted(prev => ({ ...prev, [msg.messageId]: true }));
           setTimeout(() => {
             setHighlighted(prev => {
               const copy = { ...prev };
               delete copy[msg.messageId];
               return copy;
             });
           }, 10000);
           setTimeout(() => {
             setNewMsgIds(prev => prev.filter(id => id !== msg.messageId));
           }, 10000);
         });
       }

        for (const msg of data) {
          let decryptedText = '[Ошибка расшифровки]';
          try {
            decryptedText = await cryptoManager.decryptMessage(msg.encryptedContent, selectedChat?.publicKey);
          } catch (e) {
            console.warn('❌ Ошибка расшифровки сообщения:', e);
          }

          await saveMessage({
            id:         msg.messageId,
            senderId:   msg.senderId,
            receiverId: msg.receiverId,
            encrypted:  msg.encryptedContent,
            iv:         msg.iv,
            timestamp:  msg.timestamp,
            status:     msg.recipients?.find(r => r.userId === identifier)?.status || 'delivered'
          });
          // Вместо отдельных событий отправляем единое событие изменения атрибута сообщения для статуса "delivered" и затем "read"
          socketManager.emit('messageAttributeChanged', { messageId: msg.messageId, attribute: 'status', value: 'seen', sender:  msg.senderId });
          antdMessage.info(`🔁 fetchAndUpdateMessages: Статус сообщения ${msg.messageId} обновлен на delivered (от ${msg.senderId})`);
        }

        const updatedMessages = await getMessagesByReceiverId(selectedChat.contactId);
        const decrypted = await Promise.all(updatedMessages.map(async msg => {
          let text = '';
          try {
            text = await cryptoManager.decryptMessage(msg.encrypted, selectedChat.publicKey);
          } catch (e) { /* ignore */ }
          return { ...msg, text };
        }));
        // Подсветить уже доставленные сообщения и сразу отправить статус seen
          for (const msg of decrypted.filter(m =>
            m.senderId === selectedChat.contactId && m.status === 'delivered'
          )) {
            // локальная подсветка
            setHighlighted(prev => ({ ...prev, [msg.id]: true }));

            // обновляем статус в IndexedDB
            await updateMessageStatusRecord(msg.id, 'seen', new Date().toISOString());

            // уведомляем сервер
            socketManager.emit('messageAttributeChanged', {
              messageId: msg.id,
              attribute: 'status',
              value: 'seen',
              sender: identifier
            });

            // снять подсветку через HIGHLIGHT_DURATION
            setTimeout(() => {
              setHighlighted(prev => {
                const copy = { ...prev };
                delete copy[msg.id];
                return copy;
              });
            }, 5000);
          }
        setMessages(decrypted);
        setNoMessages(decrypted.length === 0);
      } catch (err) {
        console.error('❌ Ошибка при обновлении сообщений с сервера:', err);
      }
    };
    fetchAndUpdateMessages();


      const markMessagesAsRead = async () => {
          // Загрузить все локальные сообщения чата
          const localMessages = await getMessagesByReceiverId(selectedChat.contactId);
          // Выбрать только доставленные от этого контакта
          const toMark = localMessages.filter(msg =>
            msg.senderId === selectedChat.contactId && msg.status === 'delivered'
          );
          // Подсветить каждое на 10 секунд
          toMark.forEach(msg => {
            setHighlighted(prev => ({ ...prev, [msg.id]: true }));
            setTimeout(() => {
              setHighlighted(prev => {
                const copy = { ...prev };
                delete copy[msg.id];
                return copy;
              });
            }, 10000);
          });
          // Сразу отметить как прочитанное и уведомить сервер
          for (const msg of toMark) {
            await saveMessage({ ...msg, status: 'seen' });
            socketManager.emit('messageAttributeChanged', {
              messageId: msg.id,
              attribute: 'status',
              value: 'seen',
              sender: msg.senderId
            });
          }
          // Обновить состояние списка сообщений
          const updated = await getMessagesByReceiverId(selectedChat.contactId);
          setMessages(updated);
        };
    
    markMessagesAsRead();

    
    const handleMessage = async ({ sender, encrypted, messageId, timestamp, iv }) => {
      const senderId = sender;

      if (!selectedChat?.publicKey) return;

      await cryptoManager.importReceiverKey(selectedChat.publicKey);
      const decryptedText = await cryptoManager.decryptMessage(encrypted, selectedChat.publicKey);

      const newMsg = {
        id:         messageId,
        senderId,
        receiverId: identifier,
        encrypted,
        iv,
        timestamp,
        status:     'delivered'
      };

      await saveMessage(newMsg);
      setMessages(prev => [...prev, { ...newMsg, text: decryptedText }]);

      socketManager.emit('messageAttributeChanged', {
        messageId,
        attribute: 'status',
        value: 'delivered',
        sender: senderId
      });

      const shortId = messageId.slice(0, 4);
      const now = new Date().toLocaleString();
      console.log(`📩 ${shortId} ${senderId} → ${identifier} | статус: delivered | ${now}`);

      const chatIsOpen = selectedChat?.contactId === senderId && document.hasFocus();
      if (chatIsOpen) {
        // подсветить
            setHighlighted(prev => ({ ...prev, [messageId]: true }));

            // сохранить статус seen
            await saveMessage({ ...newMsg, status: 'seen' });

            // обновить UI
            setMessages(prev => prev.map(m =>
              m.id === messageId ? { ...m, status: 'seen' } : m
            ));

            // отправить на сервер статус seen
            socketManager.emit('messageAttributeChanged', {
              messageId,
              attribute: 'status',
              value: 'seen',
              sender: senderId
            });

            // через HIGHLIGHT_DURATION убрать подсветку
            setTimeout(() => {
              setHighlighted(prev => {
                const copy = { ...prev };
                delete copy[messageId];
                return copy;
              });
            }, HIGHLIGHT_DURATION);
      }
    };

    socketManager.on('message', handleMessage);

      // Универсальный обработчик обновлений атрибутов сообщений
      socketManager.on('messageAttributeChanged', async ({ attribute, value, messageId, sender }) => {
        if (attribute === 'status') {
          // Обновляем статус сообщения для входящих (id === messageId) 
          setMessages((prevMessages) =>
            prevMessages.map((msg) => {
              if (msg.id === messageId ) {
                return { ...msg, status: value };
              }
              return msg;
            })
          );
          // Persist the status change in IndexedDB
          await updateMessageStatusRecord(messageId, value, new Date().toISOString());
          // Логируем смену статуса сообщения в файл
          logEvent('message_status_changed', {
            messageId,
            newStatus: value,
            by: sender,
            timestamp: new Date().toISOString()
          });
          // Подсвечиваем сообщения от собеседника для статусов delivered/read
          if (value === 'delivered' && sender !== identifier) {
            setHighlighted((prev) => ({ ...prev, [messageId]: true }));
            setTimeout(() => {
              setHighlighted((prev) => {
                const copy = { ...prev };
                delete copy[messageId];
                return copy;
              });
            }, 10000);
          }
        }
      });
      

      
    return () => {
      socketManager.off('message', handleMessage);
      //socketManager.off('messageRead');
      socketManager.off('chatCleared');
      socketManager.off('chatClearedAck');
      socketManager.off('chatClearRemote');
      socketManager.off('messageAttributeChanged');
      
    };
  }, [selectedChat]);

  const handleSend = async () => {
    if (!messageValue.trim() || !selectedChat?.publicKey) return;

    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const senderId = localStorage.getItem('identifier');

    // Encrypt the message and extract iv
    let encrypted, iv;
    try {
      const result = await cryptoManager.encryptMessage(messageValue, selectedChat.publicKey);
      // If encryptMessage returns an object with iv & encrypted:
      if (result.encrypted && result.iv) {
        encrypted = result.encrypted;
        iv = result.iv;
      } else {
        encrypted = result;
        iv = btoa(encrypted.slice(0, 12));
      }
    } catch (err) {
      console.error('Ошибка при шифровании сообщения:', err);
      return antdMessage.error('Ошибка шифрования сообщения');
    }

    // Optimistic UI update & local save
    const record = {
      id: messageId,
      senderId,
      receiverId: selectedChat.contactId,
      encrypted,
      iv,
      timestamp,
      status: 'pending',
    };
    const uiMsg = { ...record, text: messageValue };
    setMessages(prev => [...prev, uiMsg]);
    await saveMessage(record);
    // Record initial pending status
    await saveStatusHistory({ messageId, status: 'pending', updatedAt: timestamp });

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(API.sendMessageURL, {
        messageId,
        senderId,
        receiverId: selectedChat.contactId,
        chatId: 'default',
        encryptedContent: encrypted,
        iv,
        timestamp,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 200 || response.status === 201) {
        // Update local status
        const { updateMessageStatusRecord } = await import('../utils/dbMessages');
        await updateMessageStatusRecord(messageId, 'sent', new Date().toISOString());
        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId ? { ...msg, status: 'sent' } : msg
          )
        );
        antdMessage.success(`Статус сообщения ${messageId} обновлён на 'sent'`);
        // Emit socket update
        socketManager.emit('messageAttributeChanged', { messageId, attribute: 'status', value: 'sent', sender: senderId, });
      }

      setMessageValue('');
    } catch (err) {
      console.error('Ошибка при отправке:', err);
      antdMessage.error('Не удалось отправить сообщение');
    }
  };
  
  const updateMessageStatus = async (timestamp, newStatus) => {
    const dbOpenRequest = indexedDB.open(DB_NAME, DB_VERSION);
    const db = await new Promise((resolve, reject) => {
      dbOpenRequest.onsuccess = () => resolve(dbOpenRequest.result);
      dbOpenRequest.onerror = () => reject(dbOpenRequest.error);
    });
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const req = store.get(timestamp);
    req.onsuccess = () => {
    
      // Отправляем через сокет обновление статуса "read" (используем единое событие messageAttributeChanged)
    const senderId = msg.sender || msg.senderId;
    socketManager.emit('messageAttributeChanged', { messageId: msg.id, attribute: 'status', value: 'seen', sender: senderId });
    antdMessage.info(`Сообщение ${msg.id} отмечено как прочитанное`);
  
      const msg = req.result;
      if (msg) {
        msg.status = newStatus;
        store.put(msg);
        console.log(`🔄 Статус сообщения [${timestamp}] обновлён на ${newStatus}`);
        
      }
    };
  };


  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && sendOnEnter) {
      e.preventDefault();
      handleSend();
      setMessageValue('');

    }
  };

  if (!selectedChat) {
    return <div style={{ padding: 20 }}>Выберите контакт, чтобы начать переписку</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Заголовок чата */}
      <div style={{ padding: '8px 16px', fontWeight: 'bold', borderBottom: '1px solid #ddd' }}>
        {selectedChat.nickname || selectedChat.contactId}
      </div>
  
      {/* Список сообщений */}
      <div
        className="message-list"
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          padding: '10px',
          maxHeight: 'calc(100vh - 220px)'
        }}
      >
        {/* {noMessages && (
          <div className="no-messages">
            <p>Нет сообщений</p>
          </div>
        )} */}
        <List
          dataSource={[...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))}
          renderItem={(msg) => {
      
            //const isSent = msg.senderId === identifier;
            // Классы для оформления: отправленные сообщения — серые (выравнивание вправо), полученные — синие (влево)
            
            // Определяем, является ли сообщение отправленным текущим пользователем по senderId
            const isSender = msg.senderId === identifier;
            const isHighlighted = (newMsgIds.includes(msg.id) || highlighted[msg.id]) && msg.status === 'delivered';
            const isSent = String(msg.senderId) === String(identifier);
            
            // Классы для оформления: если отправитель совпадает с пользователем, сообщение отображается справа
            // (серым, с классом "message-sent"), иначе — слева (синим, с классом "message-received")
            const bubbleClass = isSent ? 'message-bubble message-sent' : 'message-bubble message-received';
            
            // Определяем эмодзи статуса для отправленных сообщений

            let statusEmoji = '';
            if (isSent) {
              const msgStatus = (msg.status || '').toLowerCase();
              if      (msgStatus === 'sent')      statusEmoji = '☑️';
              else if (msgStatus === 'delivered') statusEmoji = '✅';
              else if (msgStatus === 'seen')      statusEmoji = '👀';
              else                                statusEmoji = '⏳';
            }
            return (
              <React.Fragment key={`${msg.id}-${msg.status}`}>
                {msg.id === separatorId && (
                  <div style={{ textAlign: 'center', margin: '10px 0', color: '#888' }}>
                    ――― Новые сообщения ―――
                  </div>
                )}
                <List.Item key={`${msg.id}-${msg.status}`} style={{ display: 'flex', justifyContent: isSent ? 'flex-end' : 'flex-start' }}>
                <div
                    className={bubbleClass}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isSent ? 'flex-end' : 'flex-start',
                      backgroundColor: isSender && isHighlighted ? '#d2f8d2' : undefined,
                      transition: 'background-color 0.3s ease'
                    }}
                  >
                    <div>{msg.text}</div>
                    <div
                      className="message-timestamp"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isSent ? 'flex-end' : 'flex-start',
                        fontSize: '0.75em',
                        color: '#888',
                        marginTop: 4
                      }}
                    >
                      <span>{formatTimestamp(msg.timestamp)}</span>
                      {isSent && (
                        <span style={{ marginLeft: 4, fontSize: '0.75em' }}>
                          {statusEmoji}
                        </span>
                      )}
                    </div>
                  </div>

                
                </List.Item>
              </React.Fragment>
            );
          }}
        />
        <div ref={messagesEndRef} />
      </div>
  
      {/* Панель ввода сообщения */}
      <div
        style={{
          display: 'flex',
          padding: 10,
          borderTop: '1px solid #ddd',
          background: '#fff',
          zIndex: 1,
          marginTop: 'auto'
        }}
      >
        <TextArea
          autoSize={{ minRows: 1, maxRows: 4 }}
          value={messageValue}
          onChange={(e) => setMessageValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите сообщение..."
          style={{ marginRight: 8 }}
        />
        <Tooltip title={`Enter для отправки: ${sendOnEnter ? 'вкл' : 'выкл'}`}>
          <Button icon={<CheckOutlined />} onClick={() => setSendOnEnter(prev => !prev)} style={{ marginRight: 8 }} />
        </Tooltip>
            <Button type="primary" onClick={handleSend} disabled={loading}>
            <SendOutlined /> Отправить
            </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={loading}
          type="default"
          onClick={async () => {
            Modal.confirm({
              title: 'Удалить все сообщения?',
              content: 'Вы уверены, что хотите удалить всю переписку с этим пользователем? Это действие необратимо.',
              okText: 'Удалить',
              cancelText: 'Отмена',
              onOk: async () => {
                try {
                  // 1. Удаляем локально все сообщения текущей переписки
                  await clearAllMessages(selectedChat.contactId);
                  setMessages([]);
                  setNoMessages(true);
                  // 2. Отправляем запрос на сервер для удаления переписки между пользователями
                  const token = localStorage.getItem('token');
                  const res = await fetch(`${API.clearConversationURL}?contactId=${selectedChat.contactId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (!res.ok) {
                    throw new Error('Ошибка при удалении переписки на сервере');
                  }
                  // 3. Отправляем через сокет команду второму абоненту очистить локальные сообщения
                  socketManager.emit('clearChat', { contactId: selectedChat.contactId, senderId: identifier });
                } catch (error) {
                  console.error('Ошибка при очистке переписки:', error);
                  antdMessage.error(`Ошибка очистки: ${error.message}`);
                }
              }
            });
          }}
          style={{ marginLeft: 8 }}
        >
        </Button>
      </div>
    </div>
  );
};



export { Messages };
