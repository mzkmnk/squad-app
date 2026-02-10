# Design: form_integration

## 概要

Workspace 作成フォーム（`WorkspaceCreateFormComponent`）の既存ブランチ選択ドロップダウン（`brn-select`）を Unit 1 で作成した `BranchComboboxComponent` に置き換え、各リポジトリのブランチ入力欄の横に「新規作成」ボタンを追加する。

新規ブランチ情報（起点ブランチ・新規ブランチ名）をフォーム状態として保持し、送信時にその情報を含めて Workspace 作成を実行できるようにする。

**対応するストーリー:** US1, US2, AC7, AC15

### Unit 境界の明確化

| 責務                                            | 担当 Unit                               |
| ----------------------------------------------- | --------------------------------------- |
| ブランチ選択コンボボックスの UI・フィルタリング | Unit 1 (branch_combobox) ✅ 実装済み    |
| **フォームへの統合・新規作成ボタン・状態管理**  | **Unit 2 (form_integration) ← 本 Unit** |
| 新規ブランチ作成ダイアログの中身                | Unit 3 (create_branch_dialog)           |
| バックエンド IPC 型拡張・worktree 作成処理      | Unit 4 (new_branch_worktree)            |

## ドメインモデル

本 Unit は純粋なフロントエンド UI 変更であり、ドメインエンティティや値オブジェクトの新規追加は不要。

### フォーム状態モデル

#### NewBranchInfo（型定義）

- **用途**: 新規ブランチ作成ダイアログからの戻り値を保持するインターフェース
- **属性**:
  - `sourceBranch: string` — 起点ブランチ名（例: `develop`）
  - `newBranchName: string` — 新規ブランチ名（例: `feature/new-api`）
- **配置**: `src/app/workspaces/workspace-create-form.ts` 内にローカル定義

```typescript
/** 新規ブランチ作成ダイアログからの戻り値 */
export interface NewBranchInfo {
  /** 起点ブランチ名（例: develop） */
  readonly sourceBranch: string;
  /** 新規ブランチ名（例: feature/new-api） */
  readonly newBranchName: string;
}
```

> **設計判断**: `NewBranchInfo` はフォームコンポーネントファイル内に定義し `export` する。テストファイルから型を参照する必要があるため。Unit 3（ダイアログ）と Unit 4（バックエンド）で共有型が必要になった場合は、その時点で `electron/types/models.ts` への移動を検討する。現時点では YAGNI 原則に従い、最小スコープに留める。

#### BranchSelection（型定義）

- **用途**: 各リポジトリのブランチ選択状態を統一的に管理する Discriminated Union 型
- **属性**:
  - `type: 'existing'` — 既存ブランチ選択時
    - `branch: string` — 選択されたブランチ名
  - `type: 'new'` — 新規ブランチ作成時
    - `newBranchInfo: NewBranchInfo` — 新規ブランチ情報

```typescript
/** リポジトリごとのブランチ選択状態 */
export type BranchSelection =
  | { readonly type: 'existing'; readonly branch: string }
  | { readonly type: 'new'; readonly newBranchInfo: Readonly<NewBranchInfo> };
```

> **設計判断**: 既存の `selectedBranches: Map<string, string>` を `branchSelections: Map<string, BranchSelection>` に変更する。Discriminated Union により、既存ブランチと新規ブランチの状態を型安全に区別できる。

### 状態管理の変更

#### 変更前（現在の実装）

```typescript
protected readonly selectedBranches = signal<Map<string, string>>(new Map());
// repoId → branchName の単純なマッピング
```

#### 変更後

```typescript
protected readonly branchSelections = signal<Map<string, BranchSelection>>(new Map());
// repoId → BranchSelection の Discriminated Union マッピング
```

## DBスキーマ

本 Unit は純粋なフロントエンド UI 変更であり、DB変更は不要。

## API仕様

本 Unit は純粋なフロントエンド UI 変更であり、IPC/API の変更は不要。

> **注**: `createWorkspace` の IPC インターフェース拡張（新規ブランチ情報の送信）は Unit 4 (new_branch_worktree) のスコープ。本 Unit では、`onSubmit` 時に `BranchSelection` から既存の `{ repositoryId: string; branch: string }[]` 形式に変換して送信する。新規ブランチの場合は `newBranchName` を `branch` として設定する（Unit 4 で IPC 型が拡張されるまでの暫定対応）。

## コンポーネント構成

