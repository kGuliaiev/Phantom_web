import React, { useEffect, useState } from 'react';
import { API } from '../src/config';

const ContactList = ({ currentUser, onSelect }) => {
  const [contacts, setContacts] = useState([]);
  const [newId, setNewId] = useState('');
  const [error, setError] = useState('');

  const fetchContacts = async () => {
    try {
      const res = await fetch(`${API.contactsURL}/${currentUser}`);
      const data = await res.json();
      setContacts(data || []);
    } catch (err) {
      console.error('Ошибка загрузки контактов:', err);
      setContacts([]);
    }
  };

  const handleAddContact = async () => {
    setError('');
    if (!newId || newId === currentUser) {
      setError('Некорректный идентификатор');
      return;
    }

    try {
      const res = await fetch(API.contactsURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: currentUser,
          contactId: newId
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Ошибка');

      setNewId('');
      fetchContacts();
    } catch (err) {
      console.error('Ошибка добавления контакта:', err);
      setError(err.message || 'Ошибка добавления');
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchContacts();
    }
  }, [currentUser]);

  return (
    <div className="contact-list">
      <h3>📇 Контакты</h3>
      <div className="add-contact">
        <input
          type="text"
          placeholder="ID контакта"
          value={newId}
          onChange={(e) => setNewId(e.target.value.toUpperCase())}
        />
        <button onClick={handleAddContact}>➕</button>
      </div>
      {error && <p className="error">{error}</p>}

      {contacts.length === 0 ? (
        <p>У вас нет контактов</p>
      ) : (
        <ul>
          {contacts.map((c) => (
            <li key={c.contactId}>
              <button onClick={() => onSelect({ username: c.contactId })}>
                👤 {c.contactId}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ContactList;