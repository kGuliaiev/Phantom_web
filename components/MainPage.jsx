import React, { useEffect, useState } from 'react';
import { Layout, Menu, Button, Tabs, List, Avatar, Input, Modal, message, Tooltip } from 'antd';
import {
  UserOutlined,
  MessageOutlined,
  LogoutOutlined,
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { CryptoManager } from '../crypto/CryptoManager';
import '../src/App.css';
import { API } from '../src/config.js'; // если у тебя есть config.js

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;

const MainPage = () => {
  const [selectedTab, setSelectedTab] = useState('contacts');
  const [selectedChat, setSelectedChat] = useState(null);
  const [messageValue, setMessageValue] = useState('');
  const [contacts, setContacts] = useState([]);
  const [chats] = useState([]);
  const [messages] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newIdentifier, setNewIdentifier] = useState('');

  const crypto = new CryptoManager();
  

  // Загрузка контактов с сервера и локально зашифрованных при инициализации
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const username = localStorage.getItem('username');
        const password = localStorage.getItem('sessionPassword');
        const passwordHash = await crypto.deriveCredentialsHash(username, password);

        // Получение с сервера
        const res = await fetch(API.checkUserURL(username));
        const serverContacts = res.ok ? await res.json() : [];

        // Сохраняем зашифрованную версию локально
        const encrypted = await crypto.encryptMessage(passwordHash, JSON.stringify(serverContacts));
        localStorage.setItem('contacts_encrypted', encrypted);
        setContacts(serverContacts);
      } catch (err) {
        console.error('Ошибка загрузки контактов:', err);
      }
    };
    loadContacts();
  }, []);

  const saveContactsEncrypted = async (updatedContacts) => {
    const username = localStorage.getItem('username');
    const password = localStorage.getItem('sessionPassword');
    const passwordHash = await crypto.deriveCredentialsHash(username, password);
    const encrypted = await crypto.encryptMessage(passwordHash, JSON.stringify(updatedContacts));
    localStorage.setItem('contacts_encrypted', encrypted);
    setContacts(updatedContacts);
  };

  const handleAddContact = async () => {
    if (!newIdentifier.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/auth/check-user?identifier=${newIdentifier}`);
      const data = await res.json();
      if (!res.ok || !data.publicKey) throw new Error('Пользователь не найден');

      let nickname = '';
      await new Promise((resolve) => {
        Modal.confirm({
          title: 'Введите имя контакта',
          content: (
            <Input
              placeholder="Введите ник"
              onChange={(e) => (nickname = e.target.value)}
            />
          ),
          onOk: resolve,
        });
      });

      if (!nickname) nickname = 'Без имени';

      const username = localStorage.getItem('username');

      // 1. Добавление на сервер
      const contactPayload = {
        owner: username,
        contactId: newIdentifier,
        publicKey: data.publicKey,
        nickname,
      };

      const serverRes = await fetch(`${API_BASE}/contacts/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactPayload),
      });

      if (!serverRes.ok) throw new Error('Ошибка при добавлении на сервер');

      // 2. Обновление локального списка
      const updated = [...contacts, contactPayload];
      await saveContactsEncrypted(updated);
      setIsModalOpen(false);
      message.success('Контакт добавлен');
    } catch (err) {
      message.error(err.message || 'Ошибка добавления контакта');
    }
  };

  const handleDeleteContact = (contactId) => {
    Modal.confirm({
      title: 'Удалить контакт?',
      content: 'Вы действительно хотите удалить этот контакт?',
      onOk: async () => {
        const filtered = contacts.filter((c) => c.contactId !== contactId);
        await saveContactsEncrypted(filtered);
        if (selectedChat?.id === contactId) setSelectedChat(null);
        message.success('Контакт удалён');
      },
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
        <div className="header-left">
          <div className="logo">Phantom</div>
        </div>
        <div className="header-center">
          <Input.Search placeholder="Поиск" className="search-bar" />
        </div>
        <div className="header-right">
          <Button icon={<LogoutOutlined />} danger>
            Выйти
          </Button>
        </div>
      </Header>
      <Layout>
        <Sider width={260} breakpoint="lg" collapsedWidth="0" className="sidebar">
          <Tabs
            activeKey={selectedTab}
            onChange={setSelectedTab}
            items={[
              {
                key: 'contacts',
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Контакты</span>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)} />
                  </div>
                ),
                children: (
                  <List
                    itemLayout="horizontal"
                    dataSource={contacts}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Tooltip title="Удалить контакт" key="delete">
                            <Button
                              type="text"
                              icon={<DeleteOutlined />}
                              onClick={() => handleDeleteContact(item.contactId || item.id)}
                            />
                          </Tooltip>,
                        ]}
                        onClick={() => setSelectedChat(item)}
                        className="list-item"
                      >
                        <List.Item.Meta
                          avatar={<Avatar icon={<UserOutlined />} />}
                          title={item.nickname || item.contactId || item.id}
                        />
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: 'chats',
                label: 'Чаты',
                children: (
                  <List
                    itemLayout="horizontal"
                    dataSource={chats}
                    renderItem={(item) => (
                      <List.Item onClick={() => setSelectedChat(item)} className="list-item">
                        <List.Item.Meta
                          avatar={<Avatar icon={<MessageOutlined />} />}
                          title={<div>{item.name} <span className="status">{item.status}</span></div>}
                          description={item.lastMessage}
                        />
                      </List.Item>
                    )}
                  />
                ),
              },
            ]}
          />
        </Sider>
        <Content className="chat-area">
          {selectedChat ? (
            <div className="chat-window">
              <div className="chat-header">Чат с {selectedChat.nickname || selectedChat.name}</div>
              <div className="chat-messages">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`chat-bubble ${msg.fromMe ? 'me' : 'them'}`}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>
              <div className="chat-input sticky-input">
                <TextArea
                  rows={2}
                  value={messageValue}
                  onChange={(e) => setMessageValue(e.target.value)}
                  placeholder="Введите сообщение..."
                />
                <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>
                  Отправить
                </Button>
              </div>
            </div>
          ) : (
            <div className="chat-placeholder">Выберите чат или контакт слева</div>
          )}
        </Content>
      </Layout>

      <Modal
        title="Добавить контакт"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleAddContact}
        okText="Проверить"
      >
        <Input
          placeholder="Идентификатор пользователя"
          value={newIdentifier}
          onChange={(e) => setNewIdentifier(e.target.value)}
        />
      </Modal>
    </Layout>
  );
};

export default MainPage;
