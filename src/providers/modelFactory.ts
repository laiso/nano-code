import { createOpenAI } from './openai';
import { createOpenAIResponses } from './openai-responses';
import { createAnthropic } from './anthropic';
import { createGoogle } from './google';
import type { LanguageModel } from '../types';

export function createModelFromEnv(options?: { useResponses?: boolean }): LanguageModel {
    const provider = process.env.LLM_PROVIDER;
    const modelName = process.env.LLM_MODEL;
    const apiKey = process.env.LLM_API_KEY;
    const useResponses = options?.useResponses ?? process.env.USE_RESPONSES_API === 'true';

    if (!provider) {
        throw new Error('LLM_PROVIDER 環境変数が設定されていません');
    }
    if (!modelName) {
        throw new Error('LLM_MODEL 環境変数が設定されていません');
    }
    if (!apiKey) {
        throw new Error('LLM_API_KEY 環境変数が設定されていません');
    }

    switch (provider.toLowerCase()) {
        case 'openai': {
            if (useResponses) {
                const openai = createOpenAIResponses({ apiKey });
                return openai(modelName);
            }
            const openai = createOpenAI({ apiKey });
            return openai(modelName);
        }
        case 'anthropic': {
            const anthropic = createAnthropic({ apiKey });
            return anthropic(modelName);
        }
        case 'google': {
            const google = createGoogle({ apiKey });
            return google(modelName);
        }
        default:
            throw new Error(`未対応のプロバイダ: ${provider}. 対応プロバイダ: openai, anthropic, google`);
    }
}

