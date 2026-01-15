import { collectStreamResult } from '../src/core/generate-stream';
import { createAnthropic } from '../src/providers/anthropic';
import { createGoogle } from '../src/providers/google';
import { createOpenAI } from '../src/providers/openai';
import type { Message } from '../src/types';

async function runProvider(label: string, model: any, messages: Message[]) {
    console.log(`--- ${label} (stream) ---`);
    const result = await collectStreamResult({
        model,
        messages,
        onChunk: (chunk) => {
            if (chunk.kind === 'event') {
                process.stdout.write('[event]');
            }
            if (chunk.kind === 'delta' && chunk.text) {
                process.stdout.write(chunk.text);
            }
        },
    });
    console.log('\nFinishReason:', result.finishReason);
    console.log('ToolCalls:', result.toolCalls?.length ?? 0);
    console.log('Usage:', result.usage);
    console.log();
}

async function main() {
    const messages: Message[] = [
        { role: 'user', content: 'AIエージェントとは何ですか？' },
    ];

    const openaiModel = process.env.OPENAI_MODEL_ID ?? 'gpt-5-mini';
    const anthropicModel =
        process.env.ANTHROPIC_MODEL_ID ?? 'claude-3-haiku-20240307';
    const googleModel = process.env.GOOGLE_MODEL_ID ?? 'gemini-2.5-flash';

    const openai = createOpenAI();
    const anthropic = createAnthropic();
    const google = createGoogle();

    await runProvider('OpenAI', openai(openaiModel), messages);
    await runProvider('Anthropic', anthropic(anthropicModel), messages);
    await runProvider('Google', google(googleModel), messages);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

