import api from './axios';
export const askHomeChat = (question) => api.post('/home-chat/ask', { question });