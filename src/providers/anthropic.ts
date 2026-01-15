import type {
    GenerateParams,
    GenerateTextResult,
    LanguageModel,
    Provider,
    ToolCall,
    StreamChunk,
} from '../types';
import { LLMApiError } from '../types';
import Anthropic from '@anthropic-ai/sdk';

export type ProviderConfig = {
    apiKey?: string;
    baseURL?: string;
    maxRetries?: number;
};

function mapAnthropicFinishReason(
    stopReason: string | null | undefined
): GenerateTextResult['finishReason'] {
    switch (stopReason) {
        case 'end_turn':
        case 'stop_sequence':
            return 'stop';
        case 'max_tokens':
            return 'length';
        case 'tool_use':
            return 'tool_calls';
        default:
            return 'stop';
	}
}

type NonSystemMessage = Exclude<
    GenerateParams['messages'][number],
    { role: 'system' }
>;

function mapMessages(messages: NonSystemMessage[]): Anthropic.MessageParam[] {
    return messages.map((message): Anthropic.MessageParam => {
        if (message.role === 'assistant') {
            const content: Anthropic.ContentBlockParam[] = [];
            if (message.content) {
                content.push({ type: 'text', text: message.content });
            }
            if (message.toolCalls) {
                for (const tc of message.toolCalls) {
                    content.push({
                        type: 'tool_use',
                        id: tc.toolCallId,
                        name: tc.name,
                        input: tc.args,
                    });
                }
            }
            return { role: 'assistant', content };
        }

        if (message.role === 'tool') {
            return {
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: message.toolCallId,
                        content: message.content,
                    },
                ],
            };
        }

        return { role: 'user', content: message.content };
    });
}

