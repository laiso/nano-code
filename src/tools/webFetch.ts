// src/tools/webFetch.ts
import type { Tool } from '../types';
import { config } from '../config';

async function webFetchExecute(args: Record<string, unknown>): Promise<string> {
    const url = args.url as string;

    // URLのパース（バリデーション含む）
    let targetUrl: URL;
    try {
        targetUrl = new URL(url);
    } catch {
        throw new Error('無効なURL形式です');
    }

    // ガードレール: 許可リストのチェック
    const isAllowed = config.allowedDomains.some(domain =>
        targetUrl.hostname === domain || targetUrl.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
        throw new Error(
            `セキュリティエラー: ドメイン '${targetUrl.hostname}' へのアクセスは許可されていません。\n` +
            `許可リスト: ${config.allowedDomains.join(', ')}`
        );
    }

    // 実際のフェッチ処理
    const response = await fetch(url, { redirect: 'error' });
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return await response.text();
}

export const webFetch: Tool = {
    name: 'webFetch',
    description: '指定されたURLのWebページを取得します',
    needsApproval: true,
    parameters: {
        type: 'object',
        properties: {
            url: { type: 'string', description: '取得したいURL' },
        },
        required: ['url'],
    },
    execute: webFetchExecute,
};
