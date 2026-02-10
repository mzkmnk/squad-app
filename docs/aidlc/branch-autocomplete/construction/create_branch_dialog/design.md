# Design: create_branch_dialog

## 概要

新規ブランチ作成ダイアログコンポーネントを作成する。ユーザーが Workspace 作成フォームの「新規作成」ボタンをクリックした際に表示され、起点ブランチの選択（Unit 1 の `BranchComboboxComponent` を再利用）、新規ブランチ名の入力・バリデーション・重複チェックを行い、確定またはキャンセルの操作を提供する。

**対応するストーリー:** US3, US4, US5, AC8〜AC14

## ドメインモデル

本 Unit は純粋な UI コンポーネントであり、ドメインエンティティや値オブジェクトの新規追加は不要。

### バリデーションロジック

#### ブランチ名バリデーション（フロントエンド用）

Electron 側の `validateBranchName`（`electron/git/git-validation.ts`）は例外をスローする設計であり、Angular コンポーネントから直接参照できない（Electron メインプロセス専用）。そのため、同等のバリデーションロジックをフロントエンド用のピュア関数として新規作成する。

- **責務**: Git 命名規則に基づくブランチ名の検証。エラーメッセージを返す（例外ではなく戻り値）
- **配置**: `src/app/shared/create-branch-dialog/branch-validation.ts`
- **関数シグネチャ**:

```typescript
/**
 * ブランチ名を Git 命名規則に基づいて検証する。
 * @returns エラーメッセージ。有効な場合は null
 */
export function validateBranchName(branch: string): string | null;
```

- **バリデーションルール**（`electron/git/git-validation.ts` と同等）:
  - 空文字列 → `'ブランチ名を入力してください'`
  - 先頭が `.` → `'ブランチ名の先頭に "." は使用できません'`
  - 先頭が `-` → `'ブランチ名の先頭に "-" は使用できません'`
  - 末尾が `/` → `'ブランチ名の末尾に "/" は使用できません'`
  - 末尾が `.lock` → `'ブランチ名の末尾に ".lock" は使用できません'`
  - `..` を含む → `'ブランチ名に ".." は使用できません'`
  - `//` を含む → `'ブランチ名に連続する "/" は使用できません'`
  - 禁止文字（スペース、`~`, `^`, `:`, `?`, `*`, `[`, `\`, 制御文字）→ `'ブランチ名に使用できない文字が含まれています'`

> **設計判断**: Electron 側の `validateBranchName` と同じルールを Angular 側に複製する形になるが、以下の理由で許容する:
>
> - Electron メインプロセスのコードは Angular から直接 import できない（ビルドパイプラインが異なる）
> - フロントエンドバリデーションはリアルタイムフィードバック用であり、最終的なバリデーションは Workspace 作成時に Electron 側で実行される
> - ルールは Git の仕様に基づく安定したものであり、頻繁な変更は想定されない

#### 重複チェック

```typescript
/**
 * 既存ブランチ一覧との重複を検証する。
 * @returns エラーメッセージ。重複がない場合は null
 */
export function checkBranchDuplicate(branch: string, existingBranches: string[]): string | null;
```

- 既存ブランチ一覧に同名のブランチが存在する場合 → `'同名のブランチが既に存在します'`
- 比較は完全一致（大文字小文字を区別する）

### ダイアログの入出力モデル

#### CreateBranchDialogComponent

- **責務**: 新規ブランチ作成に必要な情報（起点ブランチ・新規ブランチ名）の入力と検証を提供する
- **Input**:
  - `branches: InputSignal<string[]>` — リポジトリのリモートブランチ一覧（required）
  - `defaultBranch: InputSignal<string>` — デフォルトブランチ名（起点ブランチの初期値、required）
- **Output**:
  - `created: OutputEmitterRef<CreateBranchResult>` — 作成確定時のイベント（起点ブランチと新規ブランチ名）

#### CreateBranchResult 型

```typescript
/** 新規ブランチ作成ダイアログの確定結果 */
export interface CreateBranchResult {
  /** 起点ブランチ名 */
  baseBranch: string;
  /** 新規ブランチ名 */
  newBranchName: string;
}
```

## DBスキーマ

本 Unit は純粋な UI コンポーネントであり、DB変更は不要。

## API仕様

本 Unit は純粋な UI コンポーネントであり、IPC/API の変更は不要。

## コンポーネント構成

```
src/app/shared/
├── branch-combobox/                    # Unit 1 で作成済み
│   ├── branch-combobox.ts
│   ├── branch-combobox.html
│   └── branch-combobox.spec.ts
└── create-branch-dialog/               # 本 Unit で新規作成
    ├── create-branch-dialog.ts         # ダイアログコンポーネント本体
    ├── create-branch-dialog.html       # テンプレート
    ├── create-branch-dialog-types.ts   # CreateBranchResult 型定義
    ├── branch-validation.ts            # ブランチ名バリデーション関数
    └── branch-validation.spec.ts       # バリデーション関数のテスト
