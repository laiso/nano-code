import { spawn } from 'child_process';
import * as path from 'path';
import type { Tool } from '../types';
import { config } from '../config';

const WORKSPACE_ROOT = config.workspaceRoot;
const ALLOWED_COMMANDS = ['bun', 'ls', 'cat', 'grep', 'find', 'pwd', 'mkdir', 'git', 'gh'];
const MAX_OUTPUT_LENGTH = 2000;

type Quote = '"' | "'" | null;
type ExecCommandInput = {
    command?: unknown;
    commandName?: unknown;
    commandArgs?: unknown;
};

// 引用符付き引数をサポートする最小限のコマンドパーサ
export function parseCommand(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let quote: Quote = null;
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i] as string;

        if (quote) {
            if (escaped) {
                current += ch;
                escaped = false;
                continue;
            }

            if (ch === '\\' && quote === '"') {
                escaped = true;
                continue;
            }

            if (ch === quote) {
                quote = null;
                continue;
            }

            current += ch;
            continue;
        }

        // 引用符のエスケープ以外ではバックスラッシュを保持（Windowsパス対応）
        if (ch === '\\') {
            const nextCh = input[i + 1];
            if (nextCh === '"' || nextCh === "'") {
                current += nextCh;
                i++;
                continue;
            }
            current += ch;
            continue;
        }

        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }

        if (/\s/.test(ch)) {
            if (current.length > 0) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += ch;
    }

    if (quote) {
        throw new Error(`閉じられていない引用符: ${quote}`);
    }

    if (current.length > 0) {
        tokens.push(current);
    }

    return tokens;
}

async function execCommandExecute(args: Record<string, unknown>): Promise<string> {
    const input = args as ExecCommandInput;
    let commandName = '';
    let commandArgs: string[] = [];
    let commandForCheck = '';

    if (typeof input.command === 'string') {
        const command = input.command;
        const dangerousChars = /[;&`$]/;
        if (dangerousChars.test(command)) {
            throw new Error('セキュリティ上の理由により、シェルメタ文字を含むコマンドは実行できません');
        }

        const parts = parseCommand(command);
        commandName = parts[0] || '';
        commandArgs = parts.slice(1);
        commandForCheck = command;
    } else if (typeof input.commandName === 'string') {
        commandName = input.commandName;
        if (Array.isArray(input.commandArgs)) {
            if (!input.commandArgs.every((arg) => typeof arg === 'string')) {
                throw new Error('commandArgs は文字列配列で指定してください');
            }
            commandArgs = input.commandArgs as string[];
        }
        commandForCheck = [commandName, ...commandArgs].join(' ');
    } else {
        throw new Error('command または commandName を指定してください');
    }

    if (!commandName) {
        throw new Error('コマンドが空です');
    }

    if (!ALLOWED_COMMANDS.includes(commandName)) {
        throw new Error(`コマンド ${commandName} は許可されていません`);
    }

    const dangerousPatterns = [/rm\s+-rf/, />\s*\/dev/, /curl.*\|.*sh/, /wget.*\|.*sh/];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(commandForCheck)) {
            throw new Error('危険なコマンドパターンが検出されました');
        }
    }

    for (const arg of commandArgs) {
        if (arg.startsWith('/') || arg.startsWith('.') || arg.includes('/') || arg.includes('\\')) {
            const resolvedPath = path.resolve(WORKSPACE_ROOT, arg);
            const allowedPrefix = WORKSPACE_ROOT + path.sep;
            if (!resolvedPath.startsWith(allowedPrefix) && resolvedPath !== WORKSPACE_ROOT) {
                throw new Error(`アクセス拒否: ${arg} はワークスペース外です`);
            }
        }
    }

    return new Promise((resolve, reject) => {
        const child = spawn(commandName, commandArgs, {
            cwd: WORKSPACE_ROOT,
            timeout: 30000,
            shell: false,
        });

        let stdout = '';
        let stderr = '';
        let stdoutTruncated = false;
        let stderrTruncated = false;

        child.stdout.on('data', (data: Buffer) => {
            if (stdout.length < MAX_OUTPUT_LENGTH) {
                stdout += data.toString();
                if (stdout.length >= MAX_OUTPUT_LENGTH) {
                    stdoutTruncated = true;
                }
            }
        });

        child.stderr.on('data', (data: Buffer) => {
            if (stderr.length < MAX_OUTPUT_LENGTH) {
                stderr += data.toString();
                if (stderr.length >= MAX_OUTPUT_LENGTH) {
                    stderrTruncated = true;
                }
            }
        });

        child.on('close', (code: number | null) => {
            if (stdoutTruncated) {
                stdout = stdout.slice(0, MAX_OUTPUT_LENGTH) + '\n... (出力が長いため省略されました)';
            }
            if (stderrTruncated) {
                stderr = stderr.slice(0, MAX_OUTPUT_LENGTH) + '\n... (出力が長いため省略されました)';
            }

            if (code === 0) {
                // stderrは必ずしもエラーではない（gitはブランチ切替等をstderrに出力する）
                resolve(stdout + (stderr ? `\n(stderr: ${stderr.trim()})` : ''));
            } else {
                reject(new Error(`コマンドが異常終了しました (exit code: ${code})\n${stderr}`));
            }
        });

        child.on('error', (error: Error) => {
            reject(new Error(`コマンド実行エラー: ${error.message}`));
        });
    });
}

export const execCommand: Tool = {
    name: 'execCommand',
    description:
        'ワークスペース内で許可された汎用コマンドを実行する。利用可能：bun test、ls、cat、grep、find、pwd、mkdir。',
    needsApproval: true,
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: "実行するコマンド（例: 'bun test', 'ls -la'）",
            },
        },
        required: ['command'],
    },
    execute: execCommandExecute,
};