```
src/app/workspaces/
├── workspace-create-form.ts          # 変更: 状態管理・テンプレート統合
└── workspace-create-form.html        # 変更: brn-select → app-branch-combobox + 新規作成ボタン
src/app/shared/branch-combobox/
├── branch-combobox.ts                # 既存（Unit 1 で作成済み）
└── branch-combobox.html              # 既存（Unit 1 で作成済み）
```

### 変更対象ファイル一覧

| ファイル                     | 変更種別 | 内容                                                              |
| ---------------------------- | -------- | ----------------------------------------------------------------- |
| `workspace-create-form.ts`   | 修正     | import 追加、状態管理変更、メソッド追加・修正                     |
| `workspace-create-form.html` | 修正     | `brn-select` → `app-branch-combobox` 差し替え、新規作成ボタン追加 |

## 詳細設計

### 1. TypeScript（workspace-create-form.ts）の変更

#### 1.1 import の変更

```typescript
// 削除
import { BrnSelectImports } from '@spartan-ng/brain/select';
import { HlmSelectImports } from '@spartan-ng/helm/select';

// 追加
import { BranchComboboxComponent } from '../shared/branch-combobox/branch-combobox';
import { lucideGitBranchPlus } from '@ng-icons/lucide';
```

#### 1.2 imports 配列の変更

```typescript
imports: [
  BrnDialogClose,
  // BrnSelectImports を削除
  BranchComboboxComponent,  // 追加
  HlmButtonImports,
  HlmCardImports,
  HlmCheckboxImports,
  HlmDialogImports,
  HlmFieldImports,
  HlmIconImports,
  HlmInputImports,
  // HlmSelectImports を削除
  HlmSeparatorImports,
  HlmSpinnerImports,
],
providers: [provideIcons({ lucideLoader, lucideGitBranchPlus })],  // アイコン追加
```

#### 1.3 状態管理の変更

```typescript
// 削除
protected readonly selectedBranches = signal<Map<string, string>>(new Map());

// 追加
protected readonly branchSelections = signal<Map<string, BranchSelection>>(new Map());
```

#### 1.4 メソッドの変更・追加

##### selectBranch（変更）

> **破壊的変更**: 既存の `selectBranch(repoId: string, branch: string)` から `selectBranch(repoId: string, branch: string | null)` に変更。`BranchComboboxComponent.valueChange` が `string | null` を emit するため。

```typescript
/** 既存ブランチを選択する（コンボボックスからの選択） */
protected selectBranch(repoId: string, branch: string | null): void {
  this.branchSelections.update((map) => {
    const next = new Map(map);
    if (branch === null) {
      next.delete(repoId);
    } else {
      next.set(repoId, { type: 'existing', branch });
    }
    return next;
  });
  this.selectionError.set(null);
}
```

##### setNewBranch（新規）

```typescript
/** 新規ブランチ情報を設定する（ダイアログからの戻り値） */
protected setNewBranch(repoId: string, info: NewBranchInfo): void {
  this.branchSelections.update((map) => {
    const next = new Map(map);
    next.set(repoId, { type: 'new', newBranchInfo: info });
    return next;
  });
  this.selectionError.set(null);
}
```

##### openCreateBranchDialog（新規 — Unit 3 統合用スタブ）

```typescript
/**
 * 新規ブランチ作成ダイアログを開く。
 *
 * Unit 3 (create_branch_dialog) で実装されるダイアログを呼び出す。
 * 現時点ではスタブとして定義し、Unit 3 統合時に実装を差し替える。
 */
protected openCreateBranchDialog(repoId: string): void {
  console.warn(`[TODO] Unit 3 で実装予定: CreateBranchDialog for repo ${repoId}`);
  // TODO: Unit 3 で CreateBranchDialogComponent を実装後、
  //       HlmDialogService を使ってダイアログを開き、
  //       戻り値を setNewBranch() に渡す。
  //
  // 想定される実装:
  // const dialogRef = this.dialogService.open(CreateBranchDialogComponent, {
  //   context: {
  //     branches: this.branchesMap().get(repoId) ?? [],
  //     defaultBranch: this.getDefaultBranch(repoId),
  //   },
  // });
  // dialogRef.closed$.subscribe((result: NewBranchInfo | undefined) => {
  //   if (result) {
  //     this.setNewBranch(repoId, result);
  //   }
  // });
}
```

##### toggleRepo（変更）

```typescript
protected toggleRepo(repoId: string): void {
  this.selectedRepoIds.update((ids) => {
    const next = new Set(ids);
    if (next.has(repoId)) {
      next.delete(repoId);
      // selectedBranches → branchSelections に変更
      this.branchSelections.update((map) => {
        const nextMap = new Map(map);
        nextMap.delete(repoId);
        return nextMap;
      });
    } else {
      next.add(repoId);
    }
    return next;
  });
  this.selectionError.set(null);
}
```

