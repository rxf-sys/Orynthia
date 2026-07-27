import { api } from '@/platform/api/client';

export const chatApi = {
  status: () => api.get<{ enabled: boolean }>('/chat/status'),
  send: (messages: { role: 'user' | 'assistant'; content: string }[]) =>
    api.post<{
      role: 'assistant';
      content: string;
      usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
    }>('/chat/message', { messages }),
};
