import type { GenerateParams, GenerateTextResult, LanguageModel } from '../types';
import { retryWithExponentialBackoff } from '../utils/retry';

export type GenerateTextParams = GenerateParams & {
    model: LanguageModel;
    maxRetries?: number;
};

export async function generateText(
    params: GenerateTextParams
): Promise<GenerateTextResult> {
    return retryWithExponentialBackoff(
        () =>
            params.model.doGenerate({
                messages: params.messages,
                temperature: params.temperature,
                maxTokens: params.maxTokens,
                tools: params.tools,
                signal: params.signal,
            }),
        params.maxRetries ?? 2
    );
}
