# Design: branch_combobox

## 概要

Workspace 作成フォームおよび新規ブランチ作成ダイアログで再利用可能な、ブランチ選択用オートコンプリートコンポーネントを新規作成する。

`@spartan-ng/brain/autocomplete` + `@spartan-ng/helm/autocomplete` を基盤とし、テキスト入力による部分一致フィルタリング（大文字小文字を区別しない）を提供する。キーボード操作・WAI-ARIA combobox パターン・ポップオーバー制御は spartan-ng の brain 層に委譲する。

**対応するストーリー:** US1, US2, AC1〜AC6

## ドメインモデル

本 Unit は純粋な UI コンポーネントであり、ドメインエンティティや値オブジェクトの新規追加は不要。

### コンポーネントの入出力モデル

#### BranchComboboxComponent

- **責務**: ブランチ名の一覧から、テキスト入力による部分一致フィルタリングと候補選択を提供する
- **Input**:
  - `branches: InputSignal<string[]>` — フィルタリング対象のブランチ名一覧（required）
  - `value: InputSignal<string | null>` — 現在の選択値（デフォルト: `null`。spartan-ng の `value` input に渡す）
  - `placeholder: InputSignal<string>` — 入力欄のプレースホルダーテキスト（デフォルト: `'ブランチを検索...'`）
  - `disabled: InputSignal<boolean>` — 無効状態（デフォルト: `false`）
- **Output**:
  - `valueChange: OutputEmitterRef<string | null>` — 候補選択時のイベント（spartan-ng の `valueChange` を中継）
  - `searchChange: OutputEmitterRef<string>` — 検索テキスト変更時のイベント（spartan-ng の `searchChange` を中継）
- **内部状態**:
  - `search: WritableSignal<string>` — 現在の検索テキスト（spartan-ng の `[(search)]` と双方向バインディング）
  - `filteredBranches: Signal<string[]>` — `search` による部分一致フィルタリング結果（computed）

### フィルタリングロジック

```typescript
protected readonly filteredBranches = computed(() => {
  const q = this.search().toLowerCase();
  if (q === '') return this.branches();
  return this.branches().filter(b => b.toLowerCase().includes(q));
});
```

- 空入力時: 全候補を表示（AC3）
- 部分一致: 大文字小文字を区別しない `includes` マッチ（AC1, AC2）

> **前提**: `branches` 入力に含まれるブランチ名は一意であること（Git リモートブランチ名の特性による）

## DBスキーマ

本 Unit は純粋な UI コンポーネントであり、DB変更は不要。

## API仕様

本 Unit は純粋な UI コンポーネントであり、IPC/API の変更は不要。

## セットアップ

### パッケージインストール

spartan-ng の autocomplete は内部で Popover コンポーネントを使用するため、先に popover をインストールする（現在プロジェクトに未インストール）:

```bash
ng g @spartan-ng/cli:ui popover
ng g @spartan-ng/cli:ui autocomplete
```

これにより `libs/ui/popover/` と `libs/ui/autocomplete/` に helm ラッパーが生成される。

### tsconfig.json のパスエイリアス追加

生成後、`tsconfig.json` の `paths` に以下を追加:

```json
"@spartan-ng/helm/popover": ["./libs/ui/popover/src/index.ts"],
"@spartan-ng/helm/autocomplete": ["./libs/ui/autocomplete/src/index.ts"]
```

## コンポーネント構成

```
libs/ui/autocomplete/         # spartan-ng CLI で生成（helm ラッパー）
src/app/shared/
└── branch-combobox/
    ├── branch-combobox.ts          # コンポーネント本体
    ├── branch-combobox.html        # テンプレート
    └── branch-combobox.spec.ts     # ユニットテスト
```

### 配置方針

- `src/app/shared/` ディレクトリに配置する
  - 理由: 本コンポーネントは Workspace 作成フォーム（Unit 2）と新規ブランチ作成ダイアログ（Unit 3）の両方から参照される共有コンポーネントである
  - `libs/ui/` は spartan-ng/helm ラッパー専用であり、アプリケーション固有のコンポーネントは配置しない
  - 本 Unit で `src/app/shared/` ディレクトリを新設するため、`structure.md` への反映が必要

