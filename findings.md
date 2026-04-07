# Findings

## karte-form.tsx 分析 (1,076行)

### 責務分類

**React非依存のロジック（model/ に抽出可能）:**

- `KarteFormValues` 型定義 (L26-51)
- `KarteFormProps` 型定義 (L55-73)
- `CLIENT_TYPES` 定数 (L75-77)
- `COURSE_TYPES` 定数 (L79-82)
- `PRECISION_OPTIONS` 定数 (L84-89)
- `toLocalDatetimeString()` 関数 (L91-94)
- `DEFAULTS` 定数 (L151-176)
- `AFFILIATION_FIELDS` 定数 (L820-829)
- `toFormKey()` 関数 (L904-906) — school→faculty変換
- `canEdit()` 判定ロジック (L207-211)
- `fieldValue()` / `originalFieldValue()` — 値取得ヘルパー (L277-287)
- affiliation selections構築ロジック (L856-864)
- autoSkip ロジック (L921-930) — 副作用(set呼び出し)を除けば純粋関数化可能

**UIコンポーネント（ui/ に分離可能）:**

- `ConsultedAtInput` (L97-149) — 53行
- `SearchableMultiSelect` (L694-817) — 124行
- `AffiliationFields` (L837-1006) — 170行
- `AffiliationStepRow` (L1008-1015) — 8行
- `AssigneeReadOnly` (L1017-1061) — 45行
- `MemberHoverContent` (L1063-1076) — 14行
- `Section` (L676-684) — 9行
- `OriginalValueHint` (L289-298) — 10行
- `NotRecordedPill` (L301-325) — 25行
- `FieldHeader` (L328-339) — 12行

**状態管理 + 副作用（KarteForm本体内）:**

- useState × 4 (values, submitting, error, elapsedMinutes)
- useEffect: 編集可能フィールドへのスクロール (L213-221) — 副作用
- useEffect: 経過時間計算 (L223-232) — 副作用 + タイマー
- useEffect: onFormChange通知 (L238-244) — 副作用
- set() / toggleInSet() — 状態更新 (L246-257)
- handleSubmit() — フォーム送信 (L259-271)

### 分割計画

1. **model/karte-form-values.ts** (~90行)
   - KarteFormValues, KarteFormProps 型
   - CLIENT_TYPES, COURSE_TYPES, PRECISION_OPTIONS, DEFAULTS 定数
   - toLocalDatetimeString()
   - canEdit(), fieldValue(), originalFieldValue() 純粋関数

2. **model/affiliation.ts** (~50行)
   - AFFILIATION_FIELDS 定数
   - toFormKey() — school→faculty変換
   - buildSelections() — フォーム値からselections構築
   - computeAutoSkip() — 純粋関数版auto-skip（新しいselectionsを返す）

3. **ui/consulted-at-input.tsx** (~55行)
   - ConsultedAtInput コンポーネント

4. **ui/searchable-multi-select.tsx** (~130行)
   - MultiSelectItem 型
   - SearchableMultiSelect コンポーネント

5. **ui/affiliation-fields.tsx** (~180行)
   - AffiliationFields コンポーネント
   - AffiliationStepRow コンポーネント

6. **ui/karte-form.tsx** (~350行)
   - KarteForm メイン + 残りのサブコンポーネント
   - Section, FieldHeader, NotRecordedPill, OriginalValueHint
   - AssigneeReadOnly, MemberHoverContent
   - 状態管理、副作用

### autoSkip の純粋関数化

現在のautoSkipは `set()` を呼ぶ副作用がある:

```ts
function autoSkip(ct, sels) {
  let s = { ...sels };
  for (;;) {
    const steps = getAffiliationSteps(ct, s);
    const next = steps.find((step) => !s[step.field]);
    if (!next || next.options.length !== 1) break;
    set(toFormKey(next.field), next.options[0]); // 副作用!
    s[next.field] = next.options[0];
  }
}
```

純粋関数化:

```ts
// model/affiliation.ts
function computeAutoSkip(ct, sels): Record<string, string> {
  let s = { ...sels };
  for (;;) {
    const steps = getAffiliationSteps(ct, s);
    const next = steps.find((step) => !s[step.field]);
    if (!next || next.options.length !== 1) break;
    s[next.field] = next.options[0];
  }
  return s; // 副作用なし、新しいselectionsを返すだけ
}
```

UI側でselectionsの差分をsetに反映する。
