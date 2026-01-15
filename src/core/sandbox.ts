// src/core/sandbox.ts
import { spawn } from 'child_process';

export interface SandboxOptions {
  cwd?: string;                 // 作業ディレクトリ
  allowNetwork?: boolean;       // ネットワークアクセスの許可
  env?: Record<string, string>; // 環境変数
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class Sandbox {
  async run(
    command: string,
    args: string[],
    options: SandboxOptions = {}
  ): Promise<SandboxResult> {
    const cwd = options.cwd || process.cwd();

    // bwrapの引数を構築
    const bwrapArgs: string[] = [
      // 1. ファイルシステムの隔離
      // ルートを読み取り専用でバインド（システム破壊の防止）
      '--ro-bind', '/', '/',

      // デバイスファイルと一時ディレクトリを新規作成
      '--dev', '/dev',
      '--tmpfs', '/tmp',

      // 作業ディレクトリのみ書き込み許可でバインド
      '--bind', cwd, cwd,
      '--chdir', cwd,

      // 親プロセス(Node)が終了したらサンドボックスも終了（ゾンビ防止）
      '--die-with-parent',

      // 環境変数をクリア
      '--clearenv',
    ];

    // 環境変数の再設定（PATHなどを引き継ぐ）
    const envVars = {
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      HOME: '/tmp',
      ...options.env,
    };
    for (const [key, value] of Object.entries(envVars)) {
      if (value !== undefined) {
        bwrapArgs.push('--setenv', key, value);
      }
    }

    // 2. ネットワーク制御
    if (!options.allowNetwork) {
      bwrapArgs.push('--unshare-net'); // ネットワーク名前空間を分離（通信遮断）
    }

    // 実行するコマンド
    bwrapArgs.push('--', command, ...args);

    // プロセス生成と結果取得
    return new Promise((resolve) => {
      const child = spawn('bwrap', bwrapArgs, {
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', d => stdout += d.toString());
      child.stderr.on('data', d => stderr += d.toString());

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1
        });
      });

      // bwrap自体の起動失敗をハンドリング
      child.on('error', (err) => {
        resolve({
          stdout: '',
          stderr: `Sandbox Error: ${err.message}\n` +
            '(Hint: docker run の --cap-add=SYS_ADMIN オプションを確認してください)',
          exitCode: 126
        });
      });
    });
  }
}
