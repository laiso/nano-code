import * as fs from 'fs/promises';
import * as path from 'path';
import { isSensitiveFile, isDangerousCommand } from '../src/core/security';

// シナリオを実行し、成功/失敗を報告するシンプルなランナー
async function runScenario(
    title: string,
    fn: () => Promise<void>
): Promise<void> {
    process.stdout.write(`- ${title} ... `);
    try {
        await fn();
        console.log('OK');
    } catch (error: any) {
        console.log(`BLOCKED (${error.message})`);
    }
}

async function main() {
    const workspaceRoot = path.resolve(process.cwd(), 'workspace');

    await fs.mkdir(workspaceRoot, { recursive: true });

    console.log('=== シナリオ1: ファイルシステムへの攻撃デモ ===\n');

    await runScenario('機密ファイル検出: .env ファイル', async () => {
        const target = '.env';
        if (isSensitiveFile(target)) {
            throw new Error('機密ファイルとして検出されました');
        }
    });

    await runScenario('機密ファイル検出: credentials.json', async () => {
        const target = 'credentials.json';
        if (isSensitiveFile(target)) {
            throw new Error('機密ファイルとして検出されました');
        }
    });

    console.log('\n=== シナリオ2: 危険なコマンドの検出 ===\n');

    await runScenario('sudoコマンドの検出', async () => {
        const result = isDangerousCommand('sudo rm -rf /');
        if (result.dangerous) {
            throw new Error(result.reason || '危険なコマンド');
        }
    });

    await runScenario('コマンド置換の検出', async () => {
        const result = isDangerousCommand('echo $(cat /etc/passwd)');
        if (result.dangerous) {
            throw new Error(result.reason || '危険なコマンド');
        }
    });

    await runScenario('安全なコマンドの許可', async () => {
        const result = isDangerousCommand('ls -la');
        if (result.dangerous) {
            throw new Error(result.reason || '危険なコマンド');
        }
        console.log('(安全なコマンドとして認識)');
    });

    console.log('\n完了: すべての攻撃シナリオを実行しました。');
}

main().catch((error) => {
    console.error('デモ実行中にエラーが発生しました:', error);
    process.exit(1);
});