```

### 配置方針

- `src/app/shared/create-branch-dialog/` ディレクトリに配置する（Unit 1 の `branch-combobox` と同階層）
  - 理由: 本コンポーネントは Unit 2（form_integration）から呼び出される共有コンポーネントである
  - `branch-validation.ts` もダイアログディレクトリ内に配置する。`shared/` 直下にファイルを置くとコンポーネントディレクトリと混在するため、凝集性を優先する
  - 既存プロジェクトではバリデーションはコンポーネント内の private メソッドとしてインラインで記述されている（`repo-add-form.ts`、`workspace-create-form.ts`）。本 Unit では `computed` シグナルから参照するためピュア関数として切り出すが、スコープはダイアログ内に留める

### コンポーネント設計

#### CreateBranchDialogComponent

```typescript
@Component({
  selector: 'app-create-branch-dialog',
  standalone: true,
  templateUrl: './create-branch-dialog.html',
  imports: [
    BranchComboboxComponent,
    BrnDialogClose,
    HlmButtonImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
  ],
})
export class CreateBranchDialogComponent {
  private readonly dialogRef = inject(BrnDialogRef);

  /** リモートブランチ一覧 */
  readonly branches = input.required<string[]>();

  /** デフォルトブランチ名（起点ブランチの初期値） */
  readonly defaultBranch = input.required<string>();

  /** 作成確定時のイベント */
  readonly created = output<CreateBranchResult>();

  /**
   * 起点ブランチ（defaultBranch input に連動して初期化）。
   * BranchComboboxComponent の valueChange が string | null を emit するため、
   * Output 型は string | null とする。初回は defaultBranch で初期化され、
   * ユーザーが変更した後は defaultBranch の変更に追従しない。
   */
  protected readonly baseBranch = linkedSignal<string, string | null>({
    source: this.defaultBranch,
    computation: (defaultBranch, previous) => previous?.value ?? defaultBranch,
  });

  /** 新規ブランチ名 */
  protected readonly newBranchName = signal('');

  /** 入力欄がタッチされたか（blur 後にエラー表示を開始） */
  protected readonly touched = signal(false);

  /**
   * 新規ブランチ名のバリデーションエラー。
   * 空文字の場合は null を返す（空文字エラーは displayError で touched 状態に応じて表示制御するため）。
   * canCreate でも参照されるため、空文字チェックはここではスキップし canCreate 側の name === '' で制御する。
   */
  protected readonly branchNameError = computed(() => {
    const name = this.newBranchName();
    if (name === '') return null;

    const validationError = validateBranchName(name);
    if (validationError) return validationError;

    const duplicateError = checkBranchDuplicate(name, this.branches());
    if (duplicateError) return duplicateError;

    return null;
  });

  /** 表示用エラーメッセージ（touched 後のみ表示） */
  protected readonly displayError = computed(() => {
    if (!this.touched()) return null;
    const name = this.newBranchName();
    if (name === '') return 'ブランチ名を入力してください';
    return this.branchNameError();
  });

  /** 作成ボタンの有効/無効 */
  protected readonly canCreate = computed(() => {
    const name = this.newBranchName();
    if (name === '') return false;
    if (this.baseBranch() === null) return false;
    if (this.branchNameError() !== null) return false;
    return true;
  });