##### canSubmit（変更）

```typescript
protected readonly canSubmit = computed(() => {
  if (this.creating()) return false;
  if (this.workspaceName().trim().length === 0) return false;
  if (this.selectedRepoIds().size === 0) return false;
  for (const id of this.selectedRepoIds()) {
    const selection = this.branchSelections().get(id);
    if (!selection) return false;
    if (selection.type === 'new' && selection.newBranchInfo.newBranchName.trim().length === 0) {
      return false;
    }
  }
  return true;
});
```

##### validate（変更）

```typescript
protected validate(): boolean {
  let valid = true;
  const name = this.workspaceName().trim();
  if (name.length === 0) {
    this.nameError.set('Workspace名を入力してください');
    valid = false;
  } else if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    this.nameError.set('英数字、ハイフン、アンダースコアのみ使用できます');
    valid = false;
  } else {
    this.nameError.set(null);
  }

  if (this.selectedRepoIds().size === 0) {
    this.selectionError.set('1つ以上のリポジトリを選択してください');
    valid = false;
  } else {
    for (const id of this.selectedRepoIds()) {
      if (!this.branchSelections().has(id)) {
        this.selectionError.set('全てのリポジトリでブランチを選択してください');
        valid = false;
        break;
      }
    }
    if (valid) this.selectionError.set(null);
  }
  return valid;
}
```

##### buildEntries（新規 — entries 構築ロジックの分離）

```typescript
/**
 * branchSelections から createWorkspace 用の entries を構築する。
 *
 * 現時点では既存の IPC インターフェース（{ repositoryId, branch }）に合わせて変換する。
 * Unit 4 で IPC 型が拡張された後、新規ブランチの場合は sourceBranch 情報も
 * entries に含めるように変更する。
 */
private buildEntries(): { repositoryId: string; branch: string }[] {
  return [...this.selectedRepoIds()].map((repoId) => {
    const selection = this.branchSelections().get(repoId);
    if (!selection) {
      throw new Error(`Branch selection not found for repository: ${repoId}`);
    }
    const branch =
      selection.type === 'existing'
        ? selection.branch
        : selection.newBranchInfo.newBranchName;
    return { repositoryId: repoId, branch };
  });
}
```

> **Unit 4 統合時の変更点**: `buildEntries()` の戻り値型を `{ repositoryId: string; branch: string; sourceBranch?: string }[]` に拡張し、`type === 'new'` の場合に `sourceBranch` を含める。`WorkspaceService.createWorkspace` の引数型も同様に拡張する。変更箇所がこのメソッドに集約されるため、影響範囲が限定される。

##### onSubmit（変更）

```typescript
protected async onSubmit(): Promise<void> {
  if (!this.validate()) return;
  this.creating.set(true);

  const entries = this.buildEntries();
  const result = await this.workspaceService.createWorkspace(
    this.workspaceName().trim(),
    entries,
  );

  if (result.success) {
    toast.success(`Workspace「${result.data.name}」を作成しました`);
    this.created.emit(result.data);
    this.dialogRef.close();
  } else {
    toast.error(result.error.message);
  }
  this.creating.set(false);
}
```

##### getSelectedBranchName（新規 — テンプレートヘルパー）

```typescript
/** テンプレート用: リポジトリの現在の選択ブランチ名を取得する */
protected getSelectedBranchName(repoId: string): string | null {
  const selection = this.branchSelections().get(repoId);
  if (!selection) return null;
  return selection.type === 'existing'
    ? selection.branch
    : selection.newBranchInfo.newBranchName;
}
```

### 2. テンプレート（workspace-create-form.html）の変更

#### 2.1 ブランチ選択部分の差し替え

**変更前**（`brn-select` ブロック）:

```html
@if (branchesMap().has(repo.id)) {
<brn-select
  [value]="selectedBranches().get(repo.id) ?? ''"
  (valueChange)="selectBranch(repo.id, $any($event))"
  [disabled]="creating()"
>
  <hlm-select-trigger class="w-full">
    <hlm-select-value placeholder="ブランチを選択..." />
  </hlm-select-trigger>
  <hlm-select-content>
    @for (branch of branchesMap().get(repo.id); track branch) {
    <hlm-option [value]="branch">{{ branch }}</hlm-option>
    }
  </hlm-select-content>
</brn-select>
}
```

**変更後**（`app-branch-combobox` + 新規作成ボタン）:

