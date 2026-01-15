import { describe, expect, it } from 'bun:test';
import { generateText } from './generate-text';
import type { GenerateParams, LanguageModel, Message } from '../types';
import { LLMApiError } from '../types';

describe('generateText', () => {
	    it('passes GenerateParams through to model.doGenerate', async () => {
	        let received: GenerateParams | null = null;
	        const model: LanguageModel = {
	            async doGenerate(params) {
	                received = params;
	                return { text: 'ok', finishReason: 'stop' };
	            },
	        };

        const messages: Message[] = [{ role: 'user', content: 'hello' }];
        const result = await generateText({
            model,
            messages,
            temperature: 0.25,
            maxTokens: 123,
            maxRetries: 0,
	        });

	        expect(result.text).toBe('ok');
	        expect(received).not.toBeNull();
	        expect(received!).toEqual({
	            messages,
	            temperature: 0.25,
	            maxTokens: 123,
	            tools: undefined,
	            signal: undefined,
	        });
	    });

    it('retries transient LLMApiError failures', async () => {
        let calls = 0;
        const model: LanguageModel = {
            async doGenerate() {
                calls += 1;
                if (calls < 3) {
                    throw new LLMApiError(
                        429,
                        'test-provider',
                        'rate_limit',
                        'rate limited',
                        undefined,
                        { 'retry-after-ms': '0' }
                    );
                }
                return { text: 'ok', finishReason: 'stop' };
            },
        };

        const messages: Message[] = [{ role: 'user', content: 'hello' }];
        const result = await generateText({ model, messages, maxRetries: 2 });

        expect(result.text).toBe('ok');
        expect(calls).toBe(3);
    });
});