  /** 作成ボタンクリック時 */
  protected onCreate(): void {
    if (!this.canCreate()) return;
    this.created.emit({
      baseBranch: this.baseBranch()!,
      newBranchName: this.newBranchName(),
    });
    this.dialogRef.close();
  }
}
```

**設計のポイント:**

- Input/Output ベースの設計を採用し、既存プロジェクトのテンプレートベースダイアログパターン（`hlm-dialog` + `hlmDialogTrigger` + `*hlmDialogPortal`）と一貫性を保つ
- `workspace-create-form.ts` の `created` output + `dialogRef.close()` パターンに倣い、確定時は `created` イベントを emit した後にダイアログを閉じる
- `baseBranch` の初期化は `linkedSignal` で行う。`defaultBranch` input に連動し、初回のみデフォルト値を設定する。ユーザーが起点ブランチを変更した後は `defaultBranch` の変更に追従しない
- ダイアログの閉じ操作: キャンセルボタンは `brnDialogClose` ディレクティブに委譲、作成確定時は `dialogRef.close()` で明示的に閉じる

### テンプレート構造

```html
<form class="flex flex-col gap-4" (submit)="onCreate(); $event.preventDefault()">
  <hlm-dialog-header>
    <h3 hlmDialogTitle>新規ブランチを作成</h3>
    <p hlmDialogDescription>起点ブランチを選択し、新しいブランチ名を入力してください。</p>
  </hlm-dialog-header>

  <!-- 起点ブランチ -->
  <div hlmField>
    <label hlmFieldLabel>起点ブランチ</label>
    <app-branch-combobox
      [branches]="branches()"
      [value]="baseBranch()"
      placeholder="起点ブランチを検索..."
      (valueChange)="baseBranch.set($event)"
    />
  </div>

  <!-- 新規ブランチ名 -->
  <div hlmField [attr.data-invalid]="displayError() ? true : null">
    <label hlmFieldLabel for="new-branch-name">新規ブランチ名</label>
    <input
      hlmInput
      id="new-branch-name"
      type="text"
      placeholder="feature/new-api"
      [value]="newBranchName()"
      (input)="newBranchName.set($any($event.target).value)"
      (blur)="touched.set(true)"
      [attr.aria-invalid]="displayError() ? true : null"
      [attr.aria-describedby]="displayError() ? 'new-branch-name-error' : null"
      autocomplete="off"
    />
    @if (displayError()) {
    <hlm-field-error id="new-branch-name-error"> {{ displayError() }} </hlm-field-error>
    }
  </div>

  <div hlmDialogFooter>
    <button hlmBtn variant="outline" type="button" brnDialogClose>キャンセル</button>
    <button hlmBtn type="submit" [disabled]="!canCreate()">作成</button>
  </div>
</form>
```

**テンプレート設計のポイント:**

- 起点ブランチは `BranchComboboxComponent`（Unit 1）を再利用し、オートコンプリートで選択可能にする（AC8, AC9, AC9-2）
- 起点ブランチの初期値は `defaultBranch` input から `linkedSignal` で設定（AC9）
- 新規ブランチ名のバリデーションエラーは `blur` 後（`touched` が `true`）に表示を開始し、入力中のリアルタイムフィードバックを提供する
- `aria-invalid` と `aria-describedby` でスクリーンリーダーにエラー状態を通知
- フォーカストラップは `spartan-ng/brain/dialog` が自動的に提供するため、手動実装は不要
- テンプレート構造は `workspace-create-form.html` のパターン（`hlm-dialog-header` → フォーム要素 → `hlm-dialog-footer`）に準拠

### ダイアログの呼び出し方

既存プロジェクトではダイアログをテンプレートベース（`hlm-dialog` + `hlmDialogTrigger` + `*hlmDialogPortal`）で使用している。本コンポーネントもこのパターンに合わせ、Input/Output ベースの設計とする。

Unit 2（form_integration）のテンプレートでの呼び出しイメージ（本 Unit のスコープ外）:

```html
<hlm-dialog>
  <button hlmBtn variant="outline" size="sm" hlmDialogTrigger>新規作成</button>
  <hlm-dialog-content *hlmDialogPortal>
    <app-create-branch-dialog
      [branches]="branchesMap().get(repo.id) ?? []"
      [defaultBranch]="getDefaultBranch(repo.id)"
      (created)="onBranchCreated(repo.id, $event)"
    />
  </hlm-dialog-content>
