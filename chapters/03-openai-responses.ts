import { generateText } from '../src/core/generate-text';
import { collectStreamResult } from '../src/core/generate-stream';
import { createOpenAIResponses } from '../src/providers/openai-responses';
import type { Message } from '../src/types';

async function main() {
    const messages: Message[] = [
        { role: 'user', content: 'AIエージェントとは何ですか？' },
    ];

    const modelId = process.env.OPENAI_MODEL_ID ?? 'gpt-5-mini';
    const openai = createOpenAIResponses();
    const model = openai(modelId);

    console.log('--- OpenAI Responses (non-stream) ---');
    const result = await generateText({ model, messages });
    console.log('Result:', result.text);
    console.log('FinishReason:', result.finishReason);
    console.log('ToolCalls:', result.toolCalls?.length ?? 0);

    console.log('\n--- OpenAI Responses (stream) ---');
    const streamed = await collectStreamResult({
        model,
        messages,
        onChunk: (chunk) => {
            if (chunk.kind === 'event') {
                process.stdout.write('[reasoning]');
            }
            if (chunk.kind === 'delta' && chunk.text) {
                process.stdout.write(chunk.text);
            }
        },
    });
    console.log('\nFinishReason:', streamed.finishReason);
    console.log('ToolCalls:', streamed.toolCalls?.length ?? 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

