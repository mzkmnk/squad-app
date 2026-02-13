# Functional Design: Unit 2 — Angular UI

## 概要

Workspace 編集ページの UI と、既存一覧画面への編集導線を提供する。
バッチ確定方式を採用し、ユーザーは画面上でエントリの追加・削除を自由に操作した後、「保存」ボタンで一括確定する。

## 設計方針

### バッチ確定方式

- 画面上で追加予定・削除予定の変更を溜め、「保存」ボタンで一括確定する
- 確定時に `removeEntry`（削除分）→ `addEntry`（追加分）の順で IPC を呼び出す
- 削除を先に実行する理由: 同一リポジトリの入れ替え（削除 → 追加）を可能にするため
- 追加分は `WorkspaceCreateEntry[]` 配列として1回の IPC で送信
- 削除分は `repositoryIds: string[]` 配列として1回の IPC で送信

### 状態管理モデル

```
初期状態（IPC から取得した Workspace）
  ↓
画面上の編集状態（pendingAdditions / pendingRemovals で差分管理）
  ↓
保存ボタン押下 → IPC 呼び出し → 成功時に画面状態を更新
```

## WorkspaceService 拡張

### 追加メソッド

```typescript
// src/app/services/workspace.service.ts に追加

/**
 * 指定 ID の Workspace を取得する。
 * 編集ページで Workspace の最新状態を取得するために使用する。
 */
getWorkspace(id: string): Promise<IpcResult<Workspace>> {
  return window.electronAPI.getWorkspace(id);
}

/**
 * 既存の Workspace にエントリを一括追加する。
 * @param id - 対象 Workspace の UUID
 * @param entries - 追加するエントリの配列
 */
addEntry(id: string, entries: WorkspaceCreateEntry[]): Promise<IpcResult<Workspace>> {
  return window.electronAPI.addWorkspaceEntry(id, entries);
}

/**
 * 既存の Workspace からエントリを一括削除する。
 * @param id - 対象 Workspace の UUID
 * @param repositoryIds - 削除対象のリポジトリ UUID の配列
 */
removeEntry(id: string, repositoryIds: string[]): Promise<IpcResult<Workspace>> {
  return window.electronAPI.removeWorkspaceEntry(id, repositoryIds);
}
```

## WorkspaceEditComponent 設計

### コンポーネントメタデータ

```typescript
@Component({
  selector: 'app-workspace-edit',
  standalone: true,
  templateUrl: './workspace-edit.html',
  imports: [
    TranslocoDirective,
    BranchComboboxComponent,
    CreateBranchDialogComponent,
    HlmAlertDialogImports,
    HlmButtonImports,
    HlmCardImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmIconImports,
    HlmSeparatorImports,
    HlmSpinnerImports,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideGitBranch,
      lucideGitBranchPlus,
      lucidePlus,
      lucideTrash2,
      lucideLoader,
      lucideUndo2,
    }),
  ],
})
```

### シグナル設計

