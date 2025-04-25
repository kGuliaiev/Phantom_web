// src/components/Messages.jsx
import React, { useState, useEffect, useRef } from 'react';
import { List, Tooltip, Input, Button, Space, Switch, Modal } from 'antd';
import { DeleteOutlined, ArrowRightOutlined, EnterOutlined } from '@ant-design/icons';
import socketManager from '../src/socketManager';
import {
  saveMessage,
  getMessagesByReceiverId,
  updateMessageStatusRecord,
  saveStatusHistory,
  getStatusHistory,
  clearAllMessagesForContact
} from '../utils/dbMessages';
import { cryptoManager } from '../crypto/CryptoManager';
import axios from 'axios';
import { API } from '../src/config';
import { v4 as uuidv4 } from 'uuid';

// helper to show status as emoji
const getStatusEmoji = status => {
  switch (status) {
    case 'pending':   return '🕓';
    case 'sent':      return '📤';
    case 'delivered': return '📨';
    case 'seen':      return '👀';
    default:          return '❌';
  }
};

const HIGHLIGHT_DURATION = 2000;

export function Messages({ selectedChat, onMessagesUpdate }) {
  const [messages, setMessages]       = useState([]);
  const [highlighted, setHighlighted] = useState({});
  const [inputValue, setInputValue]   = useState('');
  const userId                        = localStorage.getItem('identifier');
  const chatRef                       = useRef(selectedChat);
  const listContainerRef              = useRef();
  const [sendOnEnter, setSendOnEnter] = useState(true);


  // Format status timestamps: today => "HH:MM:SS", yesterday => "HH:MM:SS вчера", else "HH:MM:SS DD.MM.YYYY"
  const formatStatusTimestamp = isoString => {
    const dt = new Date(isoString);
    const now = new Date();
    const dtMid = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((nowMid - dtMid) / 86400000);
    const time = dt.toTimeString().substr(0, 8);
    if (diffDays === 0) return time;
    if (diffDays === 1) return `${time} вчера`;
    const date = dt.toLocaleDateString('ru-RU');
    return `${time} ${date}`;
  };

  function StatusHistory({ id }) {
    const [history, setHistory] = useState([]);
    useEffect(() => {
      getStatusHistory(id).then(entries => {
        // Deduplicate by status, keeping the latest updatedAt for each status in order
        const order = ['pending', 'sent', 'delivered', 'seen'];
        const uniqueEntries = [];
        for (const status of order) {
          // Find all entries for this status
          const candidates = entries.filter(e => e.status === status);
          if (candidates.length > 0) {
            // Pick the one with the latest updatedAt
            const latest = candidates.reduce((a, b) =>
              new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b
            );
            uniqueEntries.push(latest);
          }
        }
        setHistory(uniqueEntries);
      });
    }, [id]);
    return (
      <div style={{ minWidth: 100 }}>
        {history.map(item => (
          <div key={item.status} style={{ marginBottom: 4 }}>
            <span>{getStatusEmoji(item.status)}</span>
            <strong style={{ marginLeft: 4 }}>{item.status}</strong> @ {formatStatusTimestamp(item.updatedAt)}
          </div>
        ))}
      </div>
    );
  }


  // 1. Load history and mark seen
  useEffect(() => {
    if (!selectedChat) return;
    chatRef.current = selectedChat;
    (async () => {
      const raw = await getMessagesByReceiverId(selectedChat.contactId, userId);
      const decrypted = await Promise.all(
        raw.sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp))
           .map(async msg => {
             let text='';
             try {
               await cryptoManager.importReceiverKey(selectedChat.publicKey);
               text = await cryptoManager.decryptMessage(msg.encrypted, selectedChat.publicKey);
             } catch {}
             return {...msg, text};
           })
      );
      // highlight and mark seen
      for (let msg of decrypted) {
        if (msg.senderId===selectedChat.contactId && msg.status==='delivered') {
          setHighlighted(h=>({...h,[msg.id]:true}));
          setTimeout(async ()=>{
            setHighlighted(h=>{const c={...h};delete c[msg.id];return c;});
            const now=new Date().toISOString();
            await updateMessageStatusRecord(msg.id,'seen',now);
            await saveStatusHistory({messageId:msg.id,status:'seen',updatedAt:now});

            socketManager.emit('messageAttributeChanged',{messageId:msg.id,attribute:'status',value:'seen',sender:userId,receiver:selectedChat.contactId});
            setMessages(curr=>curr.map(x=>x.id===msg.id?{...x,status:'seen'}:x));
            onMessagesUpdate?.();
          }, HIGHLIGHT_DURATION);
        }
      }
      setMessages(decrypted);
      
      // scroll bottom
      setTimeout(()=>listContainerRef.current?.scrollTo(0,listContainerRef.current.scrollHeight),0);
    })();
  }, [selectedChat, userId]);

  // 2. Incoming socket
  useEffect(()=>{
    const onMessage = async ({ sender, receiver, encrypted, iv, timestamp, messageId })=>{
      const isActive = chatRef.current?.contactId===sender;
      await saveMessage({ id: messageId, senderId: sender, receiverId: userId, encrypted, iv, timestamp, status:'delivered' });
      socketManager.emit('messageAttributeChanged',{messageId,attribute:'status',value:'delivered',sender:userId,receiver:sender});
      if (!isActive) {
        onMessagesUpdate?.();
        return;
      }
      let text='';
      try {
        await cryptoManager.importReceiverKey(chatRef.current.publicKey);
        text = await cryptoManager.decryptMessage(encrypted, chatRef.current.publicKey);
      } catch {}
      const newMsg={id:messageId,senderId:sender,receiverId:userId,encrypted,iv,timestamp,status:'delivered',text};
      setMessages(m=>[...m,newMsg]);
      onMessagesUpdate?.();
      setHighlighted(h=>({...h,[messageId]:true}));
      setTimeout(async ()=>{
        setHighlighted(h=>{const c={...h};delete c[messageId];return c;});
        const now=new Date().toISOString();
        await updateMessageStatusRecord(messageId,'seen',now);
        await saveStatusHistory({messageId,status:'seen',updatedAt:now});
        socketManager.emit('messageAttributeChanged',{messageId,attribute:'status',value:'seen',sender:userId,receiver:sender});
        setMessages(prev=>prev.map(x=>x.id===messageId?{...x,status:'seen'}:x));
        onMessagesUpdate?.();
      },HIGHLIGHT_DURATION);
      setTimeout(()=>listContainerRef.current?.scrollTo(0,listContainerRef.current.scrollHeight),0);
    };
    socketManager.on('message',onMessage);
    return ()=>socketManager.off('message',onMessage);
  },[userId,onMessagesUpdate]);

  // 3. Status ACKs
  useEffect(()=>{
    const onStatus=async ({messageId,value})=>{
      setMessages(m=>m.map(x=>x.id===messageId?{...x,status:value}:x));
      const now=new Date().toISOString();
      await updateMessageStatusRecord(messageId,value,now);
      await saveStatusHistory({messageId,status:value,updatedAt:now});
      onMessagesUpdate?.();
    };
    socketManager.on('messageAttributeChanged',onStatus);
    return ()=>socketManager.off('messageAttributeChanged',onStatus);
  },[onMessagesUpdate]);

  // 3a. Listen for remote chat clear
  useEffect(() => {
    const onChatClearRemote = ({ contactId }) => {
      // Only clear if the current chat matches
      if (chatRef.current && chatRef.current.contactId === contactId) {
        setMessages([]);
        onMessagesUpdate?.();
      }
    };
    socketManager.on('chatClearRemote', onChatClearRemote);
    return () => socketManager.off('chatClearRemote', onChatClearRemote);
  }, [onMessagesUpdate]);

  // 4. Send message
  const sendMessage = async ()=>{
    if(!inputValue.trim()||!selectedChat) return;
    const text=inputValue.trim(), messageId=uuidv4(), timestamp=new Date().toISOString();
    let encrypted, iv;
    try {
      const res=await cryptoManager.encryptMessage(text,selectedChat.publicKey);
      encrypted=res.encrypted||res; iv=res.iv||btoa(encrypted.slice(0,12));
    }catch{return;}
    const local={id:messageId,senderId:userId,receiverId:selectedChat.contactId,encrypted,iv,timestamp,status:'pending',text};
    setMessages(m=>[...m,local]);
    await saveMessage(local);
    await saveStatusHistory({messageId,status:'pending',updatedAt:timestamp});
    setInputValue('');
    onMessagesUpdate?.();
    setTimeout(()=>listContainerRef.current?.scrollTo(0,listContainerRef.current.scrollHeight),0);
    try {
      await axios.post(API.sendMessageURL,{messageId,senderId:userId,receiverId:selectedChat.contactId,chatId:'default',encryptedContent:encrypted,iv,timestamp},{headers:{Authorization:`Bearer ${localStorage.getItem('token')}`}}); 
    }catch{}
  };
  const onKeyDown = e => {
    if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  // const clearChat=async()=>{await clearAllMessagesForContact(userId,selectedChat.contactId); setMessages([]); onMessagesUpdate?.();};
    const clearChat = async () => {
      try {
        // Удаляем переписку на сервере
        await axios.delete(API.clearConversationURL, {
          params: { contactId: selectedChat.contactId },
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } catch (err) {
        console.error('Ошибка при удалении на сервере:', err);
      }
      // Чистим локальную базу
      await clearAllMessagesForContact(userId, selectedChat.contactId);
      setMessages([]);
      onMessagesUpdate?.();
    };

    const handleClearChat = () => {
      Modal.confirm({
        title: 'Очистить переписку?',
        content: 'Вы уверены, что хотите удалить все сообщения с этим контактом? Это действие необратимо.',
        okText: 'Да, очистить',
        cancelText: 'Отмена',
        onOk: clearChat,
      });
    };

  if(!selectedChat) return <div style={{padding:16}}>Выберите чат</div>;

  return (
    <div style={{display:'flex', flexDirection:'column', height:'83vh', position:'relative'}}>
      <Space style={{justifyContent:'flex-end',marginBottom:8}}>
        <Button icon={<DeleteOutlined />} onClick={handleClearChat}>Очистить</Button>
      </Space>
      <div
        ref={listContainerRef}
        style={{flex:1,overflowY:'auto',padding:8,background:'#fafafa',borderRadius:4}}
      >
        <List
          dataSource={messages}
          renderItem={msg => {
            const isSent=msg.senderId===userId;
            return (
              <div style={{marginBottom:8,display:'flex',justifyContent:isSent?'flex-end':'flex-start'}}>
                <Tooltip title={<StatusHistory id={msg.id}/>} placement="top">
                <div style={{
                  background:isSent?'#e0e0e0':(highlighted[msg.id]?'#d2f8d2':'#b2d2f4'),
                  padding:8,borderRadius:6,maxWidth:'75%'
                }}>
                  <div>{msg.text}</div>
                  <div style={{fontSize:12,color:'#888',display:'flex',justifyContent:isSent?'flex-end':'flex-start'}}>
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    {isSent && (
                      <span style={{marginLeft:4}}>
                        {getStatusEmoji(msg.status)}
                      </span>
                    )}
                  </div>
                
                </div>
                </Tooltip>
              </div>
            );
          }}
        />
      </div>
      <div style={{
          display: 'flex',
          padding: 8,
          borderTop: '1px solid #ddd',
          background: '#fff',
          position: 'sticky',
          bottom: 0,
          zIndex: 10
      }}>
        <Input.TextArea
          value={inputValue}
          onChange={e=>setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          autoSize={{minRows:2,maxRows:6}}
          placeholder="Введите сообщение..."
        />
      <div style={{display:'flex', flexDirection:'column', marginLeft:8}}>
        <Button
          type="primary"
          onClick={sendMessage}
          style={{
            marginBottom: 4,
            backgroundColor: '#52c41a',
            borderColor: '#52c41a'
          }}
        >
          Отправить <ArrowRightOutlined />
        </Button>
        <div style={{display:'flex', alignItems:'center'}}>
          <Switch
            checked={sendOnEnter}
            onChange={checked => setSendOnEnter(checked)}
          />
          <EnterOutlined style={{ marginLeft: 8, fontSize: '16px', color: '#1890ff' }} />
          <span style={{ marginLeft: 4 }}>Enter</span>
        </div>
      </div>
      </div>
    </div>
  );
}