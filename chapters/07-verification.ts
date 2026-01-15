import { Agent } from '../src/core/agent';
import { createModelFromEnv } from '../src/providers/modelFactory';

// モックツール
const mockCreateBranchTool = {
    name: 'createBranch',
    description: '新しい Git ブランチを作成する。既存のブランチがある場合はタイムスタンプを付与して作成する。',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            branchName: { type: "string", description: "作成するブランチ名" }
        },
        required: ["branchName"]
    },
    execute: async (args: any) => {
        console.log(`[Mock] createBranch called with: ${JSON.stringify(args)}`);
        return `ブランチを作成しました: ${args.branchName}`;
    }
};

const mockCommitTool = {
    name: 'commitChanges',
    description: 'メッセージ付きで変更をコミットする。変更がない場合はコミットしない。',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            message: { type: "string", description: "コミットメッセージ" },
            files: { type: "array", items: { type: "string" }, description: "ファイルリスト" }
        },
        required: ["message", "files"]
    },
    execute: async (args: any) => {
        console.log(`[Mock] commitChanges called with: ${JSON.stringify(args)}`);
        return `コミットしました: ${args.message}`;
    }
};

const mockPushBranchTool = {
    name: 'pushBranch',
    description: '現在のブランチをリモートリポジトリにプッシュする',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            branchName: { type: "string", description: "プッシュするブランチ名" }
        },
        required: ["branchName"]
    },
    execute: async (args: any) => {
        console.log(`[Mock] pushBranch called with: ${JSON.stringify(args)}`);
        return `ブランチをプッシュしました: ${args.branchName}`;
    }
};

const mockCreatePullRequestTool = {
    name: 'createPullRequest',
    description: 'プルリクエストを作成する。',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            title: { type: "string" },
            body: { type: "string" },
            head: { type: "string" },
            base: { type: "string" }
        },
        required: ["title", "body", "head", "base"]
    },
    execute: async (args: any) => {
        console.log(`[Mock] createPullRequest called with: ${JSON.stringify(args)}`);
        return `PR #123 を作成しました`;
    }
};

const mockReadFileTool = {
    name: "readFile",
    description: "ファイル読み込み",
    needsApproval: false,
    parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"]
    },
    execute: async (args: any) => {
        console.log(`[Mock] readFile called with: ${JSON.stringify(args)}`);
        return "function hello() { console.log('hello'); }";
    }
};

async function main() {
    console.log('--- Starting Chapter 7 Verification (Mock) ---\n');

    const userPrompt = "Issue #1: src/hello.ts の関数を修正して、'Hello World' と出力するようにしてください。その後PRを作成してください。";
    console.log(`Task: ${userPrompt}\n`);

    const agent = new Agent({
        name: 'nano-code-action-mock',
        model: createModelFromEnv(),
        instructions: `
あなたは GitHub Actions で実行される TypeScript コーディングエージェントです。

TODO:
1. [ ] Issue を理解する
2. [ ] 対象ファイルを読み込む
3. [ ] コードを修正する（今回はモックなので実際には修正しないが、コミットは行う）
4. [ ] Git にコミットしてプッシュする
5. [ ] プルリクエストを作成する

各TODOを完了したら「✓」をつけて、次のTODOに進んでください。
TODOリストを作成したら、すぐに最初のタスクを実行してください。
        `,
        tools: {
            readFileTool: mockReadFileTool,
            createBranchTool: mockCreateBranchTool,
            commitTool: mockCommitTool,
            pushBranchTool: mockPushBranchTool,
            createPullRequestTool: mockCreatePullRequestTool,
        },
        maxSteps: 10,
        approvalFunc: async (name: string, _args: unknown) => {
            console.log(`[Auto-Approve] ${name}`);
            return true;
        }
    });

    try {
        await agent.generate(userPrompt);
        console.log('\nVerification Completed Successfully');
    } catch (error) {
        console.error('\nVerification Failed:', error);
        process.exit(1);
    }
}

main();
