import OpenAI from 'openai';
import type {
    GenerateParams,
    GenerateTextResult,
    LanguageModel,
    Message,
    Provider,
    StreamChunk,
    ToolCall,
} from '../types';
import { LLMApiError } from '../types';
import type { ProviderConfig } from './openai';

type ResponsesInput = OpenAI.Responses.ResponseInputItem;

function convertMessagesToInput(messages: Message[]): ResponsesInput[] {
    const input: ResponsesInput[] = [];

    for (const m of messages) {
        if (m.role === 'system') {
            // システムメッセージは `instructions` パラメータで渡す
            continue;
        }

        if (m.role === 'user') {
            input.push({
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text: m.content }],
            });
        }

        if (m.role === 'assistant') {
            if (m.content) {
                input.push({
                    type: 'message',
                    role: 'assistant',
                    content: [{ type: 'input_text', text: m.content }],
                });
            }

            if (m.toolCalls) {
                for (const tc of m.toolCalls) {
                    input.push({
                        type: 'function_call',
                        call_id: tc.toolCallId,
                        name: tc.name,
                        arguments: JSON.stringify(tc.args),
                    });
                }
            }
        }

        if (m.role === 'tool') {
            input.push({
                type: 'function_call_output',
                call_id: m.toolCallId,
                output: m.content,
            });
        }
    }

    return input;
}

function extractSystemMessage(messages: Message[]): string | undefined {
    const system = messages.find((m) => m.role === 'system');
    return system?.content;
}

function convertToolsToFunctions(
    tools?: GenerateParams['tools']
): OpenAI.Responses.FunctionTool[] | undefined {
    if (!tools || tools.length === 0) return undefined;

    return tools.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as Record<string, unknown>,
        strict: true,
    }));
}

function mapFinishReason(status?: string): GenerateTextResult['finishReason'] {
    switch (status) {
        case 'completed':
            return 'stop';
        case 'incomplete':
            return 'length';
        case 'failed':
        case 'cancelled':
            return 'error';
        default:
            return 'stop';
    }
}