> **注**: `structure.md` では helm ラッパーの配置先が `src/lib/` と記載されているが、実際のプロジェクトでは `libs/ui/` に配置されている。この不整合の修正も併せて検討する。

### spartan-ng/autocomplete を採用した理由

- プロジェクトの UI 基盤である spartan-ng/brain + helm のアーキテクチャに準拠
- WAI-ARIA combobox パターン（`role="combobox"` + `role="listbox"` + `aria-activedescendant`）が brain 層で実装済み
- キーボードナビゲーション（ArrowUp/Down、Enter、Escape）が brain 層で実装済み
- ポップオーバー制御（表示/非表示、位置調整）が brain 層で実装済み
- 一意な ID 生成（ARIA 属性用）が brain 層で実装済み
- 自前実装と比較して、コード量が大幅に削減され保守性が向上する

### コンポーネント設計

#### BranchComboboxComponent

```typescript
@Component({
  selector: 'app-branch-combobox',
  standalone: true,
  templateUrl: './branch-combobox.html',
  imports: [HlmAutocompleteImports],
})
export class BranchComboboxComponent {
  /** フィルタリング対象のブランチ名一覧 */
  readonly branches = input.required<string[]>();

  /** 現在の選択値 */
  readonly value = input<string | null>(null);

  /** プレースホルダーテキスト */
  readonly placeholder = input<string>('ブランチを検索...');

  /** 無効状態 */
  readonly disabled = input<boolean>(false);

  /** 候補選択時のイベント */
  readonly valueChange = output<string | null>();

  /** 検索テキスト変更時のイベント */
  readonly searchChange = output<string>();

  /** 検索テキスト（spartan-ng の [(search)] と双方向バインディング） */
  protected readonly search = signal('');

  /** フィルタリング結果 */
  protected readonly filteredBranches = computed(() => {
    const q = this.search().toLowerCase();
    if (q === '') return this.branches();
    return this.branches().filter(b => b.toLowerCase().includes(q));
  });
}
```

### テンプレート構造

```html
<hlm-autocomplete
  [value]="value()"
  [(search)]="search"
  [disabled]="disabled()"
  [autoHighlight]="true"
  (searchChange)="searchChange.emit($event)"
  (valueChange)="valueChange.emit($event)"
>
  <hlm-autocomplete-input [placeholder]="placeholder()" />

  <hlm-autocomplete-content *hlmAutocompletePortal>
    <hlm-autocomplete-empty>一致するブランチがありません</hlm-autocomplete-empty>

    <div hlmAutocompleteList>
      @for (branch of filteredBranches(); track branch) {
        <hlm-autocomplete-item [value]="branch">
          {{ branch }}
        </hlm-autocomplete-item>
      }
    </div>
  </hlm-autocomplete-content>
</hlm-autocomplete>
```

**テンプレート設計のポイント:**

- `autoHighlight` を `true` に設定し、検索結果の最初の候補を自動ハイライトする（キーボード操作の利便性向上）
- フィルタリングは `filteredBranches` computed シグナルで実行し、spartan-ng の `[(search)]` 双方向バインディングで `search` シグナルを自動同期する
- `hlm-autocomplete-empty` で候補なし時のメッセージを宣言的に定義
- `*hlmAutocompletePortal` でポップオーバーの DOM 配置を spartan-ng に委譲
- ARIA 属性（`role="combobox"`, `aria-expanded`, `aria-activedescendant`, `aria-controls` 等）は brain 層が自動管理するため、テンプレートでの手動設定は不要

### spartan-ng brain 層が提供する機能（自前実装不要）

以下の機能は `@spartan-ng/brain/autocomplete` が内部で処理するため、本コンポーネントでの実装は不要:

