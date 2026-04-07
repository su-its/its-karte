# FSD リファクタリング Phase 2: ファイル内部の関心分離

## 目標

LoCが大きいファイルをリファクタリングし、UI/ロジック/状態/副作用を分離する。

## 原則

1. UIの関心とロジックの関心を分離
2. React依存を `ui/` に閉じ込める（`model/` はReact非依存）
3. 状態遷移を純粋関数として抽出
4. 副作用の最小化・隔離

## 完了条件

- 各ファイル800行以下
- `model/` にReact importなし
- Steiger 0エラー
- E2Eテスト21件全通過

## Phases

### Phase 1: karte-form.tsx 分割 (1,076行)

- [ ] 調査: 現在の責務と依存関係を分析
- [ ] model/karte-form-values.ts — 型定義、定数、デフォルト値
- [ ] model/affiliation.ts — ステップ解決、auto-skip、school→faculty変換
- [ ] model/form-actions.ts — 状態遷移ロジック（純粋関数）
- [ ] ui/consulted-at-input.tsx — 日時精度入力
- [ ] ui/searchable-multi-select.tsx — 検索付き複数選択
- [ ] ui/affiliation-fields.tsx — 所属ステップUI
- [ ] ui/karte-form.tsx — メインフォーム組み立て
- [ ] E2Eテスト通過確認
- [ ] コミット

### Phase 2: karte.server.ts 分離 (394行)

- [ ] 調査: 各関数の利用箇所を確認
- [ ] ページ固有ActionをpageのAPI segmentに移動
- [ ] shared/api に共通部分のみ残す
- [ ] E2Eテスト通過確認
- [ ] コミット

### Phase 3: karte-table.tsx 分割 (602行)

- [ ] 調査: 列定義、フィルタ、レンダリングの責務分析
- [ ] model/ — 型定義、列定義、フィルタロジック
- [ ] ui/ — テーブル描画、フィルタUI
- [ ] E2Eテスト通過確認
- [ ] コミット

### Phase 4: import/page.tsx + helpers.ts 分割 (955+628行)

- [ ] 調査: ウィザードステップと責務の分析
- [ ] model/helpers.ts 分割 — 責務ごとにファイル分離
- [ ] ui/ — ステップごとにコンポーネント分割
- [ ] E2Eテスト通過確認
- [ ] コミット

## 決定ログ

- (未記入)
