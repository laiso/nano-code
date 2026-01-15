import { execCommand } from './execCommand';

export const createBranch = {
    name: 'createBranch',
    description: '新しい Git ブランチを作成する。ローカルまたはリモートに既存のブランチがある場合はタイムスタンプを付与して作成する。',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            branchName: {
                type: "string",
                description: "作成するブランチ名（例: 'fix/error-handling'）"
            }
        },
        required: ["branchName"]
    },
    execute: async (args: { branchName: string }) => {
        let branchName = args.branchName;
        let needsTimestamp = false;

        // ローカルブランチの存在確認
        try {
            await execCommand.execute({
                command: `git rev-parse --verify ${branchName}`
            });
            needsTimestamp = true;
        } catch {
            // ローカルには存在しない
        }

        // リモートブランチの存在確認（衝突回避のため）
        if (!needsTimestamp) {
            try {
                await execCommand.execute({
                    command: `git ls-remote --exit-code --heads origin ${branchName}`
                });
                needsTimestamp = true;
            } catch {
                // リモートにも存在しない
            }
        }

        // 既存ブランチがある場合はタイムスタンプ付きの名前にする
        if (needsTimestamp) {
            const timestamp = Date.now();
            branchName = `${branchName}-${timestamp}`;
        }

        try {
            const result = await execCommand.execute({
                command: `git checkout -b ${branchName}`
            });
            return `ブランチを作成しました: ${branchName}\n${result}`;
        } catch (error) {
            throw new Error(`ブランチ作成失敗: ${error}`);
        }
    }
};

export const commitChanges = {
    name: 'commitChanges',
    description: 'メッセージ付きで変更をコミットする。変更がない場合はコミットしない。',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "コミットメッセージ"
            },
            files: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "コミットするファイルのパスのリスト"
            }
        },
        required: ["message", "files"]
    },
    execute: async (args: { message: string; files: string[] }) => {
        try {
            // 変更があるか確認
            const status = await execCommand.execute({
                command: 'git status --porcelain'
            });

            if (!status.trim()) {
                return 'コミットする変更がありません（既に最新の状態です）';
            }

            // ファイルをステージング
            for (const file of args.files) {
                // ダブルクォートで囲む（parseCommandがクォートを処理する）
                await execCommand.execute({
                    command: `git add "${file}"`
                });
            }

            // コミット実行
            const result = await execCommand.execute({
                command: `git commit -m "${args.message}"`
            });
            return `コミットしました: ${args.message}\n${result}`;
        } catch (error) {
            throw new Error(`コミット失敗: ${error}`);
        }
    }
};

export const pushBranch = {
    name: 'pushBranch',
    description: '現在のブランチをリモートリポジトリにプッシュする。新規ブランチの場合は上流を設定する。',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            branchName: {
                type: "string",
                description: "プッシュするブランチ名"
            }
        },
        required: ["branchName"]
    },
    execute: async (args: { branchName: string }) => {
        try {
            // -u オプションで上流ブランチを設定（新規ブランチ対応）
            const result = await execCommand.execute({
                command: `git push -u origin ${args.branchName}`
            });
            return `ブランチをプッシュしました: ${args.branchName}\n${result}`;
        } catch (error) {
            throw new Error(`プッシュ失敗: ${error}`);
        }
    }
};
