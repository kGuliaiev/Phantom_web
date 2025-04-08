const baseURL = 'http://localhost:5001';

export const API = {
  baseURL,

  generateIdentifierURL:    `${baseURL}/api/auth/generateUniqueIdentifier`,
  registerURL:              `${baseURL}/api/auth/register`,
  loginURL:                 `${baseURL}/api/auth/login`,
  validateTokenURL:         `${baseURL}/api/auth/validate-token`,
  checkUserURL:             `${baseURL}/api/auth/check-user`,   
  
  getContactsURL:           `${baseURL}/api/contacts/list`,
  addContactURL:            `${baseURL}/api/contacts/add`,
  deleteContactURL:         `${baseURL}/api/contacts`,
  //getContactsURL:(owner) => `${baseURL}/api/contacts/${owner}`,
  
  
  
  usersListURL:             `${baseURL}/api/users`,

  sendMessageURL:           `${baseURL}/api/message/send`,
  receiveMessagesURL:       `${baseURL}/api/message/receive`,

};