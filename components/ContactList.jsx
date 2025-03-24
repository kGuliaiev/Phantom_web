// Файл: src/components/ContactList.jsx
import React, { useEffect, useState } from 'react';

const ContactList = ({ currentUser, onStartChat }) => {
  const [contacts, setContacts] = useState([]);

  const fetchContacts = async () => {
    try {
      const res = await fetch(`http://localhost:5001/api/contacts/${currentUser}`);
      const result = await res.json();
      if (Array.isArray(result)) {
        setContacts(result);
      } else {
        console.error('Неверный формат ответа:', result);
      }
    } catch (err) {
      console.error('Ошибка загрузки контактов:', err);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [currentUser]);

  return (
    <div className="contact-list">
      <h3>Мои контакты</h3>
      {contacts.map((c) => (
        <div key={c.contactId} className="contact-item">
          <span>{c.contactId}</span>
          <button onClick={() => onStartChat(c.contactId)}>Начать чат</button>
        </div>
      ))}
    </div>
  );
};

export default ContactList;
