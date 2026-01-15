import { describe, expect, it } from 'bun:test';
import { collectStreamResult, generateStreamText } from './generate-stream';
import type { LanguageModel, StreamChunk, ToolCall } from '../types';

describe('generateStreamText', () => {
    it('throws when model does not support streaming', async () => {
        const model: LanguageModel = {
            async doGenerate() {
                return { text: 'ok', finishReason: 'stop' };
            },
        };

        const iter = generateStreamText({
            model,
            messages: [{ role: 'user', content: 'hello' }],
        });

        await expect(async () => {
            for await (const _ of iter) {
                // no-op
            }
        }).toThrow('Model does not support streaming');
    });
});

describe('collectStreamResult', () => {
    it('accumulates deltas and returns done payload', async () => {
        const toolCalls: ToolCall[] = [
            {
                toolCallId: 'call_0',
                name: 'readFile',
                args: { path: 'hello.txt' },
            },
        ];

        const chunks: StreamChunk[] = [
            { kind: 'event' },
            { kind: 'delta', text: 'Hel' },
            { kind: 'delta', text: 'lo' },
            {
                kind: 'done',
                finishReason: 'tool_calls',
                usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
                toolCalls,
            },
        ];

        const model: LanguageModel = {
            async doGenerate() {
                return { text: 'ok', finishReason: 'stop' };
            },
            async *doStream() {
                for (const chunk of chunks) {
                    yield chunk;
                }
            },
        };

        const seenKinds: string[] = [];
        const result = await collectStreamResult({
            model,
            messages: [{ role: 'user', content: 'hello' }],
            onChunk: (chunk) => seenKinds.push(chunk.kind),
        });

        expect(seenKinds).toEqual(['event', 'delta', 'delta', 'done']);
        expect(result).toEqual({
            text: 'Hello',
            finishReason: 'tool_calls',
            usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
            toolCalls,
        });
    });
});

