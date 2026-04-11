import { execCommand } from './execCommand';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../config';

const WORKSPACE_ROOT = config.workspaceRoot;

function validateBranchName(name: string): void {
    if (!name || name.length > 120) {
        throw new Error('ブランチ名が不正です');
    }
    if (name.startsWith('-') || name.startsWith(':')) {
        throw new Error('ブランチ名の先頭に - や : は使えません');
    }
    if (/\s/.test(name)) {
        throw new Error('ブランチ名に空白は使えません');
    }
    if (!/^[A-Za-z0-9._/-]+$/.test(name)) {
        throw new Error('ブランチ名に使用できない文字が含まれています');
    }
}

function validateTitle(title: string): void {
    if (!title || title.length > 200) {
        throw new Error('PRタイトルが不正です');
    }
    if (/[\r\n\0]/.test(title)) {
        throw new Error('PRタイトルに改行や制御文字は使えません');
    }
}

function writeTempFile(content: string, prefix: string): string {
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
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'PRのタイトル'
            },
            body: {
                type: 'string',
                description: 'PRの本文'
            },
            head: {
                type: 'string',
                description: "マージ元のブランチ名（例: 'fix/error-handling'）"
            },
            base: {
                type: 'string',
                description: "マージ先のブランチ名（通常は 'main'）"
            }
        },
        required: ['title', 'body', 'head', 'base']
    },
    execute: async (args: {
        title: string;
        body: string;
        head: string;
        base: string;
    }) => {
        validateTitle(args.title);
        validateBranchName(args.head);
        validateBranchName(args.base);

        const listResult = await execCommand.execute({
            commandName: 'gh',
            commandArgs: ['pr', 'list', '--head', args.head, '--base', args.base, '--state', 'open', '--json', 'number']
        });

        const bodyFile = writeTempFile(args.body, 'pr-body');

        try {
            const existingPRs = JSON.parse(listResult || '[]');
            if (Array.isArray(existingPRs) && existingPRs.length > 0) {
                const prNumber = String(existingPRs[0].number);
                await execCommand.execute({
                    commandName: 'gh',
                    commandArgs: ['pr', 'edit', prNumber, '--body-file', bodyFile]
                });
                return `既存のPR #${prNumber} を更新しました`;
            }
        } catch {
            // JSON パース失敗時は新規作成を試みる
        }

        try {
            const result = await execCommand.execute({
                commandName: 'gh',
                commandArgs: ['pr', 'create', '--title', args.title, '--body-file', bodyFile, '--base', args.base, '--head', args.head]
            });
            return `PRを作成しました: ${result}`;
        } finally {
            try { unlinkSync(bodyFile); } catch { /* ignore */ }
        }
    }
};

export const createIssueComment = {
    name: 'createIssueComment',
    description: 'GitHub CLI を使って指定されたIssueにコメントを投稿する',
    needsApproval: true,
    parameters: {
        type: 'object',
        properties: {
            issueNumber: {
                type: 'number',
                description: 'コメントするIssueの番号'
            },
            body: {
                type: 'string',
                description: 'コメントの本文'
            }
        },
        required: ['issueNumber', 'body']
    },
    execute: async (args: {
        issueNumber: number;
        body: string;
    }) => {
        if (!Number.isInteger(args.issueNumber) || args.issueNumber <= 0) {
            throw new Error('issueNumber は正の整数で指定してください');
        }

        const bodyFile = writeTempFile(args.body, 'comment-body');
        try {
            await execCommand.execute({
                commandName: 'gh',
                commandArgs: ['issue', 'comment', String(args.issueNumber), '--body-file', bodyFile]
            });
            return 'コメントを投稿しました';
        } finally {
            try { unlinkSync(bodyFile); } catch { /* ignore */ }
        }
    }
};