```typescript
// --- 入力 ---
private readonly route = inject(ActivatedRoute);
private readonly router = inject(Router);
private readonly workspaceService = inject(WorkspaceService);
private readonly repoService = inject(RepositoryService);
private readonly transloco = inject(TranslocoService);

// --- データ ---
/** 現在の Workspace（IPC から取得した最新状態） */
protected readonly workspace = signal<Workspace | null>(null);

/** 全登録リポジトリ一覧 */
protected readonly repositories = signal<Repository[]>([]);

/** リポジトリ ID → Repository のマップ */
protected readonly repoMap = computed(() => {
  const map = new Map<string, Repository>();
  for (const repo of this.repositories()) {
    map.set(repo.id, repo);
  }
  return map;
});

// --- 編集状態 ---
/** 削除予定のリポジトリ ID セット */
protected readonly pendingRemovals = signal<Set<string>>(new Set());

/** 追加予定のエントリ配列 */
protected readonly pendingAdditions = signal<PendingEntry[]>([]);

// --- 追加フォーム状態 ---
/** 追加フォームで選択中のリポジトリ ID */
protected readonly selectedRepoId = signal<string | null>(null);

/** リポジトリ ID → ブランチ一覧のマップ */
protected readonly branchesMap = signal<Map<string, string[]>>(new Map());

/** ブランチ取得中のリポジトリ ID セット */
protected readonly fetchingIds = signal<Set<string>>(new Set());

/** 追加フォームのブランチ選択状態 */
protected readonly branchSelection = signal<BranchSelection | null>(null);

// --- UI 状態 ---
protected readonly loading = signal(true);
protected readonly saving = signal(false);
protected readonly notFound = signal(false);

// --- 算出プロパティ ---
/** 保存後に残るエントリのプレビュー（既存 - 削除予定 + 追加予定） */
protected readonly effectiveEntries = computed(() => {
  const ws = this.workspace();
  if (!ws) return [];
  const removals = this.pendingRemovals();
  const existing = ws.entries.filter((e) => !removals.has(e.repositoryId));
  const additions = this.pendingAdditions().map((p) => ({
    repositoryId: p.repositoryId,
    branch: p.type === 'existing' ? p.branch : p.newBranchInfo.newBranchName,
  }));
  return [...existing, ...additions];
});

/** 変更があるか（保存ボタンの有効/無効判定） */
protected readonly hasChanges = computed(() => {
  return this.pendingRemovals().size > 0 || this.pendingAdditions().length > 0;
});

/** 保存後にエントリが0件になるか（Workspace 削除提案の判定） */
protected readonly willBeEmpty = computed(() => {
  return this.effectiveEntries().length === 0;
});

/** 追加フォームで選択可能なリポジトリ（既存 + 追加予定を除外、削除予定は含める） */
protected readonly availableRepos = computed(() => {
  const ws = this.workspace();
  if (!ws) return [];
  const removals = this.pendingRemovals();
  const existingIds = new Set(
    ws.entries
      .filter((e) => !removals.has(e.repositoryId))
      .map((e) => e.repositoryId),
  );
  const pendingIds = new Set(this.pendingAdditions().map((p) => p.repositoryId));
  return this.repositories().filter(
    (r) => !existingIds.has(r.id) && !pendingIds.has(r.id),
  );
});

/** 追加フォームの確定ボタンの有効/無効 */
protected readonly canAddEntry = computed(() => {
  if (!this.selectedRepoId()) return false;
  if (!this.branchSelection()) return false;
  return true;
});

/** 保存ボタンの有効/無効 */
protected readonly canSave = computed(() => {
  if (this.saving()) return false;
  if (!this.hasChanges()) return false;
  // エントリが0件になる場合は保存不可（削除提案ダイアログへ誘導）
  if (this.willBeEmpty()) return false;
  return true;
});
```

### PendingEntry 型

```typescript
/**
 * 追加予定エントリの型。
 * workspace-create-form の BranchSelection と同じパターンを踏襲する。
 */
export type PendingEntry =
  | {
      readonly type: 'existing';
      readonly repositoryId: string;
      readonly branch: string;
    }
  | {
      readonly type: 'new';
      readonly repositoryId: string;
      readonly newBranchInfo: {
        readonly sourceBranch: string;
        readonly newBranchName: string;
      };
    };
```

### メソッド設計

#### 初期化

```
constructor() {
  const id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  void this.initialize(id);
}

async initialize(id):
  1. loading = true
  2. Promise.all([workspaceService.getWorkspace(id), repoService.getRepositories()])
  3. Workspace が見つからない場合 → notFound = true
  4. 全リポジトリのブランチを並列で fetch + 取得
  5. loading = false
```

#### エントリ削除予定に追加

```
markForRemoval(repositoryId: string):
  pendingRemovals に repositoryId を追加
```

#### エントリ削除予定を取り消し

```
unmarkRemoval(repositoryId: string):
  pendingRemovals から repositoryId を削除
```

#### 追加予定エントリを確定

```
confirmAddition():
  1. selectedRepoId と branchSelection から PendingEntry を構築
  2. pendingAdditions に追加
  3. selectedRepoId / branchSelection をリセット
```

#### 追加予定エントリを取り消し

