import { api } from './client';

export type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const assistantApi = {
  chat: async (messages: AssistantMessage[], locale = 'fr') => {
    const { data } = await api.post('/assistant/chat', { messages, locale }, { timeout: 65000 });
    return data as { reply: string; model: string };
  },
};
