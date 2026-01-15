import { generateText } from '../src/core/generate-text';
import { createAnthropic } from '../src/providers/anthropic';
import { createGoogle } from '../src/providers/google';
import { createOpenAI } from '../src/providers/openai';
import type { Message } from '../src/types';

// 実際のAPIを呼び出すためモックfetchは削除済み

async function main() {
    const messages: Message[] = [
        { role: 'user', content: 'AIエージェントとは何ですか？' }
    ];

    const openaiModel = process.env.OPENAI_MODEL_ID ?? 'gpt-5-mini';
    const anthropicModel = process.env.ANTHROPIC_MODEL_ID ?? 'claude-haiku-4-5-20251001'
    const googleModel = process.env.GOOGLE_MODEL_ID ?? 'gemini-2.5-flash';

    console.log('--- OpenAI ---');
    const openai = createOpenAI();
    try {
        const res1 = await generateText({ model: openai(openaiModel), messages });
        console.log('Result:', res1.text);
    } catch (error) {
        console.error('[OpenAI] error:', error);
    }

    console.log('\n--- Anthropic ---');
    const anthropic = createAnthropic();
    try {
        const res2 = await generateText({ model: anthropic(anthropicModel), messages });
        console.log('Result:', res2.text);
    } catch (error) {
        console.error('[Anthropic] error:', error);
    }

    console.log('\n--- Google ---');
    const google = createGoogle();
    try {
        const res3 = await generateText({ model: google(googleModel), messages });
        console.log('Result:', res3.text);
    } catch (error) {
        console.error('[Google] error:', error);
    }
}

main().catch(console.error);