```
cancelAddition(repositoryId: string):
  pendingAdditions から該当エントリを除外
```

#### リポジトリ選択時のブランチ取得

```
async onRepoSelected(repoId: string):
  1. selectedRepoId を更新
  2. branchSelection をリセット
  3. branchesMap に未取得の場合、fetch → getRemoteBranches で取得
```

#### 保存

```
async save():
  1. saving = true
  2. 削除分がある場合: removeEntry(id, repositoryIds) を呼び出し
     → 失敗時: toast.error → saving = false → return
  3. 追加分がある場合: addEntry(id, entries) を呼び出し
     → entries は PendingEntry から WorkspaceCreateEntry[] に変換
     → 失敗時: toast.error → saving = false → return
     ※ 削除は成功済みなので、追加失敗時も削除分はロールバックしない
  4. 最後に成功した IPC レスポンスの Workspace で workspace シグナルを更新
  5. pendingRemovals / pendingAdditions をクリア
  6. toast.success
  7. saving = false
```

#### 全エントリ削除時の Workspace 削除

```
async deleteWorkspace():
  1. workspaceService.deleteWorkspace(id) を呼び出し
  2. 成功時: toast.success → router.navigate(['/workspaces'])
  3. 失敗時: toast.error
```

#### 戻るナビゲーション

```
goBack():
  router.navigate(['/workspaces'])
```

## テンプレート構成

### 全体レイアウト

```
<div class="mx-auto max-w-4xl p-6">
  <!-- ヘッダー: 戻るボタン + Workspace 名 + 保存ボタン -->
  <!-- ローディング状態 -->
  <!-- Not Found 状態 -->
  <!-- メインコンテンツ -->
    <!-- 既存エントリ一覧セクション -->
    <!-- セパレーター -->
    <!-- 新規エントリ追加セクション -->
    <!-- 追加予定エントリ一覧 -->
    <!-- セパレーター -->
    <!-- 保存プレビュー + 保存ボタン -->
</div>
```

### ヘッダー

```html
<div class="mb-6 flex items-center gap-4">
  <button
    hlmBtn
    variant="ghost"
    size="icon"
    (click)="goBack()"
    [attr.aria-label]="t('workspaceEdit.backAriaLabel')"
  >
    <ng-icon hlm name="lucideArrowLeft" size="sm" />
  </button>
  <h1 class="text-2xl font-bold">
    {{ t('workspaceEdit.title', { name: workspace()?.displayName }) }}
  </h1>
  <div class="ml-auto flex gap-2">
    <button hlmBtn [disabled]="!canSave()" (click)="save()">
      @if (saving()) {
      <hlm-spinner class="mr-1" />
      } {{ t('workspaceEdit.save') }}
    </button>
  </div>
</div>
```

### 既存エントリ一覧

```html
<section>
  <h2 class="mb-2 text-sm font-semibold">{{ t('workspaceEdit.currentEntries') }}</h2>
  <div class="flex flex-col gap-2">
    @for (entry of workspace()?.entries ?? []; track entry.repositoryId) {
    <div
      class="bg-muted flex items-center justify-between rounded-md px-3 py-2"
      [class.opacity-50]="pendingRemovals().has(entry.repositoryId)"
      [class.line-through]="pendingRemovals().has(entry.repositoryId)"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium"> {{ getRepoName(entry.repositoryId) }} </span>
        <ng-icon hlm name="lucideGitBranch" size="xs" class="text-muted-foreground" />
        <span class="text-muted-foreground text-sm">{{ entry.branch }}</span>
      </div>
      @if (pendingRemovals().has(entry.repositoryId)) {
      <button
        hlmBtn
        variant="ghost"
        size="icon"
        (click)="unmarkRemoval(entry.repositoryId)"
        [attr.aria-label]="t('workspaceEdit.undoRemoveAriaLabel')"
      >
        <ng-icon hlm name="lucideUndo2" size="xs" />
      </button>
      } @else {
      <button
        hlmBtn
        variant="ghost"
        size="icon"
        class="text-muted-foreground hover:text-destructive"
        (click)="markForRemoval(entry.repositoryId)"
        [attr.aria-label]="t('workspaceEdit.removeAriaLabel')"
      >
        <ng-icon hlm name="lucideTrash2" size="xs" />
      </button>
      }
    </div>
    }
  </div>
</section>
```

