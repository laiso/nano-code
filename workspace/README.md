# Nano Code

![書影](workspace/docs/images/cover.jpg)

書籍「作って学ぶ AIエージェント ── TypeScriptとLLMで切り拓くAI時代のエンジニアリング」（laiso 著、技術評論社刊）のサンプルコードリポジトリです。

書籍ページ: https://gihyo.jp/book/2026/978-4-297-15565-0

## 必要要件

- Bun (v1.0以上)
- Node.js (v18以上)
- LLM APIキー（OpenAI, Anthropic, Google のいずれか）

## セットアップ

1. 依存関係をインストールします。

   ```bash
   bun install
   ```

2. 環境変数ファイルを作成して編集します。

   ```bash
   cp .env.example .env
   ```

3. `.env` に以下の値を設定します。

   - `LLM_PROVIDER`: 利用する LLM プロバイダー名を指定します（例: `openai`, `anthropic`, `google`）
   - `LLM_MODEL`: 利用するモデル名を指定します
   - `LLM_API_KEY`: 利用する LLM の API キーを指定します

## 使い方

```bash
bun run agent "タスク内容"
```

## GitHub Actionsでの利用

GitHub CLI を使って、Variables と Secrets を設定します。

- Variables の設定: `gh variable set LLM_PROVIDER / LLM_MODEL`
- Secrets の設定: `gh secret set LLM_API_KEY`
- ワークフローの実行: `gh workflow run nano-code.yml`

## 補足情報サイト

書籍の補足情報は https://laiso.github.io/nano-code/ で公開しています。

## 書籍情報

- ISBN: 978-4-297-15565-0
