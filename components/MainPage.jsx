// MainPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Menu, Button, Tabs, List, Avatar, Input, Modal, message, Tooltip
} from 'antd';
import {
  UserOutlined,
  MessageOutlined,
  LogoutOutlined,
  SendOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { CryptoManager } from '../crypto/CryptoManager';
import { API } from '../src/config';
import '../src/App.css';

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;

const MainPage = () => {
  const navigate = useNavigate(); // добавь внутри компонента
  const [selectedTab, setSelectedTab] = useState('contacts');
  const [selectedChat, setSelectedChat] = useState(null);
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

  const identifier = localStorage.getItem('identifier');
  const credHash = localStorage.getItem('credHash');
  const crypto = new CryptoManager();

  const loadContactsFromServer = async () => {
    if (!identifier) return;
    try {
      const response = await fetch(`${API.getContactsURL}/${identifier}`);
      const contentType = response.headers.get('content-type');
      if (!response.ok || !contentType?.includes('application/json')) {
        throw new Error('Некорректный ответ сервера');
      }
      const data = await response.json();
      setContacts(data);

      const encrypted = await crypto.encryptData(JSON.stringify(data), credHash);
      localStorage.setItem('contactsEncrypted', encrypted);
    } catch (error) {
      console.error('Ошибка загрузки контактов:', error);
      message.error('Не удалось загрузить контакты');
    }
  };

  const loadEncryptedContacts = async () => {
    const encrypted = localStorage.getItem('contactsEncrypted');
    if (encrypted && credHash) {
      try {
        const decrypted = await crypto.decryptData(encrypted, credHash);
        setContacts(JSON.parse(decrypted));
      } catch (err) {
        console.warn('Не удалось расшифровать контакты:', err);
      }
    }
  };

  useEffect(() => {
    loadEncryptedContacts();
    loadContactsFromServer();
  }, []);


  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  const handleCheckIdentifier = async () => {
    if (!identifierInput) return message.warning('Введите ID пользователя');
    setChecking(true);
    try {
      const res = await fetch(`${API.checkUserURL}?identifier=${identifierInput}`);
      const data = await res.json();
      if (res.ok && data?.publicKey) {
        setNicknameInput(data.nickname || '');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: identifier,
          contactId: identifierInput,
          nickname: nicknameInput
        })
      });

      const data = await res.json();
      if (res.ok && data.contacts) {
        message.success('Контакт добавлен');
        setIsModalOpen(false);
        setIdentifierInput('');
        setNicknameInput('');
        setIsIdentifierValid(false);

        // Сохраняем контакты зашифрованно
        const encrypted = await crypto.encryptData(JSON.stringify(data.contacts), credHash);
        localStorage.setItem('contactsEncrypted', encrypted);
        const decrypted = await crypto.decryptData(encrypted, credHash);
        setContacts(JSON.parse(decrypted));
      } else {
        message.error(data.message || 'Ошибка при добавлении контакта');
      }
    } catch (error) {
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
          const res = await fetch(`${API.deleteContactURL}/${identifier}/${contactId}`, { method: 'DELETE' });
          if (!res.ok) throw new Error();
          const updated = await res.json();

          // обновим зашифрованный список
          const encrypted = await crypto.encryptData(JSON.stringify(updated), credHash);
          localStorage.setItem('contactsEncrypted', encrypted);
          const decrypted = await crypto.decryptData(encrypted, credHash);
          setContacts(JSON.parse(decrypted));

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
        <div className="header-left">
          <div className="logo">Phantom</div>
        </div>
        <div className="header-center">
          <Input.Search placeholder="Поиск" className="search-bar" />
        </div>
        <div className="header-right">
        <Button type="primary" danger onClick={() => navigate('/logout')}>
            Выйти   
        </Button>
        </div>
      </Header>

      <Layout>
        <Sider width={260} className="sidebar">
          <Tabs
            activeKey={selectedTab}
            onChange={setSelectedTab}
            items={[{
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
                          <Button type="text" icon={<DeleteOutlined />} onClick={() => handleDeleteContact(item.contactId)} />
                        </Tooltip>
                      ]}
                      onClick={() => setSelectedChat(item)}
                      className="list-item"
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={item.nickname || item.contactId}
                      />
                    </List.Item>
                  )}
                />
              )
            }, {
              key: 'chats',
              label: 'Чаты',
              children: <div style={{ padding: '1rem', color: '#888' }}>Чаты в разработке</div>
            }]}
          />
        </Sider>

        <Content className="chat-area">
          {selectedChat ? (
            <div className="chat-window">
              <div className="chat-header">Чат с {selectedChat.nickname}</div>
              <div className="chat-messages">
                {messages.map((msg) => (
                  <div key={msg.id} className={`chat-bubble ${msg.fromMe ? 'me' : 'them'}`}>{msg.text}</div>
                ))}
              </div>
              <div className="chat-input sticky-input">
                <TextArea
                  rows={2}
                  value={messageValue}
                  onChange={(e) => setMessageValue(e.target.value)}
                  placeholder="Введите сообщение..."
                />
                <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>Отправить</Button>
              </div>
            </div>
          ) : (
            <div className="chat-placeholder">Выберите чат или контакт слева</div>
          )}
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
        <Input
          placeholder="Идентификатор пользователя"
          value={identifierInput}
          onChange={(e) => {
            setIdentifierInput(e.target.value);
            setIsIdentifierValid(false);
          }}
          style={{ marginBottom: 8 }}
        />
        <Button loading={checking} onClick={handleCheckIdentifier} style={{ marginBottom: 12 }}>
          Найти
        </Button>
        {isIdentifierValid && (
          <Input
            placeholder="Никнейм"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
          />
        )}
      </Modal>
    </Layout>
  );
};

export default MainPage;
