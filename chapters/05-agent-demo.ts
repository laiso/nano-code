import { createOpenAI } from '../src/providers/openai';
import { Agent } from '../src/core/agent';
import { readFile, writeFile, editFile } from '../src/tools/index';

async function main() {
    const openai = createOpenAI();
    const model = openai('gpt-5-mini');

    console.log('--- エージェントデモ開始 ---\n');
    console.log('タスク: workspace/greeting.txtを作成し、"Hello, World!"を書き込んでから内容を読み出す。');

    await new Agent({
        name: 'nano-code',
        model,
        instructions: `
あなたはnano-code-cliのデモ用エージェントです。必ずツールを用いてタスクを完了してください。
完了前に途中報告で終了してはいけません。タスク完了後は以下の形式で報告します：

## 結果報告
- 作成したファイル: パスと内容の要約
- 実行した手順: 利用したツール名と目的
- エラー: 発生していれば概要、なければ「なし」

ツールを呼び出すときはワークスペース内のパスを使います。`,
        tools: {
            readFile,
            writeFile,
            editFile
        },
        maxSteps: 8,
        verbose: true
    }).generate(
        'workspace/greeting.txt を作成し、中身を "Hello, World!" にしてから内容を読み出して報告してください。ファイルの保存にはwriteFileツールを使ってください。'
    );

    console.log('\n--- エージェントデモ終了 ---');
}

main().catch(console.error);
