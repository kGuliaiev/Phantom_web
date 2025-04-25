// src/socketManager.js
import { Input, Button, List, 
  message as antdMessage, Tooltip, 
  notification, Modal }                   from 'antd';
import { MailOutlined } from '@ant-design/icons';
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { API } from './config';
// Обратите внимание на относительный путь и расширение .js — так Vite найдёт ваши utils:
import {
  saveMessage,
  updateMessageStatusRecord,
  saveStatusHistory
} from '../utils/dbMessages.js';
import { cryptoManager } from '../crypto/CryptoManager';
import { getLocalContacts } from '../utils/contacts.js';

// Получаем локальный идентификатор пользователя из localStorage
const identifier = localStorage.getItem('identifier');


const TypewriterText = function TypewriterText(props) {
  const { text = '', speed = 100, style } = props;
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < text.length) {
        setDisplayed(text.slice(0, idx + 1));
        idx++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return React.createElement('span', { style }, displayed);
};

const showNewMessageNotification = (title, description = '') => {
  notification.open({
    message: React.createElement('span', { style: { fontSize: '14px' } }, title),
    description: React.createElement(TypewriterText, { text: description || '', speed: 50, style: { fontSize: '12px' } }),
    style: { width: 250 },
    icon: React.createElement(MailOutlined, { style: { color: '#1890ff', fontSize: 16 } }),
    duration: 4,
    className: 'fade-notification',
  });
};

class SocketManager {
  constructor() {
    this.socket = io(API.baseURL, { transports: ['websocket'] });
    this._bindCoreHandlers();
  }

  _bindCoreHandlers() {
   
  // Сервер присылает новые сообщения
    this.socket.on('message', async (data) => {
      console.log('SocketManagers -> 🔐 Received message from server:', data);
      // Сохраняем в IndexedDB
      await saveMessage({
        id:         data.messageId,
        senderId:   data.sender,
        receiverId: data.receiver,
        encrypted:  data.encrypted || data.encryptedContent,
        iv:         data.iv,
        timestamp:  data.timestamp || new Date().toISOString(),
        status:     'delivered'
      });

      // Decrypt with sender's public key and lookup nickname
      const contacts = await getLocalContacts();
      const contact = contacts.find(c => String(c.contactId) === String(data.sender));
      const senderName = contact?.nickname || data.sender;
      const senderIdentificator = contact?.identificator || data.sender;
      const senderPublicKey = contact?.publicKey;
      let senderText = '';
      try {
        if (senderPublicKey) {
          senderText = await cryptoManager.decryptMessage( data.encrypted || data.encryptedContent, senderPublicKey);
        } else {
          senderText = data.encrypted || data.encryptedContent;
        }
      } catch (err) {
        console.warn(`Decryption failed for message ${data.messageId}:`, err);
        senderText = data.encrypted || data.encryptedContent;
      }

      //antdMessage.info(`📩 ${data.timestamp} Получено сообщение от ${senderName} (${senderIdentificator}): ${senderText}`);
      //console.log(`📩 Получено сообщение от ${senderName} (${senderIdentificator}): ${senderText}`);
      showNewMessageNotification( `${senderName} (${senderIdentificator})`, senderText || '' );

      // отправляем событие изменения атрибута статуса (delivered) серверу
      this.socket.emit('messageAttributeChanged', {
        messageId: data.messageId,
        attribute: 'status',
        value: 'delivered',
        sender:    identifier
      });
      console.log(`📤 Отправлено событие 'messageAttributeChanged' (delivered) для сообщения ${data.messageId}`);

      // История статусов
      const now = new Date().toISOString();
      await saveStatusHistory({ messageId: data.messageId, status: 'delivered', updatedAt: now });
      // Уведомляем UI
      window.dispatchEvent(new CustomEvent('messagesUpdated'));
      // Обновляем бейджи: уведомляем MainPage о новом сообщении
      this.emit('newMessage', data);
    });

    // Сервер присылает апдейт статуса
    this.socket.on('messageAttributeChanged', async ({ messageId, value, sender }) => {
      const now = new Date().toISOString();
      switch (value) {
        case 'sent':
        case 'delivered':
        case 'seen':
          await updateMessageStatusRecord(messageId, value, now);
          await saveStatusHistory({ messageId, status: value, updatedAt: now });
          window.dispatchEvent(new CustomEvent('messageStatusUpdated', {
            detail: { messageId, status: value }
          }));
         // console.log(`📩 Статус ${value} получен от сервера: ${messageId}`);
         // antdMessage.info(`📩Статус сообщения ${messageId} изменён на ${value}`);
          break;
      }
    });
  }

  on(event, handler) {
    this.socket.on(event, handler);
  }

  off(event, handler) {
    this.socket.off(event, handler);
  }

  emit(event, payload) {
    this.socket.emit(event, payload);
  }
}

const socketManager = new SocketManager();
export default socketManager;