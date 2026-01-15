// 第3章で定義： LLMが理解するツール定義（JSONスキーマ + 実行関数）
export type Tool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
  needsApproval?: boolean; // 第5章で定義
};

// 第3章で定義：LLMが発行するツール呼び出し
export type ToolCall = {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
};

// 第3章で定義：会話に追加されるツール実行結果
export type ToolResult = {
  toolCallId: string;
  result: string;
};

// 第3章で定義：モデルとやりとりするメッセージ構造
export type Message =
  | { role: 'user' | 'system'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

// 使用量メタデータ（プロバイダ依存）
export type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

// ストリーミングレスポンスの読み取り時に発行されるチャンク
export interface StreamChunk {
  kind: 'delta' | 'event' | 'done';
  text?: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
  usage?: Usage;
  toolCalls?: ToolCall[];
  error?: unknown;
}

// 統一されたLLMレスポンス
export type GenerateTextResult = {
  text: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
  toolCalls?: ToolCall[];
  usage?: Usage;
};

// generateTextに渡すパラメータ
export type GenerateParams = {
  messages: Message[];
  tools?: Tool[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

// 各プロバイダが実装する言語モデルのインタフェース
export interface LanguageModel {
  doGenerate(params: GenerateParams): Promise<GenerateTextResult>;
  doStream?(params: GenerateParams): AsyncIterable<StreamChunk>;
}

// モデルIDに紐づいた言語モデルを返すプロバイダファクトリ
export type Provider = (modelId: string) => LanguageModel;

// プロバイダ固有のエラーを公開する統一APIエラー
export class LLMApiError extends Error {
  constructor(
    public status: number,
    public provider: string,
    public code?: string,
    message?: string,
    public raw?: unknown,
    public headers?: Record<string, string>
  ) {
    super(message || `LLM API Error: ${provider} returned ${status}`);
    this.name = 'LLMApiError';
  }
}
