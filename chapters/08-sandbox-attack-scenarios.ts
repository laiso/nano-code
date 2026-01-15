/**
 * 第8章: サンドボックス攻撃シナリオ
 *
 * これらのテストは、サンドボックスが悪意ある操作を正しくブロックすることを検証します。
 * Dockerコンテナ内で以下のように実行してください:
 *
 * docker run -it --rm \
 *   --cap-add=SYS_ADMIN \
 *   --security-opt seccomp=unconfined \
 *   -v "$(pwd):/workspace" \
 *   -w /workspace \
 *   nano-code \
 *   bash
 *
 * 実行: bun run chapters/08-sandbox-attack-scenarios.ts
 */

import { Sandbox } from '../src/core/sandbox';

async function runScenarios() {
  const sandbox = new Sandbox();

  console.log('='.repeat(60));
  console.log('サンドボックス攻撃シナリオテスト');
  console.log('='.repeat(60));
  console.log();

  // シナリオ1: ファイルシステム攻撃
  console.log('--- シナリオ1: ファイルシステム攻撃 ---');
  console.log('/etc への書き込みを試行中（失敗するはず）...');

  const fsResult = await sandbox.run('touch', ['/etc/malicious-file']);

  console.log(`Exit code: ${fsResult.exitCode}`);
  console.log(`stderr: ${fsResult.stderr.trim()}`);
  console.log(`Result: ${fsResult.exitCode !== 0 ? '✓ BLOCKED' : '✗ VULNERABILITY!'}`);
  console.log();

  // シナリオ2: ネットワーク攻撃
  console.log('--- シナリオ2: ネットワーク攻撃 ---');
  console.log('外部サーバーへの接続を試行中（失敗するはず）...');

  const netResult = await sandbox.run('curl', ['-s', '--connect-timeout', '3', 'https://example.com'], {
    allowNetwork: false,
  });

  console.log(`Exit code: ${netResult.exitCode}`);
  console.log(`stderr: ${netResult.stderr.trim()}`);
  console.log(`Result: ${netResult.exitCode !== 0 ? '✓ BLOCKED' : '✗ VULNERABILITY!'}`);
  console.log();

  // シナリオ3: 破壊的コマンド
  console.log('--- シナリオ3: 破壊的コマンド ---');
  console.log('/bin の削除を試行中（失敗するはず）...');

  const rmResult = await sandbox.run('rm', ['-rf', '/bin']);

  console.log(`Exit code: ${rmResult.exitCode}`);
  console.log(`stderr: ${rmResult.stderr.trim()}`);
  console.log(`Result: ${rmResult.exitCode !== 0 ? '✓ BLOCKED' : '✗ VULNERABILITY!'}`);
  console.log();

  // シナリオ4: 許可された操作（成功するはず）
  console.log('--- シナリオ4: 許可された操作 ---');
  console.log('サンドボックス内で許可されたコマンドを実行中...');

  const allowedResult = await sandbox.run('echo', ['Hello from sandbox!']);

  console.log(`Exit code: ${allowedResult.exitCode}`);
  console.log(`stdout: ${allowedResult.stdout.trim()}`);
  console.log(`Result: ${allowedResult.exitCode === 0 ? '✓ ALLOWED' : '✗ UNEXPECTED BLOCK'}`);
  console.log();

  // シナリオ5: /tmp への書き込み（成功するはず）
  console.log('--- シナリオ5: /tmp への書き込み ---');
  console.log('/tmp への書き込みを試行中（成功するはず）...');

  const tmpResult = await sandbox.run('/bin/sh', ['-c', 'echo "test" > /tmp/sandbox-test.txt && cat /tmp/sandbox-test.txt']);

  console.log(`Exit code: ${tmpResult.exitCode}`);
  console.log(`stdout: ${tmpResult.stdout.trim()}`);
  console.log(`Result: ${tmpResult.exitCode === 0 ? '✓ ALLOWED' : '✗ UNEXPECTED BLOCK'}`);
  console.log();

  // サマリー
  console.log('='.repeat(60));
  console.log('サマリー');
  console.log('='.repeat(60));

  const results = [
    { name: 'Filesystem write to /etc', blocked: fsResult.exitCode !== 0, shouldBlock: true },
    { name: 'Network access', blocked: netResult.exitCode !== 0, shouldBlock: true },
    { name: 'Destructive command (rm /bin)', blocked: rmResult.exitCode !== 0, shouldBlock: true },
    { name: 'Allowed operation (echo)', blocked: allowedResult.exitCode !== 0, shouldBlock: false },
    { name: 'Write to /tmp', blocked: tmpResult.exitCode !== 0, shouldBlock: false },
  ];

  let allPassed = true;
  for (const r of results) {
    const passed = r.blocked === r.shouldBlock;
    if (!passed) allPassed = false;
    const status = passed ? '✓' : '✗';
    console.log(`${status} ${r.name}: ${r.blocked ? 'Blocked' : 'Allowed'} (expected: ${r.shouldBlock ? 'Block' : 'Allow'})`);
  }

  console.log();
  console.log(allPassed ? '✓ すべてのテストが成功しました!' : '✗ 一部のテストが失敗しました!');
}

runScenarios().catch(console.error);
