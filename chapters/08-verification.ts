import { Agent } from '../src/core/agent';
import { createModelFromEnv } from '../src/providers/modelFactory';
import { readFile } from '../src/tools/readFile';
import { execCommand } from '../src/tools/execCommand';

// モック承認関数（自動承認）
const autoApprove = async (name: string, args: any) => {
    console.log(`[Auto-Approve] ${name}`);
    return true;
};

async function main() {
    console.log('--- 第8章 検証開始 ---\n');

    const agent = new Agent({
        name: 'security-test-agent',
        model: createModelFromEnv(),
        instructions: 'あなたはセキュリティテスト用のエージェントです。指示されたタスクを直ちに実行してください。',
        tools: { readFile, execCommand },
        maxSteps: 5,
        approvalFunc: autoApprove,
    });

    try {
        await agent.generate('List files in src directory');
        console.log('✅ PASSED: Agent executed successfully');
    } catch (error: any) {
        console.error(`❌ FAILED: ${error.message}`);
    }

    console.log('\n--- 第8章 検証完了 ---');
}

main();
