const baseURL = 'http://localhost:5001';

export const API = {
  baseURL,

  generateIdentifierURL: `${baseURL}/api/auth/generate-identifier`,
  registerURL: `${baseURL}/api/auth/register`,
  loginURL: `${baseURL}/api/auth/login`,
  checkUserURL: `${baseURL}/api/auth/check-user`,

  usersListURL: `${baseURL}/api/users`,
  sendMessageURL: `${baseURL}/api/messages/send`,
  receiveMessagesURL: `${baseURL}/api/messages/receive`,

  addContactURL: `${baseURL}/api/contacts/add`,
  getContactsURL: (username) => `${baseURL}/api/contacts/${username}`,
};