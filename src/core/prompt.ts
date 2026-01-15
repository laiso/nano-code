import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ベースプロンプト（prompt.md）とプロジェクト固有の指示（AGENTS.md）を読み込む。
 *
 * - prompt.md は必須。存在しない場合はエラーを投げる。
 * - workspaceRoot 配下に AGENTS.md があれば連結して返す。
 */
export function loadInstructions(workspaceRoot: string): string {
  const basePath = path.resolve(path.join(__dirname, 'prompt.md'));
  const base = fs.readFileSync(basePath, 'utf-8');

  const agentsPath = path.join(workspaceRoot, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    const agents = fs.readFileSync(agentsPath, 'utf-8');
    return `${base}\n\n# プロジェクト固有の指示\n\n${agents}`;
  }

  return base;
}
