export interface Memory {
  id: string;
  title: string;
  story: string;
  summary: string;
  tags: string[];
  photoBase64?: string;
  photoDescription?: string;
  createdAt: number; // epoch ms
  lastRecalledAt: number; // epoch ms
  tier: 1 | 2 | 3; // 1 = top tier, 2 = middle tier, 3 = bottom tier
}

export interface OfrendaProfile {
  honoreeName: string;
  epitaph: string;
  portraitBase64: string;
}

export interface OllamaSettings {
  ollamaUrl: string;
  modelName: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'candlelight';
  content: string;
  timestamp: number;
  referencedMemoryIds?: string[];
}