### 新規エントリ追加セクション

```html
<section>
  <h2 class="mb-2 text-sm font-semibold">{{ t('workspaceEdit.addEntry') }}</h2>

  @if (availableRepos().length === 0) {
  <p class="text-muted-foreground text-sm">{{ t('workspaceEdit.noAvailableRepos') }}</p>
  } @else {
  <div class="flex flex-col gap-3">
    <!-- リポジトリ選択ドロップダウン -->
    <!-- ブランチ選択（BranchCombobox + CreateBranchDialog） -->
    <!-- 追加ボタン -->
  </div>
  }
</section>
```

リポジトリ選択は `<select>` または spartan-ng の select コンポーネントを使用し、未追加リポジトリのみ表示する。

ブランチ選択は `BranchComboboxComponent` を再利用し、新規ブランチ作成は `CreateBranchDialogComponent` を再利用する。workspace-create-form と同じパターン。

### 追加予定エントリ一覧

```html
@if (pendingAdditions().length > 0) {
<section>
  <h2 class="mb-2 text-sm font-semibold">{{ t('workspaceEdit.pendingAdditions') }}</h2>
  <div class="flex flex-col gap-2">
    @for (entry of pendingAdditions(); track entry.repositoryId) {
    <div
      class="border-primary/20 bg-primary/5 flex items-center justify-between rounded-md border px-3 py-2"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium"> {{ getRepoName(entry.repositoryId) }} </span>
        <ng-icon hlm name="lucideGitBranch" size="xs" class="text-muted-foreground" />
        <span class="text-muted-foreground text-sm"> {{ getEntryBranchName(entry) }} </span>
        @if (entry.type === 'new') {
        <span class="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
          {{ t('workspaceEdit.newBranch') }}
        </span>
        }
      </div>
      <button
        hlmBtn
        variant="ghost"
        size="icon"
        class="text-muted-foreground hover:text-destructive"
        (click)="cancelAddition(entry.repositoryId)"
        [attr.aria-label]="t('workspaceEdit.cancelAddAriaLabel')"
      >
        <ng-icon hlm name="lucideTrash2" size="xs" />
      </button>
    </div>
    }
  </div>
</section>
}
```

### 全エントリ削除時の Workspace 削除提案

```html
@if (willBeEmpty() && hasChanges()) {
<section hlmCard class="border-destructive/20 text-center">
  <div hlmCardHeader>
    <h3 hlmCardTitle>{{ t('workspaceEdit.allEntriesRemoved') }}</h3>
    <p hlmCardDescription>{{ t('workspaceEdit.deleteWorkspacePrompt') }}</p>
  </div>
  <div hlmCardContent>
    <hlm-alert-dialog>
      <button hlmBtn variant="destructive" hlmAlertDialogTrigger>
        {{ t('workspaceEdit.deleteWorkspace') }}
      </button>
      <hlm-alert-dialog-content *hlmAlertDialogPortal="let ctx">
        <hlm-alert-dialog-header>
          <h2 hlmAlertDialogTitle>{{ t('workspaces.deleteConfirmTitle') }}</h2>
          <p hlmAlertDialogDescription>
            {{ t('workspaces.deleteConfirmDescription', { name: workspace()?.displayName }) }}
          </p>
        </hlm-alert-dialog-header>
        <hlm-alert-dialog-footer>
          <button hlmAlertDialogCancel (click)="ctx.close()">{{ t('common.cancel') }}</button>
          <button hlmAlertDialogAction (click)="deleteWorkspace()">
            {{ t('workspaces.deleteAction') }}
          </button>
        </hlm-alert-dialog-footer>
      </hlm-alert-dialog-content>
    </hlm-alert-dialog>
  </div>
</section>
}
```

## ルーティング

