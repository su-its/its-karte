# ITS Karte

静岡大学 ITソルーション室（ITS）PC相談室の電子カルテ管理システム。

## 技術スタック

- **Next.js 16** (App Router) + **React 19** + React Compiler
- **@shizuoka-its/core v3** - ドメインロジック（所属構造、カルテユースケース）
- **Vite+** (`vp`) - 開発ツールチェーン（dev / build / test / lint / fmt）
- **Playwright** - E2Eテスト
- **Vitest** (vite-plus/test) - ユニットテスト
- **Steiger** - Feature-Sliced Design リンター

## アーキテクチャ

[Feature-Sliced Design (FSD) v2.1](https://fsd.how) に準拠。

```
src/
  app/        # ルートエントリ、グローバルレイアウト
  page/       # ページ固有ロジック（list, new, import）
  widgets/    # 複数ページで共用するUIブロック（karte-form, karte-table）
  shared/     # UI キット、ユーティリティ、共有 API・型
```

各スライス内は `ui/` と `model/` に分離:

- `model/` - React 非依存の純粋関数・型定義
- `ui/` - React コンポーネント

## 開発

```bash
# 依存インストール
vp install

# 開発サーバー起動
vp dev

# lint + format + 型チェック
vp check

# FSD 構造チェック
npx steiger src
```

## テスト

### ユニットテスト

```bash
vp test
```

テストファイルはテスト対象と同じディレクトリにコロケーション:

```
src/widgets/karte-form/model/affiliation.test.ts
src/widgets/karte-table/model/karte-table-columns.test.ts
src/page/import/model/helpers.test.ts
src/page/import/model/import-state.test.ts
```

### E2Eテスト

Docker で PostgreSQL テストDBを起動してから実行:

```bash
# テストDB起動
docker compose -f docker-compose.test.yml up -d

# シード投入
vp run test:e2e:seed

# テスト実行
vp run test:e2e

# UIモードで実行
vp run test:e2e:ui
```

## ディレクトリ構成

```
e2e/                    # Playwright E2Eテスト + シード
src/
  app/
    page.tsx            # / → KarteListPage
    new/page.tsx        # /new → KarteNewPage
    import/page.tsx     # /import → KarteImportPage
    layout.tsx          # グローバルレイアウト
  page/
    list/               # カルテ一覧ページ
    new/                # カルテ新規作成ページ
      api/              # create-karte サーバーアクション
    import/             # CSVインポートページ
      model/            # import-state (reducer), helpers, parse-csv
      ui/               # ウィザードUI (validation-step, duplicate-step 等)
      api/              # import サーバーアクション
  widgets/
    karte-form/         # カルテ入力フォーム
      model/            # karte-form-values, affiliation
      ui/               # KarteForm, FormField, AffiliationFields
    karte-table/        # カルテ一覧テーブル
      model/            # karte-table-columns, filterKartes
      ui/               # KarteTable
  shared/
    api/                # サーバーアクション、共有型
    ui/                 # shadcn コンポーネント群
    lib/                # ユーティリティ (cn, format-consulted-at)
```
