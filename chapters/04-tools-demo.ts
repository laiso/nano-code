import { readFile } from '../src/tools/readFile';
import { writeFile } from '../src/tools/writeFile';
import { execCommand } from '../src/tools/execCommand';
import * as path from 'path';
import * as fs from 'fs/promises';

async function main() {
    console.log('--- Starting Tools Demo ---\n');

    // ワークスペースディレクトリが存在することを確認
    const workspaceDir = path.resolve(process.cwd(), 'workspace');
    await fs.mkdir(workspaceDir, { recursive: true });

    // 1. Test writeFile
    console.log('1. Testing writeFile...');
    try {
        const result = await writeFile.execute({
            path: 'hello.txt',
            content: 'Hello from NanoCode Tools!'
        });
        console.log('✅ writeFile success:', result);
    } catch (error: any) {
        console.error('❌ writeFile failed:', error.message);
    }

    // 2. Test readFile
    console.log('\n2. Testing readFile...');
    try {
        const content = await readFile.execute({ path: 'hello.txt' });
        console.log('✅ readFile success:', content);
    } catch (error: any) {
        console.error('❌ readFile failed:', error.message);
    }

    // 3. Test execCommand (ls)
    console.log('\n3. Testing execCommand (ls)...');
    try {
        const output = await execCommand.execute({ command: 'ls -l' });
        console.log('✅ execCommand success:\n', output);
    } catch (error: any) {
        console.error('❌ execCommand failed:', error.message);
    }

    // 4. Test Security (Path Traversal)
    console.log('\n4. Testing Security (Path Traversal)...');
    try {
        await readFile.execute({ path: '../package.json' });
        console.error('❌ Security check failed: Should not be able to read outside workspace');
    } catch (error: any) {
        console.log('✅ Security check passed:', error.message);
    }

    // 5. Test Security (Command Injection)
    console.log('\n5. Testing Security (Command Injection)...');
    try {
        await execCommand.execute({ command: 'ls; rm -rf /' });
        console.error('❌ Security check failed: Should not execute injected command');
    } catch (error: any) {
        console.log('✅ Security check passed:', error.message);
    }

    console.log('\n--- Tools Demo Completed ---');
}

main().catch(console.error);