| 機能 | 説明 |
| --- | --- |
| キーボードナビゲーション | ArrowUp/Down で候補移動、Enter で選択、Escape で閉じ |
| ARIA 属性管理 | `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `aria-controls`, `role="listbox"`, `role="option"`, `aria-selected` |
| 一意な ID 生成 | 複数インスタンスの ARIA ID 衝突を brain 層が防止 |
| ポップオーバー制御 | フォーカス時の表示、ブラー時の非表示、位置調整 |
| スクロール追従 | アクティブ候補へのスクロール追従 |
| blur/mousedown 競合回避 | 候補クリック時の blur イベント競合を brain 層が処理 |

## テスト計画

### ユニットテスト

テストファイル: `src/app/shared/branch-combobox/branch-combobox.spec.ts`

テスト環境: Vitest + happy-dom（`@angular/build:unit-test` ビルダー経由）

#### フィルタリングのテスト

- [ ] 空入力時に全ブランチが候補として表示される（AC3）
- [ ] 部分一致する文字列を入力すると、一致するブランチのみ表示される（AC1）
- [ ] 大文字小文字を区別せずフィルタリングされる（AC2）
- [ ] 一致するブランチがない場合、「一致するブランチがありません」メッセージが表示される

#### 候補選択のテスト

- [ ] 候補をクリックすると `valueChange` イベントが発火し、候補リストが閉じる（AC4）
- [ ] 選択後に入力欄にブランチ名が表示される

#### キーボード操作のテスト（spartan-ng brain 層の統合確認）

- [ ] ArrowDown/ArrowUp で候補のハイライトが移動する（AC5）
- [ ] Enter でハイライト中の候補が選択される（AC5）
- [ ] Escape で候補リストが閉じる（AC6）

> **注**: キーボード操作テストは happy-dom 環境での spartan-ng brain 層の動作に依存する。テスト実装時に happy-dom の制限により動作しない場合は、フィルタリングロジックのユニットテストに集中し、キーボード操作は手動テストまたは E2E テストで検証する方針とする。

#### 表示制御のテスト

- [ ] フォーカス時に候補リストが表示される
- [ ] `disabled` が `true` の場合、入力が無効になる

#### エッジケースのテスト

- [ ] ブランチ一覧が空の場合、候補リストに「一致するブランチがありません」が表示される
- [ ] ブランチ名に `/` を含む場合（例: `feature/login`）正常にフィルタリングされる
- [ ] 入力値を全削除した場合、全候補が再表示される

### テスト方針の変更点（自前実装からの差分）

spartan-ng/autocomplete を採用したことで、以下のテストは不要となった:

- ARIA 属性の個別テスト（brain 層が保証）
- 循環ナビゲーションのテスト（brain 層が保証）
- スクロール追従のテスト（brain 層が保証）
- 複数インスタンスの ARIA ID 衝突テスト（brain 層が保証）
- blur/mousedown 競合のテスト（brain 層が保証）

本コンポーネントのテストは、フィルタリングロジックと spartan-ng との統合動作に集中する。

### 統合テスト

統合テストは Unit 2（form_integration）で実施する。本 Unit では単体テストに集中する。

## 非機能要件

### パフォーマンス

- フィルタリングはクライアントサイドで `computed` により同期的に実行する。ブランチ一覧は IPC 経由で事前取得済みのため、追加の非同期処理は不要
- 1000 件超のブランチでもスムーズに動作すること（`Array.prototype.filter` + `String.prototype.includes` で十分な性能）
- 5000 件を超える場合は `@angular/cdk/scrolling` の仮想スクロールを検討する

### アクセシビリティ

- spartan-ng/brain の autocomplete が WAI-ARIA combobox パターンに準拠（`role="combobox"` + `role="listbox"`）
- キーボードのみで全操作が完結（ArrowUp/Down、Enter、Escape）— brain 層が提供
- `aria-activedescendant` によるスクリーンリーダー対応 — brain 層が提供
- `autoHighlight` により、検索開始時に最初の候補が自動ハイライトされる

### セキュリティ

- 入力値は Angular のテンプレートバインディングにより自動エスケープされるため、XSS リスクなし
- ブランチ名のサニタイズは本コンポーネントの責務外（呼び出し元または Electron 側で実施）

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2025-07-25 | 初版作成 |
| 2026-02-10 | code-reviewer 指摘対応: OnPush 削除、effect→linkedSignal、ARIA/テスト計画補強 |
| 2026-02-10 | spartan-ng/autocomplete ベースに全面書き換え。セットアップ手順・テスト計画補強 |
