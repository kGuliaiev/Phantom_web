import { cryptoManager } from '../crypto/CryptoManager';

/**
 * Load locally stored encrypted contacts, decrypt and parse.
 * @returns {Promise<Array<{ contactId: string, nickname: string }>>}
 */
export async function getLocalContacts() {
  const encrypted = localStorage.getItem('contactsEncrypted');
  const credHash = localStorage.getItem('credHash');
  if (!encrypted || !credHash) return [];
  try {
    const decrypted = await cryptoManager.decryptData(encrypted, credHash);
    const parsed = JSON.parse(decrypted);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Ошибка при расшифровке локальных контактов:', err);
    return [];
  }
}