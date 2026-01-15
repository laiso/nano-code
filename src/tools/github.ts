import { execCommand } from './execCommand';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const WORKSPACE_ROOT = join(process.cwd(), 'workspace');

// 一時ファイルにテキストを書き込み、ファイルパスを返す
// ワークスペース内に作成（execCommandのパスチェックを通すため）
function writeTempFile(content: string, prefix: string): string {
    // workspaceディレクトリがなければ作成
    if (!existsSync(WORKSPACE_ROOT)) {
        mkdirSync(WORKSPACE_ROOT, { recursive: true });
    }
    const tempPath = join(WORKSPACE_ROOT, `.${prefix}-${Date.now()}.txt`);
    writeFileSync(tempPath, content, 'utf-8');
    return tempPath;
}

export const createPullRequest = {
    name: 'createPullRequest',
    description: 'GitHub CLI を使って PR を作成する。既存のPRがある場合は更新する。',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "PRのタイトル"
            },
            body: {
                type: "string",
                description: "PRの本文"
            },
            head: {
                type: "string",
                description: "マージ元のブランチ名（例: 'fix/error-handling'）"
            },
            base: {
                type: "string",
                description: "マージ先のブランチ名（通常は 'main'）"
            }
        },
        required: ["title", "body", "head", "base"]
    },
    execute: async (args: {
        title: string;
        body: string;
        head: string;
        base: string;
    }) => {
        // 既存のPRをチェック
        const listCmd = `gh pr list --head ${args.head} --base ${args.base} --state open --json number`;
        const listResult = await execCommand.execute({ command: listCmd });

        // bodyを一時ファイルに書き込み（シェルメタ文字を回避）
        const bodyFile = writeTempFile(args.body, 'pr-body');

        try {
            const existingPRs = JSON.parse(listResult);
            if (existingPRs.length > 0) {
                // 既存PRがある場合は本文を更新
                const prNumber = existingPRs[0].number;
                const updateCmd = `gh pr edit ${prNumber} --body-file ${bodyFile}`;
                await execCommand.execute({ command: updateCmd });
                unlinkSync(bodyFile);
                return `既存のPR #${prNumber} を更新しました`;
            }
        } catch {
            // JSON パース失敗時は新規作成を試みる
        }

        // 新規PR作成（titleはシンプルな文字列を想定、bodyはファイル経由）
        const createCmd = `gh pr create --title "${args.title}" --body-file ${bodyFile} --base ${args.base} --head ${args.head}`;

        try {
            const result = await execCommand.execute({ command: createCmd });
            return `PRを作成しました: ${result}`;
        } finally {
            // 一時ファイルを削除
            try { unlinkSync(bodyFile); } catch { /* ignore */ }
        }
    }
};

export const createIssueComment = {
    name: 'createIssueComment',
    description: 'GitHub CLI を使って指定されたIssueにコメントを投稿する',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            issueNumber: {
                type: "number",
                description: "コメントするIssueの番号"
            },
            body: {
                type: "string",
                description: "コメントの本文"
            }
        },
        required: ["issueNumber", "body"]
    },
    execute: async (args: {
        issueNumber: number;
        body: string;
    }) => {
        // bodyを一時ファイルに書き込み（シェルメタ文字を回避）
        const bodyFile = writeTempFile(args.body, 'comment-body');
        try {
            const cmd = `gh issue comment ${args.issueNumber} --body-file ${bodyFile}`;
            await execCommand.execute({ command: cmd });
            return 'コメントを投稿しました';
        } finally {
            try { unlinkSync(bodyFile); } catch { /* ignore */ }
        }
    }
};
