import api from './axios';
export const askHomeChat = (question) => api.post('/api/home-chat/ask', { question });