```typescript
// src/app/app.routes.ts に追加

{
  path: 'workspaces/:id/edit',
  loadComponent: () =>
    import('./workspaces/workspace-edit').then((m) => m.WorkspaceEditComponent),
},
```

既存の `workspaces` ルートの後、`''` リダイレクトの前に配置する。

## workspace-list への編集ボタン追加

### workspace-list.ts の変更

```typescript
// import 追加
import { Router } from '@angular/router';
import { lucideGitBranch, lucidePlus, lucideTrash2, lucidePencil } from '@ng-icons/lucide';

// providers 更新
providers: [provideIcons({ lucideGitBranch, lucidePlus, lucideTrash2, lucidePencil })],

// inject 追加
private readonly router = inject(Router);

// メソッド追加
protected editWorkspace(id: string): void {
  void this.router.navigate(['/workspaces', id, 'edit']);
}
```

### workspace-list.html の変更

削除ボタンの左隣に編集アイコンボタンを追加する。既存の `absolute top-2 right-2` の div 内に、削除ボタンの前に配置する。

```html
<!-- 既存の absolute top-2 right-2 div 内 -->
<div class="absolute top-2 right-2 z-10 flex gap-1" ...>
  <!-- 編集ボタン（新規追加） -->
  <button
    hlmBtn
    variant="ghost"
    size="icon"
    class="text-muted-foreground hover:text-foreground h-7 w-7"
    [disabled]="deletingIds().has(ws.id) || openingIds().has(ws.id)"
    [attr.aria-label]="t('workspaceEdit.editAriaLabel')"
    (click)="editWorkspace(ws.id)"
  >
    <ng-icon hlm name="lucidePencil" size="xs" />
  </button>

  <!-- 既存の削除ボタン（hlm-alert-dialog）はそのまま -->
</div>
```

## 翻訳キー

### en.json に追加

```json
{
  "workspaceEdit": {
    "title": "Edit: {{ name }}",
    "save": "Save",
    "saving": "Saving...",
    "backAriaLabel": "Back to workspace list",
    "editAriaLabel": "Edit",
    "currentEntries": "Current Entries",
    "addEntry": "Add Entry",
    "pendingAdditions": "Entries to Add",
    "noAvailableRepos": "All registered repositories are already included.",
    "selectRepo": "Select a repository",
    "removeAriaLabel": "Mark for removal",
    "undoRemoveAriaLabel": "Undo removal",
    "cancelAddAriaLabel": "Cancel addition",
    "newBranch": "new",
    "allEntriesRemoved": "All entries will be removed",
    "deleteWorkspacePrompt": "This workspace will have no entries. Would you like to delete the workspace instead?",
    "deleteWorkspace": "Delete Workspace",
    "saveSuccess": "Workspace \"{{ name }}\" updated",
    "savePartialSuccess": "Changes partially saved. Some operations failed.",
    "addFailed": "Failed to add entries: {{ message }}",
    "removeFailed": "Failed to remove entries: {{ message }}"
  }
}
```

### ja.json に追加

```json
{
  "workspaceEdit": {
    "title": "編集: {{ name }}",
    "save": "保存",
    "saving": "保存中...",
    "backAriaLabel": "ワークスペース一覧に戻る",
    "editAriaLabel": "編集",
    "currentEntries": "現在のエントリ",
    "addEntry": "エントリを追加",
    "pendingAdditions": "追加予定のエントリ",
    "noAvailableRepos": "登録済みリポジトリは全て追加済みです。",
    "selectRepo": "リポジトリを選択",
    "removeAriaLabel": "削除予定にする",
    "undoRemoveAriaLabel": "削除を取り消す",
    "cancelAddAriaLabel": "追加を取り消す",
    "newBranch": "新規",
    "allEntriesRemoved": "全てのエントリが削除されます",
    "deleteWorkspacePrompt": "エントリがなくなります。ワークスペースを削除しますか？",
    "deleteWorkspace": "ワークスペースを削除",
    "saveSuccess": "Workspace「{{ name }}」を更新しました",
    "savePartialSuccess": "一部の変更のみ保存されました。",
    "addFailed": "エントリの追加に失敗しました: {{ message }}",
    "removeFailed": "エントリの削除に失敗しました: {{ message }}"
  }
}
```