```html
@if (branchesMap().has(repo.id)) {
<div class="flex items-start gap-2">
  <div class="min-w-0 flex-1">
    <app-branch-combobox
      [branches]="branchesMap().get(repo.id) ?? []"
      [value]="getSelectedBranchName(repo.id)"
      [disabled]="creating()"
      (valueChange)="selectBranch(repo.id, $event)"
    />
  </div>
</div>
```

> **設計判断**: `placeholder` は明示的に指定せず、`BranchComboboxComponent` のデフォルト値 `'ブランチを検索...'` を使用する。ドロップダウン（`brn-select`）からオートコンプリートへの変更に伴い、プレースホルダーテキストも「選択」から「検索」に変更することで、テキスト入力によるフィルタリングが可能であることをユーザーに示す。

```html
  <button
    hlmBtn
    variant="outline"
    size="sm"
    type="button"
    [disabled]="creating()"
    (click)="openCreateBranchDialog(repo.id)"
    aria-label="新規ブランチを作成"
  >
    <ng-icon hlm name="lucideGitBranchPlus" size="sm" />
  </button>
</div>
}
```

### 3. UI レイアウト設計

#### ブランチ選択エリアのレイアウト

```
┌─────────────────────────────────────────────────────┐
│ ☑ backend                                           │
│   https://github.com/org/backend.git                │
│                                                     │
│   ┌─────────────────────────────────┐ ┌────┐        │
│   │ ブランチを検索...               │ │ 🌿 │        │
│   └─────────────────────────────────┘ └────┘        │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ☑ frontend                                          │
│   https://github.com/org/frontend.git               │
│                                                     │
│   ┌─────────────────────────────────┐ ┌────┐        │
│   │ feature/new-api                 │ │ 🌿 │        │
│   └─────────────────────────────────┘ └────┘        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- コンボボックスは `flex-1 min-w-0` で残りスペースを占有
- 新規作成ボタンは `variant="outline" size="sm"` でアイコンのみ（テキストなし）を控えめに配置

### 4. 新規作成ボタンの仕様

| 項目             | 仕様                                                              |
| ---------------- | ----------------------------------------------------------------- |
| 表示条件         | リポジトリが選択済み かつ ブランチ一覧の取得が完了している（AC7） |
| アイコン         | `lucideGitBranchPlus`（ブランチ作成を直感的に示す）               |
| 無効条件         | `creating()` が `true`（Workspace 作成中）                        |
| クリック動作     | `openCreateBranchDialog(repoId)` を呼び出す                       |
| アクセシビリティ | `aria-label="新規ブランチを作成"`                                 |

### 5. Unit 3 との統合インターフェース

Unit 3 (create_branch_dialog) が実装するダイアログとの接続点を定義する。

#### ダイアログへの入力

```typescript
interface CreateBranchDialogContext {
  /** フィルタリング対象のブランチ名一覧 */
  branches: string[];
  /** 起点ブランチのデフォルト値（例: 'main'） */
  defaultBranch: string | null;
}
```

#### ダイアログからの出力

```typescript
// ダイアログの戻り値は NewBranchInfo | undefined
// - NewBranchInfo: 作成ボタンが押された場合
// - undefined: キャンセルまたはダイアログ外クリックで閉じた場合
```

> **注**: これらのインターフェースは Unit 3 の設計時に確定する。本 Unit では `openCreateBranchDialog` をスタブとして定義し、Unit 3 統合時に実装を差し替える。

## 非機能要件

### パフォーマンス

- `brn-select` → `app-branch-combobox` の差し替えにより、ブランチ数が多い場合のユーザー体験が向上する（テキスト入力によるフィルタリングが可能になるため）
- `BranchSelection` の Discriminated Union は追加のメモリオーバーヘッドが無視できるレベル

### アクセシビリティ

- 新規作成ボタンに `aria-label="新規ブランチを作成"` を設定
- コンボボックスのアクセシビリティは Unit 1 (branch_combobox) + spartan-ng brain 層が保証

### セキュリティ

- 入力値は Angular のテンプレートバインディングにより自動エスケープされるため、XSS リスクなし
- ブランチ名のサニタイズは Electron 側（`git-validation.ts`）で実施済み

## 更新履歴

| 日付       | 内容                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-07-25 | 初版作成                                                                                                                                                                            |
| 2026-02-10 | code-reviewer 指摘対応: Non-null Assertion 除去、selectBranch シグネチャ変更明示、getNewBranchSourceBranch 配置統一、型の export・readonly 追加、canSubmit 防御的バリデーション追加 |
| 2026-02-10 | ユーザーフィードバック: 「新規作成（起点: ...）」テンプレート表示・関連ヘルパー削除、テスト計画セクション削除                                                                       |
