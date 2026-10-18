# Flick

開いた瞬間にメモできる、フリックでステータスを動かすタスク管理ウェブアプリ。

- モバイルファースト / PWA（ホーム画面に追加で全画面表示）
- JS 読み込み前からメモ欄が使える起動シェル
- 右フリックで進める（未着手 → 進行中 → 完了）、左フリックで戻す。端は削除。すべて「元に戻す」可
- Liquid Glass UI（白ベース）、スプリングアニメーション、スケルトン、全画面ローダー
- Workers AI：メモを「分解」してサブタスク化 / 音声入力のメモを「整える」
- Google ログインのみ。未ログインでも端末内で使え、ログインすると端末間で同期

## 構成

```
index.html          起動シェル（クリティカル CSS + 素の textarea）
src/                React アプリ
  store.ts          ローカルファースト ストア（localStorage + 差分同期）
  components/       TaskCard（フリック）, Composer, Dock, Sheet, Loading …
worker/             Cloudflare Worker（Hono）
  auth.ts           Google OAuth 2.0（PKCE）+ D1 セッション
  ai.ts             Workers AI（JSON Schema 出力）+ レート制限
  index.ts          /api/sync, /api/me
migrations/         D1 スキーマ
e2e/                Playwright（Android Chrome / iPhone Safari）
```

## 開発

```bash
npm install
cp .dev.vars.example .dev.vars   # DEV_LOGIN=1 はローカル専用のテストログイン
npx wrangler d1 migrations apply DB --local
npm run dev:local                # Workers AI を使わずローカルだけで動かす（AI_MOCK=1 推奨）
npm run dev                      # Workers AI をリモート接続で使う（wrangler login が必要）
npm run test:e2e
```

## デプロイ

```bash
npx wrangler d1 create flick                 # 出力された database_id を wrangler.jsonc に
npx wrangler d1 migrations apply DB --remote
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npm run deploy
```

Google Cloud Console の OAuth クライアント（ウェブアプリ）に、承認済みリダイレクト URI として
`https://<your-domain>/api/auth/callback` を登録してください。

## License

MIT