## コンポーネント構成

| ファイル                                        | 変更種別 | 責務                                                                           |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `src/app/services/workspace.service.ts`         | 修正     | `getWorkspace` / `addEntry` / `removeEntry` メソッド追加                       |
| `src/app/workspaces/workspace-edit.ts` (新規)   | 新規     | 編集ページコンポーネント（状態管理、IPC 呼び出し、バッチ確定ロジック）         |
| `src/app/workspaces/workspace-edit.html` (新規) | 新規     | 編集ページテンプレート（エントリ一覧、追加セクション、削除操作、保存ボタン）   |
| `src/app/app.routes.ts`                         | 修正     | `workspaces/:id/edit` ルート追加（lazy load）                                  |
| `src/app/workspaces/workspace-list.ts`          | 修正     | `lucidePencil` アイコン追加、`Router` inject、`editWorkspace(id)` メソッド追加 |
| `src/app/workspaces/workspace-list.html`        | 修正     | 削除ボタンの左隣に編集アイコンボタン追加、ボタンコンテナを `flex gap-1` に変更 |
| `public/i18n/en.json`                           | 修正     | `workspaceEdit` セクション追加                                                 |
| `public/i18n/ja.json`                           | 修正     | `workspaceEdit` セクション追加                                                 |

## 保存フローの詳細

```
save():
  1. saving = true

  2. 削除分の処理:
     if (pendingRemovals.size > 0):
       result = await workspaceService.removeEntry(id, [...pendingRemovals])
       if (!result.success):
         toast.error(t('workspaceEdit.removeFailed', { message: result.error.message }))
         saving = false
         return
       workspace.set(result.data)  // 中間状態を反映

  3. 追加分の処理:
     if (pendingAdditions.length > 0):
       entries = pendingAdditions.map(toWorkspaceCreateEntry)
       result = await workspaceService.addEntry(id, entries)
       if (!result.success):
         // 削除は成功済み → 部分的成功
         toast.error(t('workspaceEdit.addFailed', { message: result.error.message }))
         // 削除分は反映済みなので pendingRemovals のみクリア
         pendingRemovals.set(new Set())
         saving = false
         return
       workspace.set(result.data)

  4. 全成功:
     pendingRemovals.set(new Set())
     pendingAdditions.set([])
     toast.success(t('workspaceEdit.saveSuccess', { name: workspace().displayName }))
     saving = false
```

### PendingEntry → WorkspaceCreateEntry 変換

```typescript
function toWorkspaceCreateEntry(entry: PendingEntry): WorkspaceCreateEntry {
  if (entry.type === 'existing') {
    return { repositoryId: entry.repositoryId, branch: entry.branch };
  }
  return {
    repositoryId: entry.repositoryId,
    branch: entry.newBranchInfo.newBranchName,
    sourceBranch: entry.newBranchInfo.sourceBranch,
  };
}
```

## ヘルパーメソッド

```typescript
/** リポジトリ ID から表示名を取得する */
protected getRepoName(repositoryId: string): string {
  return this.repoMap().get(repositoryId)?.displayName
    ?? this.transloco.translate('workspaces.unknownRepo');
}

/** PendingEntry からブランチ表示名を取得する */
protected getEntryBranchName(entry: PendingEntry): string {
  return entry.type === 'existing'
    ? entry.branch
    : entry.newBranchInfo.newBranchName;
}

/** デフォルトブランチを取得する（CreateBranchDialog 用） */
protected getDefaultBranch(repoId: string): string {
  const branches = this.branchesMap().get(repoId) ?? [];
  return branches.find((b) => b === 'main')
    ?? branches.find((b) => b === 'master')
    ?? branches[0]
    ?? 'main';
}
```

## テスト計画

Unit 2 はコンポーネントテストなし（Unit of Work 定義に記載の通り）。
Build and Test フェーズで以下を確認する:

- `pnpm build` が成功すること（型エラーなし）
- `pnpm lint` が成功すること
- 翻訳キーの整合性（en.json / ja.json に同じキーが存在すること）
