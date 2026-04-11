import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config';

const WORKSPACE_ROOT = config.workspaceRoot;

async function editFileExecute(args: {
    path: string;
    oldText: string;
    newText: string;
}): Promise<string> {
    const absolutePath = path.resolve(WORKSPACE_ROOT, args.path);

    const allowedPrefix = WORKSPACE_ROOT + path.sep;
    if (!absolutePath.startsWith(allowedPrefix) && absolutePath !== WORKSPACE_ROOT) {
        throw new Error(`アクセス拒否: ${args.path} はワークスペース外です`);
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    const matches = content.split(args.oldText).length - 1;

    if (matches === 0) {
        throw new Error(`変更対象が見つかりません: ${args.oldText.slice(0, 50)}...`);
    }
    if (matches > 1) {
        throw new Error(`複数の候補が見つかりました（${matches}箇所）。より具体的な範囲を指定してください`);
    }

    const backupPath = `${absolutePath}.backup`;
    await fs.copyFile(absolutePath, backupPath);

    const newContent = content.replace(args.oldText, args.newText);
    await fs.writeFile(absolutePath, newContent, 'utf-8');

    return `ファイルを編集しました: ${args.oldText.slice(0, 30)}... → ${args.newText.slice(0, 30)}...`;
}

export const editFile = {
    name: 'editFile',
    description:
        'ファイルの一部を編集する。oldTextで指定した箇所をnewTextに置き換える。oldTextが複数見つかる場合はエラーを返すため、一意に特定できる範囲を指定すること。ファイル全体を読み書きするよりトークン消費が少ない。',
    needsApproval: true,
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: '編集するファイルのパス' },
            oldText: {
                type: 'string',
                description: '変更前のテキスト（一意に特定できる範囲を指定）',
            },
            newText: { type: 'string', description: '変更後のテキスト' },
        },
        required: ['path', 'oldText', 'newText'],
    },
    execute: editFileExecute,
};
