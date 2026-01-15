import * as readline from 'readline';

export async function requestApproval(
    toolName: string,
    args: any
): Promise<boolean> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('\n--- 承認が必要です ---');
        console.log(`ツール: ${toolName}`);
        console.log(`引数: ${JSON.stringify(args, null, 2)}`);

        rl.question('このツールを実行しますか？ (y/n): ', (answer) => {
            rl.close();

            if (answer.toLowerCase() === 'y') {
                console.log('承認されました。実行します...\n');
                resolve(true);
            } else {
                console.log('キャンセルされました。\n');
                resolve(false);
            }
        });
    });
}
