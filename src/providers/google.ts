import type {
    GenerateParams,
    GenerateTextResult,
    LanguageModel,
    Provider,
    ToolCall,
    StreamChunk,
} from '../types';
import { LLMApiError } from '../types';
import { GoogleGenAI, type Content, type Part } from '@google/genai';

export type ProviderConfig = {
    apiKey?: string;
};

function mapGoogleFinishReason(
    finishReason: string | null | undefined,
    hasFunctionCall: boolean
): GenerateTextResult['finishReason'] {
    if (hasFunctionCall) {
        return 'tool_calls';
    }
    const normalized = finishReason?.toUpperCase();
    switch (normalized) {
        case 'STOP':
            return 'stop';
        case 'MAX_TOKENS':
            return 'length';
        case 'SAFETY':
        case 'RECITATION':
            return 'content_filter';
        default:
            return 'stop';
    }
}

function convertMessages(messages: GenerateParams['messages']): Content[] {
    return messages
        .filter((m) => m.role !== 'system')
        .map((message) => {
            if (message.role === 'tool') {
                return {
                    role: 'user',
                    parts: [
                        {
                            functionResponse: {
                                name: message.name,
                                response: { result: message.content },
                            },
                        },
                    ],
                };
            }

            if (message.role === 'assistant' && message.toolCalls) {
                const parts: Part[] = [];
                if (message.content) {
                    parts.push({ text: message.content });
                }
                message.toolCalls.forEach((tc) => {
                    parts.push({ functionCall: { name: tc.name, args: tc.args } });
                });
                return { role: 'model', parts };
            }

            return {
                role: message.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: message.content }],
            };
        });
}

export function createGoogle(config: ProviderConfig = {}): Provider {
    const apiKey =
        config.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        throw new Error(
            'GEMINI_API_KEY (or GOOGLE_API_KEY) environment variable is required'
        );
    }

    const ai = new GoogleGenAI({ apiKey });

    return (modelId: string): LanguageModel => ({
        async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
            const systemMessages = params.messages.filter((m) => m.role === 'system');
            const messages = params.messages.filter((m) => m.role !== 'system');

            const systemInstruction =
                systemMessages.length > 0
                    ? { parts: systemMessages.map((m) => ({ text: m.content })) }
                    : undefined;

            const tools =
                params.tools && params.tools.length > 0
                    ? [
                          {
                              functionDeclarations: params.tools.map((tool) => ({
                                  name: tool.name,
                                  description: tool.description,
                                  parameters: tool.parameters,
                              })),
                          },
                      ]
                    : undefined;

            try {
                const response = await ai.models.generateContent({
                    model: modelId,
                    contents: convertMessages(messages),
                    ...(systemInstruction && { systemInstruction }),
                    ...(tools && { tools }),
                    config: {
                        temperature: params.temperature,
                        maxOutputTokens: params.maxTokens,
                    },
                });

                const candidate = response.candidates?.[0];
                if (!candidate?.content?.parts) {
                    return {
                        text: '',
                        finishReason: 'content_filter',
                        usage: {
                            promptTokens: response.usageMetadata?.promptTokenCount,
                        },
                    };
                }

                const parts = candidate.content.parts;
                const textParts = parts.filter((p: any) => p.text);
                const text = textParts.map((p: any) => p.text).join('');
                const functionCallParts = parts.filter(
                    (p: any) => p.functionCall !== undefined
                );

                const toolCalls: ToolCall[] | undefined =
                    functionCallParts.length > 0
                        ? functionCallParts.map((p: any, index: number) => ({
                              toolCallId: `call_${index}`,
                              name: p.functionCall.name,
                              args: p.functionCall.args ?? {},
                          }))
                        : undefined;

                return {
                    text,
                    finishReason: mapGoogleFinishReason(
                        candidate.finishReason,
                        !!toolCalls?.length
                    ),
                    usage: {
                        promptTokens: response.usageMetadata?.promptTokenCount,
                        completionTokens:
                            response.usageMetadata?.candidatesTokenCount,
                    },
                    toolCalls,
                };
            } catch (error) {
                throw new LLMApiError(
                    500,
                    'google',
                    undefined,
                    error instanceof Error ? error.message : String(error),
                    error
                );
            }
        },

        async *doStream(params: GenerateParams) {
            const systemMessages = params.messages.filter((m) => m.role === 'system');

            const systemInstruction =
                systemMessages.length > 0
                    ? { parts: systemMessages.map((m) => ({ text: m.content })) }
                    : undefined;

            const tools =
                params.tools && params.tools.length > 0
                    ? [
                          {
                              functionDeclarations: params.tools.map((tool) => ({
                                  name: tool.name,
                                  description: tool.description,
                                  parameters: tool.parameters,
                              })),
                          },
                      ]
                    : undefined;

            try {
                const stream = await ai.models.generateContentStream({
                    model: modelId,
                    contents: convertMessages(params.messages),
                    ...(systemInstruction && { systemInstruction }),
                    ...(tools && { tools }),
                    config: {
                        temperature: params.temperature,
                        maxOutputTokens: params.maxTokens,
                    },
                });

                const toolCalls: Record<string, ToolCall> = {};
                let toolCallIndex = 0;
                let finishReason: StreamChunk['finishReason'];
                let usage: StreamChunk['usage'];

                for await (const chunk of stream) {
                    const candidate = chunk.candidates?.[0];
                    const parts: any[] = candidate?.content?.parts ?? [];

                    for (const part of parts) {
                        if (part.text) {
                            yield { kind: 'delta', text: part.text };
                        }

                        if (part.functionCall) {
                            const id = `call_${toolCallIndex++}`;
                            toolCalls[id] = {
                                toolCallId: id,
                                name: part.functionCall.name,
                                args: part.functionCall.args || {},
                            };
                        }
                    }

                    if (candidate?.finishReason) {
                        finishReason = mapGoogleFinishReason(
                            candidate.finishReason,
                            Object.keys(toolCalls).length > 0
                        );
                    }

                    if (chunk.usageMetadata) {
                        const promptTokens = chunk.usageMetadata.promptTokenCount;
                        const completionTokens =
                            chunk.usageMetadata.candidatesTokenCount;
                        usage = {
                            promptTokens,
                            completionTokens,
                            totalTokens:
                                (promptTokens || 0) + (completionTokens || 0),
                        };
                    }
                }

                const toolCallList = Object.values(toolCalls);
                yield {
                    kind: 'done',
                    finishReason,
                    usage,
                    toolCalls: toolCallList.length > 0 ? toolCallList : undefined,
                };
            } catch (error) {
                throw new LLMApiError(
                    500,
                    'google',
                    undefined,
                    error instanceof Error ? error.message : String(error),
                    error
                );
            }
        },
    });
}
