import * as fs from 'fs/promises';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(process.cwd(), './workspace');
const MAX_FILE_SIZE = 100 * 1024; // 100KB

async function readFileExecute(args: { path: string }): Promise<string> {
    const absolutePath = path.resolve(WORKSPACE_ROOT, args.path);

    const allowedPrefix = WORKSPACE_ROOT + path.sep;
    if (!absolutePath.startsWith(allowedPrefix) && absolutePath !== WORKSPACE_ROOT) {
        throw new Error(`アクセス拒否: ${args.path} はワークスペース外です`);
    }

    // シンボリックリンクを解決して実パスを検証
    const realPath = await fs.realpath(absolutePath);
    if (!realPath.startsWith(allowedPrefix) && realPath !== WORKSPACE_ROOT) {
        throw new Error(`アクセス拒否: ${args.path} はシンボリックリンク経由でワークスペース外を参照しています`);
    }

    try {
        const stat = await fs.stat(absolutePath);
        // ファイル種別チェック
        if (!stat.isFile()) {
            throw new Error(`通常ファイルではありません: ${args.path}`);
        }
        if (stat.size > MAX_FILE_SIZE) {
            throw new Error(
                `ファイルが大きすぎます: ${args.path} (${Math.round(stat.size / 1024)}KB)。` +
                `100KB以下のファイルのみ読み込めます。`
            );
        }

        return await fs.readFile(absolutePath, 'utf-8');
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            throw new Error(`ファイルが見つかりません: ${args.path}`);
        }
        throw error;
    }
}

export const readFile = {
    name: 'readFile',
    description:
        'ワークスペース内の指定されたパスのファイル内容を文字列として読み込む。ファイルが存在しない場合はエラーを返す。100KBを超える巨大ファイルは読み込めない（コンテキストウィンドウ保護のため）。相対パスまたは絶対パスを指定できる。',
    needsApproval: false,
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: "読み込むファイルのパス（例: 'README.md', 'src/index.ts'）",
            },
        },
        required: ['path'],
    },
    execute: readFileExecute,
};
