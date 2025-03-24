export const API = {
    baseURL: 'http://localhost:5001',
    registerUserURL: 'http://localhost:5001/api/auth/register',
    validateUserURL: 'http://localhost:5001/api/auth/login', // 👈 здесь!
    checkUserURL: 'http://localhost:5001/check-user',
    usersListURL: 'http://localhost:5001/api/users',
    sendMessageURL: 'http://localhost:5001/send-message',
    receiveMessagesURL: 'http://localhost:5001/receive-messages',
    confirmReadURL: 'http://localhost:5001/confirm-read'
};