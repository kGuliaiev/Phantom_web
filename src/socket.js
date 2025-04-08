import { io } from 'socket.io-client';
import { API } from './config';

const socket = io(`${API.baseURL}`, {
  transports: ['websocket']
});

export default socket;