function parseJsonArgs(raw: string): Record<string, unknown> {
    try {
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function convertResponseToResult(
    response: OpenAI.Responses.Response
): GenerateTextResult {
    const messageItem = response.output.find(
        (item): item is OpenAI.Responses.ResponseOutputMessage => item.type === 'message'
    );

    const textContent = messageItem?.content.find(
        (c): c is OpenAI.Responses.ResponseOutputText => c.type === 'output_text'
    );

    const functionCalls = response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === 'function_call'
    );

    const toolCalls: ToolCall[] | undefined =
        functionCalls.length > 0
            ? functionCalls.map((fc) => ({
                  toolCallId: fc.call_id,
                  name: fc.name,
                  args: parseJsonArgs(fc.arguments),
              }))
            : undefined;

    return {
        text: textContent?.text || '',
        finishReason: toolCalls?.length ? 'tool_calls' : mapFinishReason(response.status),
        usage: response.usage
            ? {
                  promptTokens: response.usage.input_tokens,
                  completionTokens: response.usage.output_tokens,
                  totalTokens: response.usage.total_tokens,
              }
            : undefined,
        toolCalls,
    };
}

export function createOpenAIResponses(config: ProviderConfig = {}): Provider {
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    const baseURL = config.baseURL ?? 'https://api.openai.com/v1';

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY 環境変数が設定されていません');
    }

    const client = new OpenAI({
        apiKey,
        baseURL,
        maxRetries: config.maxRetries ?? 0,
    });

    return (modelId: string): LanguageModel => ({
        async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
            const input = convertMessagesToInput(params.messages);
            const instructions = extractSystemMessage(params.messages);
            const tools = convertToolsToFunctions(params.tools);

            try {
                const response = await client.responses.create(
                    {
                        model: modelId,
                        input,
                        ...(instructions && { instructions }),
                        ...(tools && { tools }),
                        store: false,
                        ...(params.temperature !== undefined && {
                            temperature: params.temperature,
                        }),
                        ...(params.maxTokens !== undefined && {
                            max_output_tokens: params.maxTokens,
                        }),
                    },
                    { signal: params.signal }
                );

                return convertResponseToResult(response);
            } catch (error) {
                if (error instanceof OpenAI.APIError) {
                    const headers = error.headers
                        ? Object.fromEntries(error.headers.entries())
                        : undefined;
                    throw new LLMApiError(
                        error.status ?? 500,
                        'openai-responses',
                        error.code ?? undefined,
                        error.message,
                        error.error,
                        headers
                    );
                }
                throw error;
            }
        },

        async *doStream(params: GenerateParams): AsyncIterable<StreamChunk> {
            const input = convertMessagesToInput(params.messages);
            const instructions = extractSystemMessage(params.messages);
            const tools = convertToolsToFunctions(params.tools);

            try {
                const stream = await client.responses.create(
                    {
                        model: modelId,
                        input,
                        ...(instructions && { instructions }),
                        ...(tools && { tools }),
                        store: false,
                        stream: true,
                        ...(params.temperature !== undefined && {
                            temperature: params.temperature,
                        }),
                        ...(params.maxTokens !== undefined && {
                            max_output_tokens: params.maxTokens,
                        }),
                    },
                    { signal: params.signal }
                );

                const toolCallBuffer: Record<
                    string,
                    { callId: string; name: string; argsText: string }
                > = {};
                let finishReason: StreamChunk['finishReason'];
                let usage: StreamChunk['usage'];
                let emittedReasoning = false;

                for await (const event of stream) {
                    switch (event.type) {
                        case 'response.output_text.delta':
                            if (event.delta) {
                                yield { kind: 'delta', text: event.delta };
                            }
                            break;

                        case 'response.output_item.added':
                            if (event.item.type === 'function_call' && event.item.id) {
                                toolCallBuffer[event.item.id] = {
                                    callId: event.item.call_id,
                                    name: event.item.name,
                                    argsText: event.item.arguments || '',
                                };
                            }
                            break;

                        case 'response.function_call_arguments.delta': {
                            const entry = toolCallBuffer[event.item_id];
                            if (entry) {
                                entry.argsText += event.delta;
                            }
                            break;
                        }

                        case 'response.function_call_arguments.done': {
                            const entry = toolCallBuffer[event.item_id];
                            if (entry) {
                                entry.argsText = event.arguments;
                            }
                            break;
                        }

                        case 'response.reasoning_text.delta':
                        case 'response.reasoning_summary_text.delta':
                        case 'response.reasoning_summary_part.added':
                            if (!emittedReasoning) {
                                emittedReasoning = true;
                                yield { kind: 'event' };
                            }
                            break;

                        case 'error':
                            throw new LLMApiError(
                                500,
                                'openai-responses',
                                event.code ?? undefined,
                                event.message,
                                event
                            );

                        case 'response.completed':
                        case 'response.incomplete':
                        case 'response.failed': {
                            const toolCalls = Object.values(toolCallBuffer).map(
                                (tc) => ({
                                    toolCallId: tc.callId,
                                    name: tc.name,
                                    args: parseJsonArgs(tc.argsText),
                                })
                            );

                            finishReason =
                                toolCalls.length > 0
                                    ? 'tool_calls'
                                    : mapFinishReason(event.response.status);

                            if (event.response.usage) {
                                usage = {
                                    promptTokens: event.response.usage.input_tokens,
                                    completionTokens:
                                        event.response.usage.output_tokens,
                                    totalTokens: event.response.usage.total_tokens,
                                };
                            }

                            yield {
                                kind: 'done',
                                finishReason,
                                usage,
                                toolCalls:
                                    toolCalls.length > 0 ? toolCalls : undefined,
                            };
                            return;
                        }

                        default:
                            break;
                    }
                }
            } catch (error) {
                if (error instanceof OpenAI.APIError) {
                    const headers = error.headers
                        ? Object.fromEntries(error.headers.entries())
                        : undefined;
                    throw new LLMApiError(
                        error.status ?? 500,
                        'openai-responses',
                        error.code ?? undefined,
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
