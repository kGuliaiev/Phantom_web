const baseURL = 'http://localhost:5001';

export const API = {
  baseURL,

  generateIdentifierURL: `${baseURL}/api/users/generateUniqueIdentifier`,
  registerURL: `${baseURL}/api/auth/register`,
  loginURL: `${baseURL}/api/auth/login`,
  checkUserURL: `${baseURL}/api/auth/check-user`,
  
  addContactURL: `${baseURL}/api/contacts/add`,
  contactsAdd: `${baseURL}/api/contacts/add`,
  getContactsURL: (owner) => `${baseURL}/api/contacts/${owner}`,
  
  
  usersListURL: `${baseURL}/api/users`,
  sendMessageURL: `${baseURL}/api/messages/send`,
  receiveMessagesURL: `${baseURL}/api/messages/receive`,

};

