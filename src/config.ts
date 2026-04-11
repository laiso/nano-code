// src/config.ts
import * as path from 'path';

export let config = {
    // ワークスペースルート（デフォルト: cwd = リポジトリルート）
    workspaceRoot: path.resolve(process.env.NANO_CODE_WORKSPACE || process.cwd()),
    // Layer 2: プロセス隔離（bubblewrap）
    sandbox: false,
    // Layer 3: アプリケーション層の設定
    allowedDomains: ['api.github.com', 'github.com'],
};