</hlm-dialog>
```

### spartan-ng/brain/dialog が提供する機能（自前実装不要）

以下の機能は `@spartan-ng/brain/dialog` が内部で処理するため、本コンポーネントでの実装は不要:

| 機能                         | 説明                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| フォーカストラップ           | ダイアログ内でのフォーカス循環（AC: フォーカストラップ）             |
| Escape キーでの閉じ          | Escape キー押下でダイアログを閉じる                                  |
| オーバーレイクリックでの閉じ | 背景クリックでダイアログを閉じる                                     |
| 開閉アニメーション           | fade-in/fade-out + zoom-in/zoom-out                                  |
| ARIA 属性管理                | `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby` |

## テスト計画

### ユニットテスト

テストファイル: `src/app/shared/create-branch-dialog/branch-validation.spec.ts`

テスト環境: Vitest + happy-dom（`@angular/build:unit-test` ビルダー経由）

本 Unit のテストはバリデーション関数のユニットテストに集中する。コンポーネントテストは作成しない（ダイアログの表示・操作は spartan-ng/brain/dialog に委譲しており、バリデーションロジックがピュア関数として切り出されているため、関数テストで十分にカバーできる）。

#### validateBranchName のテスト

- [ ] 有効なブランチ名（`main`, `feature/new-api`, `hotfix/v1.2.3`）で `null` を返す（AC10）
- [ ] 空文字列でエラーメッセージを返す
- [ ] 先頭が `.` でエラーメッセージを返す
- [ ] 先頭が `-` でエラーメッセージを返す
- [ ] 末尾が `/` でエラーメッセージを返す
- [ ] 末尾が `.lock` でエラーメッセージを返す
- [ ] `..` を含む場合にエラーメッセージを返す（AC11: `feature/..invalid`）
- [ ] `//` を含む場合にエラーメッセージを返す
- [ ] 禁止文字（`~`, `^`, `:`, `?`, `*`, `[`, `\`）を含む場合にエラーメッセージを返す
- [ ] スペースを含む場合にエラーメッセージを返す
- [ ] 制御文字を含む場合にエラーメッセージを返す

#### checkBranchDuplicate のテスト

- [ ] 既存ブランチに同名が存在する場合にエラーメッセージを返す（AC12）
- [ ] 既存ブランチに同名が存在しない場合に `null` を返す
- [ ] 空の既存ブランチ一覧で `null` を返す

### AC カバレッジ方針

| AC    | カバレッジ方法                                                  |
| ----- | --------------------------------------------------------------- |
| AC8   | テンプレート構造で保証（コンポーネント構成で確認可能）          |
| AC9   | `linkedSignal` による初期化（コード設計で保証）                 |
| AC9-2 | `BranchComboboxComponent` に委譲（Unit 1 のテストでカバー済み） |
| AC10  | `validateBranchName` ユニットテスト                             |
| AC11  | `validateBranchName` ユニットテスト                             |
| AC12  | `checkBranchDuplicate` ユニットテスト                           |
| AC13  | Unit 2（form_integration）の統合テストでカバー                  |
| AC14  | `brnDialogClose` ディレクティブに委譲（spartan-ng が保証）      |

## 非機能要件

### パフォーマンス

- バリデーションは `computed` シグナルにより同期的に実行される。入力ごとにリアルタイムでフィードバックを提供する
- 起点ブランチのオートコンプリートは `BranchComboboxComponent` に委譲しており、パフォーマンス特性は Unit 1 と同等

### アクセシビリティ

- ダイアログのフォーカストラップは `spartan-ng/brain/dialog` が提供（AC: フォーカストラップ）
- `aria-invalid` と `aria-describedby` でバリデーションエラーをスクリーンリーダーに通知
- 起点ブランチの選択は `BranchComboboxComponent`（WAI-ARIA combobox パターン準拠）を使用
- キーボードのみで全操作が完結（Tab でフォーカス移動、Enter で確定、Escape でキャンセル）

### セキュリティ

- 入力値は Angular のテンプレートバインディングにより自動エスケープされるため、XSS リスクなし
- フロントエンドバリデーションはリアルタイムフィードバック用。最終的なブランチ名の検証は Workspace 作成時に Electron 側の `validateBranchName` で実行される（二重バリデーション）

## 更新履歴

| 日付       | 内容                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2025-07-25 | 初版作成                                                                                                                            |
| 2026-02-10 | code-reviewer 指摘対応: linkedSignal の型パラメータ修正、baseBranch の null 許容を明確化、branchNameError のコメント補強            |
| 2026-02-10 | ユーザー指摘対応: branch-validation.ts をダイアログディレクトリ内に移動、コンポーネントテスト削除（バリデーション関数テストに集中） |
