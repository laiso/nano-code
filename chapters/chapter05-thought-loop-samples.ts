import { readFile } from '../src/tools/readFile';
import { writeFile } from '../src/tools/writeFile';
import { execCommand } from '../src/tools/execCommand';
import { generateText } from '../src/core/generate-text';
import type { LanguageModel, Message, Tool } from '../src/types';

const defaultTools: Tool[] = [
    readFile as unknown as Tool,
    writeFile as unknown as Tool,
    execCommand as unknown as Tool,
];

// 5.1節：シンプルなチャット（ツールなし、ループなし）
export async function simpleChat(
    model: LanguageModel,
    userMessage: string
): Promise<string> {
    const messages: Message[] = [
        { role: 'system', content: 'あなたは親切なアシスタントです。' },
        { role: 'user', content: userMessage },
    ];

    const response = await generateText({
        model,
        messages,
        maxTokens: 400,
    });

    return response.text;
}

// 5.2節：シンプルな思考ループ（ツールなし）
export async function chatLoop(
    model: LanguageModel,
    userMessage: string
): Promise<string[]> {
    const messages: Message[] = [
        { role: 'system', content: 'あなたは親切なアシスタントです。' },
        { role: 'user', content: userMessage },
    ];
    const transcripts: string[] = [];

    while (true) {
        const response = await generateText({
            model,
            messages,
            maxTokens: 400,
        });

        if (response.text) {
            transcripts.push(response.text);
        }

        if (response.finishReason === 'stop') {
            break;
        }

        messages.push({
            role: 'assistant',
            content: response.text,
        });
    }

    return transcripts;
}

// 5.3節：1サイクルの動作（ツールを1回使う）
export async function singleCycleAgent(
    model: LanguageModel,
    userMessage: string
): Promise<void> {
    const tools: Tool[] = [readFile as unknown as Tool];
    const messages: Message[] = [
        { role: 'system', content: 'あなたはファイル操作ができるアシスタントです。' },
        { role: 'user', content: userMessage },
    ];

    const response = await generateText({ model, messages, tools });

    console.log('[LLM応答]', response.text);

    if (!response.toolCalls || response.toolCalls.length === 0) {
        console.log('[ツール呼び出し] なし');
        return;
    }

    const toolCall = response.toolCalls[0];
    if (!toolCall) {
        console.log('[ツール呼び出し] 空の配列');
        return;
    }
    console.log('[ツール要求]', toolCall.name, toolCall.args);

    const tool = tools.find((entry) => entry.name === toolCall.name);
    if (!tool) {
        throw new Error(`不明なツール: ${toolCall.name}`);
    }

    const result = await tool.execute(toolCall.args);
    console.log('[ツール結果]', result.slice(0, 100));

    messages.push({
        role: 'assistant',
        content: response.text,
        toolCalls: response.toolCalls,
    });
    messages.push({
        role: 'tool',
        toolCallId: toolCall.toolCallId,
        name: toolCall.name,
        content: result,
    });

    console.log('1サイクル完了');
}

// 5.4節、5.6節：ツール実行関数（エラーハンドリング付き）
async function executeTool(tool: Tool, args: Record<string, unknown>): Promise<string> {
    try {
        return await tool.execute(args);
    } catch (err: any) {
        return `エラー: ${err?.message ?? '不明なエラー'}`;
    }
}

// 5.4節：ツール対応の思考ループ（原稿のgenerate関数に相当）
export async function agentLoop(
    model: LanguageModel,
    userMessage: string
): Promise<void> {
    const tools = defaultTools;
    const messages: Message[] = [
        { role: 'system', content: 'あなたはファイル操作ができるアシスタントです。' },
        { role: 'user', content: userMessage },
    ];

    while (true) {
        const response = await generateText({ model, messages, tools, maxTokens: 400 });

        if (response.text) {
            console.log(`[LLM応答] ${response.text}`);
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
            messages.push({
                role: 'assistant',
                content: response.text,
                toolCalls: response.toolCalls,
            });

            for (const toolCall of response.toolCalls) {
                console.log(`[ツール実行] ${toolCall.name}`);
                const tool = tools.find((t) => t.name === toolCall.name);
                if (!tool) {
                    throw new Error(`不明なツール: ${toolCall.name}`);
                }
                const result = await executeTool(tool, toolCall.args);
                messages.push({
                    role: 'tool',
                    toolCallId: toolCall.toolCallId,
                    name: toolCall.name,
                    content: result,
                });
            }

            continue;
        }

        messages.push({
            role: 'assistant',
            content: response.text,
        });

        if (response.finishReason === 'stop') {
            break;
        }
    }
}