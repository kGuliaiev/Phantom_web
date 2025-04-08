import { saveMessage, getMessagesByReceiverId, deleteMessageById, clearAllMessages } from '../utils/dbMessages';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import weekday from 'dayjs/plugin/weekday';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { API } from '../src/config';
import { logEvent } from '../utils/logger';

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);
dayjs.locale('ru');

import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Input, Button, List, message as antdMessage, Tooltip } from 'antd';
import { SendOutlined, CheckOutlined } from '@ant-design/icons';

import socket from '../src/socket';

const { TextArea } = Input;

const Messages = ({ selectedChat, identifier, nickname, onlineUsers, crypto }) => {
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
  const [messageValue, setMessageValue] = useState('');
  const [messages, setMessages] = useState([]);
  const [sendOnEnter, setSendOnEnter] = useState(true);
  const [loading, setLoading] = useState(false);
  const [noMessages, setNoMessages] = useState(false);
  const messagesEndRef = useRef(null);

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

    const loadMessages = async () => {
      try {
        setLoading(true);
        const localMessages = await getMessagesByReceiverId(selectedChat.contactId);
        setMessages(localMessages);
        setNoMessages(localMessages.length === 0);
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

        for (const msg of data) {
          let decryptedText = '[Ошибка расшифровки]';
          try {
            decryptedText = await crypto.decryptMessage(msg.encryptedContent, selectedChat?.publicKey);
          } catch (e) {
            console.warn('❌ Ошибка расшифровки сообщения:', e);
          }

          await saveMessage({
            id: msg.messageId,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
            text: decryptedText,
            encrypted: msg.encryptedContent,
            timestamp: msg.timestamp,
            status: msg.recipients?.find(r => r.userId === identifier)?.status || 'sent'
          });
        }

        const updatedMessages = await getMessagesByReceiverId(selectedChat.contactId);
        setMessages(updatedMessages);
        setNoMessages(updatedMessages.length === 0);
      } catch (err) {
        console.error('❌ Ошибка при обновлении сообщений с сервера:', err);
      }
    };
    fetchAndUpdateMessages();

    const handleMessage = async (message) => {
      try {
        console.log('📨 handleMessage получил сообщение:', message);
        const { senderId, encryptedContent, messageId, timestamp } = message;
        if (!selectedChat?.publicKey) {
          console.warn("⚠️ Публичный ключ не передан или некорректен", selectedChat?.publicKey);
          return;
        }
        await crypto.importReceiverKey(selectedChat.publicKey);
        const decryptedText = await crypto.decryptMessage(encryptedContent, selectedChat?.publicKey);

        logEvent('message_received', {
          from: senderId,
          messageId,
          timestamp
        });

        const newMsg = {
          id: messageId,
          sender: senderId,
          receiver: identifier,
          text: decryptedText,
          encrypted: encryptedContent,
          timestamp,
          status: 'delivered'
        };

        await saveMessage(newMsg);
        if (Notification.permission === 'granted') {
          new Notification('Новое сообщение', {
            body: decryptedText,
            tag: messageId
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('Новое сообщение', {
                body: decryptedText,
                tag: messageId
              });
            }
          });
        }
        setMessages(prev => {
          const exists = prev.find(m => m.id === messageId);
          return exists ? prev : [...prev, newMsg];
        });

        notification.open({
          message: 'Новое сообщение от ',
          description: decryptedText,
          duration: 3,
        });

        if (!document.hasFocus()) {
          new Notification('Новое сообщение от', {
            body: senderId,
            tag: decryptedText
          });
        }

        // Перемещаем вызов в самый конец функции, чтобы событие отправлялось после отображения сообщения
        socket.emit('messageRead', { messageId });
      } catch (err) {
        console.error("Ошибка расшифровки:", err);
      }
    };

    socket.on('message', handleMessage);
    socket.on('messageDelivered', ({ messageId }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId ? { ...msg, status: 'delivered' } : msg
        )
      );
    });
    socket.on('messageRead', ({ messageId }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId ? { ...msg, status: 'read' } : msg
        )
      );
    });
    
    return () => {
      socket.off('message', handleMessage);
      socket.off('messageDelivered');
      socket.off('messageRead');
    };
  }, [selectedChat]);

  const handleSend = async () => {
    if (!messageValue.trim() || !selectedChat?.publicKey) return;

    if (!selectedChat.publicKey || selectedChat.publicKey.length < 50) {
      console.warn("⚠️ Некорректный публичный ключ получателя");
      return antdMessage.error("Некорректный ключ шифрования");
    }

    localStorage.setItem('lastPublicKey', selectedChat.publicKey);

    if (crypto && crypto.generateSharedKeyIfNeeded) {
      try {
        await crypto.generateSharedKeyIfNeeded(selectedChat.contactId, selectedChat.publicKey);
      } catch (err) {
        console.warn('⚠️ Ошибка при генерации ключа:', err);
        return antdMessage.error("Ошибка при подготовке ключа");
      }
    }

    try {
      const encrypted = await crypto.encryptMessage(messageValue, selectedChat.publicKey);
      const timestamp = Date.now();
      const senderId = localStorage.getItem('identifier');

      setMessages(prev => [...prev, { sender: senderId, text: messageValue, timestamp, status: 'sent' }]);
      await saveMessage({
        id: timestamp,
        sender: senderId,
        receiver: selectedChat.contactId,
        encrypted,
        text: messageValue,
        timestamp,
        status: 'sent'
      });

      const payload = {
        senderId,
        receiverId: selectedChat.contactId,
        chatId: selectedChat.chatId || `${identifier}_${selectedChat.contactId}`,
        encryptedContent: encrypted,
        iv: btoa(encrypted.slice(0, 12))
      };
      console.log('📤 Отправка сообщения на сервер:', payload);

      logEvent('message_sent', {
        to: selectedChat.contactId,
        contentLength: messageValue.length,
        timestamp: Date.now()
      });

      const token = localStorage.getItem('token');
      const response = await axios.post(API.sendMessageURL, {
        senderId: localStorage.getItem('identifier'),
        receiverId: selectedChat.contactId,
        chatId: selectedChat.chatId || 'default',
        encryptedContent: encrypted,
        iv: btoa(encrypted.slice(0, 12))
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.status === 200 && response.data?.newMessage?.messageId) {
        await updateMessageStatus(timestamp, 'server');

        socket.emit('message', {
          to: selectedChat.contactId,
          encrypted,
          timestamp,
          messageId: response.data.newMessage.messageId
        });
      }

      setMessageValue('');
    } catch (err) {
      console.error('Ошибка при отправке:', err);
      antdMessage.error('Не удалось отправить сообщение');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && sendOnEnter) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!selectedChat) {
    return <div style={{ padding: 20 }}>Выберите контакт, чтобы начать переписку</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 16px', fontWeight: 'bold', borderBottom: '1px solid #ddd' }}>
        {selectedChat.nickname || selectedChat.contactId}
      </div>
      <div
        className="message-list"
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          padding: '10px',
          maxHeight: 'calc(100vh - 220px)'
        }}
      >
        {noMessages && (
          <div className="no-messages">
            <p>Нет сообщений</p>
          </div>
        )}
        <List
          size="small"
          dataSource={messages}
          renderItem={(item) => (
            <List.Item
              style={{
                justifyContent: item.sender === identifier ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '60%',
                backgroundColor: item.sender === identifier ? '#e6f7ff' : '#f5f5f5',
                padding: 10,
                borderRadius: 6
              }}>
                {item.text}
                <div style={{ fontSize: '10px', color: '#888', marginTop: 4 }}>
                {formatTimestamp(item.timestamp)} • {
                  item.status === 'read' ? (
                    <span style={{ color: '#1890ff' }}>✓✓</span>
                  ) : item.status === 'delivered' ? (
                    <span style={{ color: '#555' }}>✓✓</span>
                  ) : item.status === 'server' ? (
                    <span style={{ color: '#555' }}>✓</span>
                  ) : (
                    <span style={{ color: '#999' }}>🕓</span>
                  )
                }
                </div>
              </div>
            </List.Item>
          )}
        />
        <div ref={messagesEndRef} />
      </div>
      <div style={{ display: 'flex', padding: 10, borderTop: '1px solid #ddd', background: '#fff', zIndex: 1, marginTop: 'auto' }}>
        <TextArea
          autoSize={{ minRows: 1, maxRows: 4 }}
          value={messageValue}
          onChange={(e) => setMessageValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите сообщение..."
          style={{ marginRight: 8 }}
        />
        <Tooltip title={`Enter для отправки: ${sendOnEnter ? 'вкл' : 'выкл'}`}>
          <Button
            icon={<CheckOutlined />}
            onClick={() => setSendOnEnter(prev => !prev)}
            style={{ marginRight: 8 }}
          />
        </Tooltip>
        <Button
          icon={<SendOutlined />}
          type="primary"
          onClick={handleSend}
        />
        <Button
          danger
          type="default"
          onClick={async () => {
            Modal.confirm({
              title: 'Удалить все сообщения?',
              content: 'Вы уверены, что хотите удалить все сообщения с этим пользователем? Это действие необратимо.',
              okText: 'Удалить',
              cancelText: 'Отмена',
              onOk: async () => {
                await clearAllMessages(selectedChat.contactId);
                setMessages([]);
                setNoMessages(true);
              }
            });
          }}
          style={{ marginLeft: 8 }}
        >
          Очистить
        </Button>
      </div>
    </div>
  );
};

const updateMessageStatus = async (timestamp, newStatus) => {
  const dbOpenRequest = indexedDB.open('SecureMessengerDB', 1);
  const db = await new Promise((resolve, reject) => {
    dbOpenRequest.onsuccess = () => resolve(dbOpenRequest.result);
    dbOpenRequest.onerror = () => reject(dbOpenRequest.error);
  });
  const tx = db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  const req = store.get(timestamp);
  req.onsuccess = () => {
    const msg = req.result;
    if (msg) {
      msg.status = newStatus;
      store.put(msg);
      console.log(`🔄 Статус сообщения [${timestamp}] обновлён на ${newStatus}`);
    }
  };
};

export { Messages };