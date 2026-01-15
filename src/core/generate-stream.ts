import type {
  GenerateParams,
  GenerateTextResult,
  LanguageModel,
  StreamChunk,
  ToolCall,
} from '../types';

export type GenerateStreamTextParams = GenerateParams & {
  model: LanguageModel;
};

export async function* generateStreamText(
  params: GenerateStreamTextParams
): AsyncIterable<StreamChunk> {
  if (!params.model.doStream) {
    throw new Error('このモデルはストリーミングに対応していません');
  }

  yield* params.model.doStream(params);
}

export async function collectStreamResult(
  params: GenerateStreamTextParams & {
    onChunk?: (chunk: StreamChunk) => void;
  }
): Promise<GenerateTextResult> {
  let text = '';
  let finishReason: StreamChunk['finishReason'];
  let usage: StreamChunk['usage'];
  let toolCalls: ToolCall[] | undefined;

  for await (const chunk of generateStreamText(params)) {
    if (params.onChunk) {
      params.onChunk(chunk);
    }

    if (chunk.kind === 'delta' && chunk.text) {
      text += chunk.text;
    }

    if (chunk.kind === 'done') {
      finishReason = chunk.finishReason;
      usage = chunk.usage;
      toolCalls = chunk.toolCalls;
    }
  }

  return {
    text,
    finishReason: finishReason ?? 'stop',
    usage,
    toolCalls,
  };
}