export function createAnthropic(config: ProviderConfig = {}): Provider {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    const baseURL = (config.baseURL ?? 'https://api.anthropic.com').replace(
        /\/v1\/?$/,
        ''
    );

    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY 環境変数が設定されていません');
    }

    const client = new Anthropic({
        apiKey,
        baseURL,
        maxRetries: config.maxRetries ?? 0,
    });

	return (modelId: string): LanguageModel => ({
	        async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
	            const systemMessages = params.messages.filter((m) => m.role === 'system');
	            const messages = params.messages.filter(
	                (m): m is NonSystemMessage => m.role !== 'system'
	            );
	            const maxTokens = params.maxTokens ?? 1024;
	            const system =
	                systemMessages.length > 0
	                    ? systemMessages.map((m) => ({
	                          type: 'text' as const,
	                          text: m.content,
	                      }))
	                    : undefined;

	            const tools =
	                params.tools && params.tools.length > 0
	                    ? params.tools.map((tool) => ({
	                          name: tool.name,
	                          description: tool.description,
	                          input_schema:
	                              tool.parameters as Anthropic.Tool.InputSchema,
	                      }))
	                    : undefined;

	            try {
	                const response = await client.messages.create(
	                    {
	                        model: modelId,
                        max_tokens: maxTokens,
                        ...(system && { system }),
                        messages: mapMessages(messages),
                        temperature: params.temperature,
                        ...(tools && { tools }),
                    },
                    { signal: params.signal }
                );

                const textBlocks = response.content.filter(
                    (block: any) => block.type === 'text'
                );
                const text = textBlocks.map((block: any) => block.text).join('');

                const toolUseBlocks = response.content.filter(
                    (block: any) => block.type === 'tool_use'
                );

	                const toolCalls: ToolCall[] | undefined =
	                    toolUseBlocks.length > 0
	                        ? toolUseBlocks.map((block: any) => ({
	                              toolCallId: block.id,
	                              name: block.name,
	                              args: block.input,
	                          }))
	                        : undefined;

	                const promptTokens =
	                    response.usage?.input_tokens ?? undefined;
	                const completionTokens =
	                    response.usage?.output_tokens ?? undefined;

	                return {
	                    text,
	                    finishReason: mapAnthropicFinishReason(response.stop_reason),
	                    usage: response.usage
	                        ? {
	                              promptTokens,
	                              completionTokens,
	                              totalTokens:
	                                  (promptTokens ?? 0) +
	                                  (completionTokens ?? 0),
	                          }
	                        : undefined,
	                    toolCalls,
	                };
	            } catch (error) {
                if (error instanceof Anthropic.APIError) {
                    const headers = error.headers
                        ? Object.fromEntries(error.headers.entries())
                        : undefined;
                    throw new LLMApiError(
                        error.status ?? 500,
                        'anthropic',
                        undefined,
                        error.message,
                        error.error,
                        headers
                    );
                }
                throw error;
            }
	        },
	        async *doStream(params: GenerateParams) {
	            const systemMessages = params.messages.filter((m) => m.role === 'system');
	            const messages = params.messages.filter(
	                (m): m is NonSystemMessage => m.role !== 'system'
	            );
	            const system =
	                systemMessages.length > 0
	                    ? systemMessages.map((m) => ({
	                          type: 'text' as const,
	                          text: m.content,
	                      }))
	                    : undefined;

            const tools =
                params.tools && params.tools.length > 0
                    ? params.tools.map((tool) => ({
                          name: tool.name,
                          description: tool.description,
                          input_schema: tool.parameters as Anthropic.Tool.InputSchema,
                      }))
                    : undefined;

            try {
                const stream = await client.messages.create(
                    {
                        model: modelId,
                        max_tokens: params.maxTokens ?? 4096,
                        ...(system && { system }),
                        messages: mapMessages(messages),
                        temperature: params.temperature,
                        stream: true,
                        ...(tools && tools.length > 0 && { tools }),
                    },
                    { signal: params.signal }
                );

                const toolCalls: Record<string, ToolCall> = {};
                const partialJsonBuffers: Record<string, string> = {};
                const indexToId: Record<number, string> = {};
                let finishReason: StreamChunk['finishReason'];
                let usage: StreamChunk['usage'];

                for await (const event of stream) {
                    switch (event.type) {
                        case 'content_block_start':
                            if (event.content_block?.type === 'tool_use') {
                                const id = event.content_block.id;
                                indexToId[event.index] = id;
                                toolCalls[id] = {
                                    toolCallId: id,
                                    name: event.content_block.name,
                                    args: {},
                                };
                                partialJsonBuffers[id] = '';
                            }
                            break;

                        case 'content_block_delta':
                            if (event.delta?.type === 'text_delta') {
                                yield { kind: 'delta', text: event.delta.text };
                            }
                            if (event.delta?.type === 'input_json_delta') {
                                const id = indexToId[event.index];
                                const toolCall = id ? toolCalls[id] : undefined;
                                if (id && toolCall) {
                                    const buffer = (partialJsonBuffers[id] ?? '') + event.delta.partial_json;
                                    partialJsonBuffers[id] = buffer;
                                    try {
                                        toolCall.args = JSON.parse(buffer);
                                    } catch {
                                        // JSONが不完全な場合は次のデルタを待つ
                                    }
                                }
                            }
                            break;

	                        case 'message_delta': {
	                            if (event.delta?.stop_reason) {
	                                finishReason = mapAnthropicFinishReason(
	                                    event.delta.stop_reason
	                                );
	                            }
	                            if (event.usage) {
	                                usage = {
	                                    promptTokens:
	                                        event.usage.input_tokens ?? undefined,
	                                    completionTokens: event.usage.output_tokens,
	                                    totalTokens:
	                                        (event.usage.input_tokens || 0) +
	                                        (event.usage.output_tokens || 0),
	                                };
	                            }
	                            break;
	                        }

                        case 'message_stop': {
                            const toolCallList = Object.values(toolCalls);
                            yield {
                                kind: 'done',
                                finishReason,
                                usage,
                                toolCalls:
                                    toolCallList.length > 0
                                        ? toolCallList
                                        : undefined,
                            };
                            return;
                        }
                        default:
                            break;
                    }
                }
            } catch (error) {
                if (error instanceof Anthropic.APIError) {
                    const headers = error.headers
                        ? Object.fromEntries(error.headers.entries())
                        : undefined;
                    throw new LLMApiError(
                        error.status ?? 500,
                        'anthropic',
                        undefined,
                        error.message,
                        error.error,
                        headers
                    );
                }
                throw error;
            }
        },
    });
}
