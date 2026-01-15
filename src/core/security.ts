import * as path from 'path';

// 機密ファイルのパターン
const SENSITIVE_FILE_PATTERNS = [
    /\.env$/,
    /\.env\./,
    /credentials\.json$/,
    /\.ssh\/id_rsa$/,
    /\.pgpass$/,
    /\.kube\/config$/,
    /\.aws\/credentials$/,
];

export function isSensitiveFile(filePath: string): boolean {
    return SENSITIVE_FILE_PATTERNS.some(pattern =>
        pattern.test(path.normalize(filePath))
    );
}

// 危険なコマンドパターン
const DANGEROUS_PATTERNS = [
    /[^\\]>/,                // リダイレクト（>、>>）
    /\$\(/,                  // コマンド置換 $()
    /`/,                     // バッククォート置換
    /\beval\b/,              // eval
    /\$\{[^}]*##/,          // 変数難読化
];

export function isDangerousCommand(command: string): { dangerous: boolean; reason?: string } {
    if (/\bsudo\b/.test(command)) {
        return { dangerous: true, reason: 'sudo による権限昇格は禁止されています' };
    }
    if (DANGEROUS_PATTERNS.some(pattern => pattern.test(command))) {
        return { dangerous: true, reason: '危険なパターンが検出されました' };
    }
    return { dangerous: false };
}

const ALLOWED_ENV_VARS = [
    'PATH',
    'HOME',
    'USER',
    'LANG',
    'NODE_ENV',
    'BUN_ENV',
];

export function filterEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return Object.fromEntries(
        Object.entries(env).filter(([key]) => ALLOWED_ENV_VARS.includes(key))
    );
}
