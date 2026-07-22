import axios from 'axios';
import type { KnowledgeBase, Message, AssistantResponse } from '../../../shared/types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const client = axios.create({
  baseURL: BASE_URL,
});

export interface CreateProjectResponse {
  id: string;
  name: string;
  description: string;
  status: string;
}

export interface UploadRepositoryResponse {
  sessionId: string;
  projectId: string;
}

export async function createProject(
  name: string,
  description: string,
): Promise<CreateProjectResponse> {
  const response = await client.post<CreateProjectResponse>('/projects', {
    name,
    description,
  });
  return response.data;
}

export async function uploadRepository(
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadRepositoryResponse> {
  const formData = new FormData();
  formData.append('repository', file);

  const response = await client.post<UploadRepositoryResponse>(
    `/projects/${projectId}/analyze`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          onProgress(percent);
        }
      },
    },
  );
  return response.data;
}

export async function getSession(sessionId: string): Promise<KnowledgeBase> {
  const response = await client.get<KnowledgeBase>(`/sessions/${sessionId}`);
  return response.data;
}

export async function askQuestion(
  sessionId: string,
  history: Message[],
  question: string,
): Promise<AssistantResponse> {
  const response = await client.post<AssistantResponse>(
    `/sessions/${sessionId}/chat/ask`,
    { history, question },
  );
  return response.data;
}

export async function getDoc(sessionId: string, type: string): Promise<string> {
  const response = await client.get<string>(
    `/sessions/${sessionId}/docs/${type}`,
    { responseType: 'text' as never },
  );
  return response.data;
}
