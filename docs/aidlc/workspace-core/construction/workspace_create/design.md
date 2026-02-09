# Design: workspace_create

## 概要

Workspace 作成フローの Angular コンポーネントとサービスを実装する。Workspace 名入力・登録済みリポジトリの選択（複数選択可）・リポジトリごとのブランチ指定（非対称ブランチ対応）・Workspace 生成（Worktree + `.code-workspace` + VS Code 起動）までの一連の操作を提供する。

画面表示時に登録済みリポジトリに対して auto-fetch をバックグラウンド非同期で実行し、最新のリモートブランチ一覧を UI ノンブロッキングで取得する。作成処理中は進捗フィードバックを表示する。

Angular 21 のスタンドアロンコンポーネント・シグナル・ゾーンレス変更検知を活用し、`window.electronAPI` 経由の IPC 通信でメインプロセスと連携する。UI は spartan-ng/helm コンポーネントと Tailwind CSS 4 で構築する。

## ドメインモデル

### Angular サービス

#### WorkspaceService

- **責務**: `window.electronAPI` の Workspace 関連メソッドをラップし、Angular コンポーネントに IPC 通信を抽象化して提供する
- **設計方針**:
  - `Injectable({ providedIn: 'root' })` でシングルトン提供
  - 全メソッドは `IpcResult<T>` を返す `Promise` ベース
  - エラーハンドリングはコンポーネント側に委譲

```typescript
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  /** Workspace 一覧を取得する */
  getWorkspaces(): Promise<IpcResult<Workspace[]>>;

  /** Workspace を作成する */
  createWorkspace(
    name: string,
    entries: { repositoryId: string; branch: string }[],
  ): Promise<IpcResult<Workspace>>;

  /** Workspace を削除する */
  deleteWorkspace(id: string): Promise<IpcResult<null>>;

  /** Workspace を VS Code で開く */
  openWorkspace(id: string): Promise<IpcResult<null>>;
}
```

**設計ポイント**:

- `RepositoryService`（Unit 4 で実装済み）のリポジトリ一覧取得・ブランチ取得・fetch メソッドを再利用する
- `WorkspaceService` は Workspace 固有の操作のみを担当し、リポジトリ操作は `RepositoryService` に委譲する
- Unit 6（dashboard）でも `WorkspaceService` を使用するため、`providedIn: 'root'` でアプリ全体で共有する

### コンポーネント

#### WorkspaceCreateComponent

- **責務**: Workspace 作成フロー全体を管理するページコンポーネント
- **ルート**: `/workspaces/new`
- **状態管理**: Angular Signals で管理

```typescript
@Component({
  selector: 'app-workspace-create',
  standalone: true,
  templateUrl: './workspace-create.html',
  // ...
})
export class WorkspaceCreateComponent {
  /** Workspace 名 */
  protected readonly workspaceName = signal('');

  /** 登録済みリポジトリ一覧 */
  protected readonly repositories = signal<Repository[]>([]);

  /** 選択されたリポジトリ ID のセット */
  protected readonly selectedRepoIds = signal<Set<string>>(new Set());

  /** リポジトリごとのブランチ一覧（repositoryId → branches） */
  protected readonly branchesMap = signal<Map<string, string[]>>(new Map());

  /** リポジトリごとの選択中ブランチ（repositoryId → branch） */
  protected readonly selectedBranches = signal<Map<string, string>>(new Map());

  /** リポジトリごとの fetch 中フラグ（repositoryId → boolean） */
  protected readonly fetchingIds = signal<Set<string>>(new Set());

  /** リポジトリ一覧のローディング状態 */
  protected readonly loadingRepos = signal(true);

  /** Workspace 作成処理中フラグ */
  protected readonly creating = signal(false);

  /** Workspace 名のバリデーションエラー */
  protected readonly nameError = signal<string | null>(null);

  /** 選択バリデーションエラー */
  protected readonly selectionError = signal<string | null>(null);
}
```

## API 仕様

本 Unit は新たな IPC チャネルを追加しない。Unit 3（ipc_bridge）で定義済みの以下のチャネルを Angular 側から利用する:

| 使用チャネル       | 用途                           | 呼び出し元               |
| ------------------ | ------------------------------ | ------------------------ |
| `repo:list`        | 登録済みリポジトリ一覧取得     | WorkspaceCreateComponent |
| `repo:branches`    | リモートブランチ一覧取得       | WorkspaceCreateComponent |
| `repo:fetch`       | リモート情報更新（auto-fetch） | WorkspaceCreateComponent |
| `workspace:create` | Workspace 作成                 | WorkspaceCreateComponent |

### フロントエンドバリデーション

`WorkspaceCreateComponent` で送信前に実施するクライアントサイドバリデーション:

| ルール             | 条件                                               | エラーメッセージ                                   |
| ------------------ | -------------------------------------------------- | -------------------------------------------------- |
| 名前必須           | `workspaceName` が空文字またはホワイトスペースのみ | `Workspace名を入力してください`                    |
| 名前形式           | 英数字・ハイフン・アンダースコア以外を含む         | `英数字、ハイフン、アンダースコアのみ使用できます` |
| リポジトリ選択必須 | `selectedRepoIds` が空                             | `1つ以上のリポジトリを選択してください`            |
| ブランチ選択必須   | 選択済みリポジトリのいずれかでブランチが未選択     | `全てのリポジトリでブランチを選択してください`     |

**設計ポイント**:

- Workspace 名の厳密なバリデーション（suffix 付与含む）はメインプロセス側で実施済みのため、フロントエンドでは基本的な形式チェックのみ行う
- メインプロセスから返される `VALIDATION_ERROR` / `GIT_OPERATION_FAILED` はトースト通知で表示する

## 使用する spartan-ng コンポーネント

| コンポーネント | import                | 用途                                            |
| -------------- | --------------------- | ----------------------------------------------- |
| Button         | `HlmButtonImports`    | 作成・キャンセル・リポジトリ選択/解除ボタン     |
| Card           | `HlmCardImports`      | リポジトリ選択カード                            |
| Sonner         | `toast`（ngx-sonner） | エラー通知のトースト表示                        |
| Field          | `HlmFieldImports`     | フォームフィールド構造（label + input + error） |
| Input          | `HlmInputImports`     | Workspace 名テキスト入力                        |
| Spinner        | `HlmSpinnerImports`   | ローディング・作成中・fetch 中表示              |
| Icon           | `HlmIconImports`      | Lucide アイコン                                 |
| Separator      | `HlmSeparatorImports` | セクション区切り                                |
| Select         | `HlmSelectImports`    | ブランチ選択ドロップダウン                      |
| Checkbox       | `HlmCheckboxImports`  | リポジトリ選択チェックボックス                  |

### インストール（未インストールの場合）

```bash
ng g @spartan-ng/cli:ui select
ng g @spartan-ng/cli:ui checkbox
```

`button`, `card`, `field`, `input`, `spinner`, `icon`, `separator`, `sonner` は既にインストール済み。

### Lucide アイコン

`@ng-icons/lucide` から以下のアイコンを使用:

- `lucideArrowLeft` — 戻るボタン
- `lucideLoader` — fetch 中インジケーター
- `lucideCheck` — 作成完了

`provideIcons()` でコンポーネントレベルに登録する。

## コンポーネント構成

```
src/
├── app/
│   ├── app.routes.ts                          # 変更: /workspaces/new ルート追加
│   ├── workspaces/
│   │   ├── workspace-create.ts                # Workspace 作成画面コンポーネント
│   │   ├── workspace-create.html              # テンプレート
│   │   └── workspace-create.spec.ts           # ユニットテスト
│   └── services/
│       ├── workspace.service.ts               # Workspace IPC サービス
│       ├── workspace.service.spec.ts          # ユニットテスト
│       └── repository.service.ts              # 既存（変更なし）
```

### ファイル詳細

#### `src/app/services/workspace.service.ts` — Workspace IPC サービス

```typescript
import { Injectable } from '@angular/core';
import type { Workspace } from '../../../electron/types/models';
import type { IpcResult } from '../../../electron/types/ipc-result';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  getWorkspaces(): Promise<IpcResult<Workspace[]>> {
    return window.electronAPI.getWorkspaces();
  }

  createWorkspace(
    name: string,
    entries: { repositoryId: string; branch: string }[],
  ): Promise<IpcResult<Workspace>> {
    return window.electronAPI.createWorkspace(name, entries);
  }

  deleteWorkspace(id: string): Promise<IpcResult<null>> {
    return window.electronAPI.deleteWorkspace(id);
  }

  openWorkspace(id: string): Promise<IpcResult<null>> {
    return window.electronAPI.openWorkspace(id);
  }
}
```

**設計ポイント**:

- `RepositoryService` と同じパターンで `window.electronAPI` の薄いラッパーとして実装
- `deleteWorkspace` と `openWorkspace` は Unit 6（dashboard）で使用するが、サービスとしてはこの Unit で定義する
- テスト時は `TestBed.overrideProvider` でモックに差し替え可能

#### `src/app/workspaces/workspace-create.ts` — Workspace 作成画面

```typescript
@Component({
  selector: 'app-workspace-create',
  standalone: true,
  templateUrl: './workspace-create.html',
  imports: [
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSpinnerImports,
    HlmIconImports,
    HlmSeparatorImports,
    HlmSelectImports,
    HlmCheckboxImports,
  ],
  providers: [provideIcons({ lucideArrowLeft, lucideLoader, lucideCheck })],
})
export class WorkspaceCreateComponent {
  private readonly repoService = inject(RepositoryService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly router = inject(Router);

  /** Workspace 名 */
  protected readonly workspaceName = signal('');

  /** 登録済みリポジトリ一覧 */
  protected readonly repositories = signal<Repository[]>([]);

  /** 選択されたリポジトリ ID のセット */
  protected readonly selectedRepoIds = signal<Set<string>>(new Set());

  /** リポジトリごとのブランチ一覧（repositoryId → branches） */
  protected readonly branchesMap = signal<Map<string, string[]>>(new Map());

  /** リポジトリごとの選択中ブランチ（repositoryId → branch） */
  protected readonly selectedBranches = signal<Map<string, string>>(new Map());

  /** リポジトリごとの fetch 中フラグ */
  protected readonly fetchingIds = signal<Set<string>>(new Set());

  /** リポジトリ一覧のローディング状態 */
  protected readonly loadingRepos = signal(true);

  /** Workspace 作成処理中フラグ */
  protected readonly creating = signal(false);

  /** Workspace 名のバリデーションエラー */
  protected readonly nameError = signal<string | null>(null);

  /** 選択バリデーションエラー */
  protected readonly selectionError = signal<string | null>(null);

  /** 選択済みリポジトリの computed（テンプレート用） */
  protected readonly selectedRepositories = computed(() => {
    const ids = this.selectedRepoIds();
    return this.repositories().filter((r) => ids.has(r.id));
  });

  /** フォーム送信可能かどうかの computed */
  protected readonly canSubmit = computed(() => {
    if (this.creating()) return false;
    if (this.workspaceName().trim().length === 0) return false;
    if (this.selectedRepoIds().size === 0) return false;
    // 全選択リポジトリでブランチが選択されているか
    for (const id of this.selectedRepoIds()) {
      if (!this.selectedBranches().has(id)) return false;
    }
    return true;
  });

  constructor() {
    void this.initialize();
  }

  /** 初期化: リポジトリ一覧取得 + auto-fetch */
  private async initialize(): Promise<void> {
    this.loadingRepos.set(true);

    const result = await this.repoService.getRepositories();
    if (result.success) {
      this.repositories.set(result.data);
      // auto-fetch をバックグラウンドで並行実行（UI ノンブロッキング）
      this.autoFetchAll(result.data);
    } else {
      toast.error(result.error.message);
    }

    this.loadingRepos.set(false);
  }

  /**
   * 全リポジトリに対して auto-fetch を並行実行する。
   *
   * 各リポジトリの fetch は独立して実行され、1つが失敗しても他に影響しない。
   * fetch 完了後にブランチ一覧を自動取得する。
   */
  private autoFetchAll(repos: Repository[]): void {
    for (const repo of repos) {
      void this.fetchAndLoadBranches(repo.id);
    }
  }

  /**
   * 指定リポジトリの fetch + ブランチ一覧取得を実行する。
   *
   * fetch 中は fetchingIds に追加し、UI でインジケーターを表示する。
   * fetch 失敗時もブランチ一覧取得は試みる（キャッシュ済みデータがある可能性）。
   */
  private async fetchAndLoadBranches(repoId: string): Promise<void> {
    // fetch 中フラグ ON
    this.fetchingIds.update((ids) => new Set([...ids, repoId]));

    // fetch 実行（失敗しても続行）
    await this.repoService.fetchRepository(repoId);

    // ブランチ一覧取得
    const branchResult = await this.repoService.getRemoteBranches(repoId);
    if (branchResult.success) {
      this.branchesMap.update((map) => {
        const next = new Map(map);
        next.set(repoId, branchResult.data);
        return next;
      });
    }

    // fetch 中フラグ OFF
    this.fetchingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(repoId);
      return next;
    });
  }

  /** リポジトリの選択/解除をトグルする */
  protected toggleRepo(repoId: string): void {
    this.selectedRepoIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(repoId)) {
        next.delete(repoId);
        // 選択解除時にブランチ選択もクリア
        this.selectedBranches.update((map) => {
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

  /** リポジトリのブランチを選択する */
  protected selectBranch(repoId: string, branch: string): void {
    this.selectedBranches.update((map) => {
      const next = new Map(map);
      next.set(repoId, branch);
      return next;
    });
    this.selectionError.set(null);
  }

  /** クライアントサイドバリデーション */
  private validate(): boolean {
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
        if (!this.selectedBranches().has(id)) {
          this.selectionError.set('全てのリポジトリでブランチを選択してください');
          valid = false;
          break;
        }
      }
      if (valid) {
        this.selectionError.set(null);
      }
    }

    return valid;
  }

  /** Workspace 作成を実行する */
  protected async onCreate(): Promise<void> {
    if (!this.validate()) return;

    this.creating.set(true);

    const entries = [...this.selectedRepoIds()].map((repoId) => ({
      repositoryId: repoId,
      branch: this.selectedBranches().get(repoId)!,
    }));

    const result = await this.workspaceService.createWorkspace(
      this.workspaceName().trim(),
      entries,
    );

    if (result.success) {
      toast.success(`Workspace「${result.data.name}」を作成しました`);
      void this.router.navigate(['/']);
    } else {
      toast.error(result.error.message);
    }

    this.creating.set(false);
  }

  /** キャンセル（前の画面に戻る） */
  protected onCancel(): void {
    void this.router.navigate(['/']);
  }
}
```

**設計ポイント**:

- `constructor` で `initialize()` を呼び出し、画面表示と同時にリポジトリ一覧取得 + auto-fetch を開始する
- `autoFetchAll` は各リポジトリの fetch を `Promise.all` ではなく個別に `void` で起動し、1つの失敗が他に影響しないようにする
- fetch 完了後にブランチ一覧を自動取得するため、ユーザーがリポジトリを選択する頃にはブランチが利用可能になっている
- fetch 失敗時もブランチ一覧取得を試みる（前回 fetch 済みのキャッシュデータがある可能性）
- `computed` シグナル（`selectedRepositories`, `canSubmit`）でテンプレートの条件分岐を簡潔にする
- 作成成功時は `router.navigate(['/'])` でトップ画面（現時点では `/repos`、Unit 6 で `/dashboard` に変更予定）に遷移する
- `creating` フラグで作成ボタンを disabled にし、二重送信を防止する

#### `src/app/workspaces/workspace-create.html` — Workspace 作成テンプレート

```html
<div class="mx-auto max-w-4xl p-6">
  <!-- ヘッダー -->
  <div class="mb-6 flex items-center gap-3">
    <button hlmBtn variant="ghost" size="icon" (click)="onCancel()" aria-label="戻る">
      <ng-icon hlm name="lucideArrowLeft" size="sm" />
    </button>
    <h1 class="text-2xl font-bold">Workspace を作成</h1>
  </div>

  <form (submit)="onCreate(); $event.preventDefault()" class="flex flex-col gap-6">
    <!-- Step 1: Workspace 名入力 -->
    <section>
      <div hlmField [attr.data-invalid]="nameError() ? true : null">
        <label hlmFieldLabel for="workspace-name">Workspace 名</label>
        <input
          hlmInput
          id="workspace-name"
          type="text"
          placeholder="feature-payment"
          [value]="workspaceName()"
          (input)="workspaceName.set($any($event.target).value); nameError.set(null)"
          [disabled]="creating()"
          [attr.aria-invalid]="nameError() ? true : null"
          autocomplete="off"
        />
        @if (nameError()) {
        <hlm-field-error>{{ nameError() }}</hlm-field-error>
        }
      </div>
    </section>

    <brn-separator hlmSeparator />

    <!-- Step 2: リポジトリ選択 + ブランチ指定 -->
    <section>
      <h2 class="mb-3 text-lg font-semibold">リポジトリとブランチ</h2>
      <p class="text-muted-foreground mb-4 text-sm">
        Workspace に含めるリポジトリを選択し、各リポジトリのブランチを指定してください。
      </p>

      @if (loadingRepos()) {
      <div class="flex items-center justify-center gap-2 py-8">
        <hlm-spinner />
        <span class="text-muted-foreground text-sm">リポジトリを読み込み中...</span>
      </div>
      } @else if (repositories().length === 0) {
      <section hlmCard class="text-center">
        <div hlmCardHeader>
          <h3 hlmCardTitle>リポジトリが登録されていません</h3>
          <p hlmCardDescription>先にリポジトリ管理画面からリポジトリを登録してください。</p>
        </div>
      </section>
      } @else {
      <div class="flex flex-col gap-3" role="list">
        @for (repo of repositories(); track repo.id) {
        <div
          hlmCard
          role="listitem"
          class="p-4"
          [class.ring-primary]="selectedRepoIds().has(repo.id)"
          [class.ring-2]="selectedRepoIds().has(repo.id)"
        >
          <div class="flex items-start gap-3">
            <!-- チェックボックス -->
            <hlm-checkbox
              [checked]="selectedRepoIds().has(repo.id)"
              (changed)="toggleRepo(repo.id)"
              [disabled]="creating()"
              [attr.aria-label]="repo.name + ' を選択'"
            />

            <div class="flex-1">
              <!-- リポジトリ情報 -->
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ repo.name }}</span>
                @if (fetchingIds().has(repo.id)) {
                <ng-icon
                  hlm
                  name="lucideLoader"
                  size="xs"
                  class="text-muted-foreground animate-spin"
                />
                <span class="text-muted-foreground text-xs">同期中...</span>
                }
              </div>
              <p class="text-muted-foreground truncate text-xs">{{ repo.remoteUrl }}</p>

              <!-- ブランチ選択（リポジトリ選択時のみ表示） -->
              @if (selectedRepoIds().has(repo.id)) {
              <div class="mt-3">
                @if (branchesMap().has(repo.id)) {
                <brn-select
                  [value]="selectedBranches().get(repo.id) ?? ''"
                  (valueChange)="selectBranch(repo.id, $event)"
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
                } @else {
                <div class="flex items-center gap-2 py-1">
                  <hlm-spinner class="text-xs" />
                  <span class="text-muted-foreground text-xs"> ブランチを取得中... </span>
                </div>
                }
              </div>
              }
            </div>
          </div>
        </div>
        }
      </div>
      } @if (selectionError()) {
      <p class="text-destructive mt-2 text-sm">{{ selectionError() }}</p>
      }
    </section>

    <brn-separator hlmSeparator />

    <!-- アクションボタン -->
    <div class="flex justify-end gap-3">
      <button hlmBtn variant="outline" type="button" [disabled]="creating()" (click)="onCancel()">
        キャンセル
      </button>
      <button hlmBtn type="submit" [disabled]="!canSubmit()">
        @if (creating()) {
        <hlm-spinner class="mr-1 text-xs" />
        作成中... } @else { 作成 }
      </button>
    </div>
  </form>
</div>
```

**テンプレート設計ポイント**:

- Angular 21 の `@if` / `@for` / `@else` 制御フロー構文を使用
- `@for` の `track` に `repo.id` / `branch` を指定し、DOM の再利用を最適化
- リポジトリカードは選択状態で `ring-2 ring-primary` のアウトラインを表示し、視覚的に選択状態を明示する
- ブランチ選択は `brn-select` + `hlm-select-*` で spartan-ng のセレクトコンポーネントを使用
- ブランチ選択はリポジトリが選択された場合のみ表示（`@if (selectedRepoIds().has(repo.id))`）
- fetch 中のリポジトリには `lucideLoader` アイコン + `animate-spin` でインジケーターを表示
- ブランチ一覧がまだ取得されていないリポジトリには `hlm-spinner` + テキストで取得中を表示
- `canSubmit()` computed で作成ボタンの disabled 状態を制御（名前入力 + リポジトリ選択 + 全ブランチ選択が揃った場合のみ有効）
- `<form>` タグで囲み、Enter キーでの送信に対応
- `brn-separator` でセクション間を視覚的に区切る
- リポジトリが0件の場合は空状態メッセージを表示し、リポジトリ管理画面への誘導を行う

#### `src/app/app.routes.ts` — ルーティング変更

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'repos',
    loadComponent: () => import('./repos/repo-list').then((m) => m.RepoListComponent),
  },
  {
    path: 'workspaces/new',
    loadComponent: () =>
      import('./workspaces/workspace-create').then((m) => m.WorkspaceCreateComponent),
  },
  {
    path: '',
    redirectTo: 'repos',
    pathMatch: 'full',
  },
];
```

**変更内容**:

- `/workspaces/new` ルートを追加（遅延読み込み）
- デフォルトルートは引き続き `/repos`（Unit 6 で `/dashboard` に変更予定）

## 画面遷移

```
/repos（リポジトリ管理画面）
  └─ 「Workspace を作成」ボタン → /workspaces/new

/workspaces/new（Workspace 作成画面）
  ├─ 「作成」成功 → /（トップ画面にリダイレクト）
  └─ 「キャンセル」or 戻るボタン → /（トップ画面にリダイレクト）
```

**備考**:

- `/repos` 画面に「Workspace を作成」ボタンを追加する（`RepoListComponent` のヘッダー部分）
- Unit 6（dashboard）実装後は、Dashboard からも Workspace 作成画面に遷移できるようにする

### RepoListComponent への変更

`/repos` 画面のヘッダーに Workspace 作成画面への遷移ボタンを追加する。

```typescript
// repo-list.ts に追加
import { Router } from '@angular/router';

// コンポーネント内
private readonly router = inject(Router);

protected navigateToCreateWorkspace(): void {
  void this.router.navigate(['/workspaces/new']);
}
```

```html
<!-- repo-list.html のヘッダー部分に追加 -->
<div class="mb-6 flex items-center justify-between">
  <h1 class="text-2xl font-bold">リポジトリ</h1>
  <div class="flex gap-2">
    <button hlmBtn variant="outline" (click)="navigateToCreateWorkspace()">Workspace を作成</button>
    <!-- 既存の追加ダイアログ -->
    <hlm-dialog>
      <!-- ... -->
    </hlm-dialog>
  </div>
</div>
```

## Auto-Fetch 設計

### 概要

Workspace 作成画面を開いた時点で、登録済み全リポジトリに対して `git fetch` をバックグラウンドで並行実行する。これにより、ユーザーがリポジトリを選択する頃には最新のリモートブランチ一覧が利用可能になる。

### 処理フロー

```
画面表示
  │
  ├─ repoService.getRepositories() ─── リポジトリ一覧取得
  │     │
  │     └─ 成功 → repositories シグナル更新 + loadingRepos = false
  │           │
  │           └─ 各リポジトリに対して並行実行（fire-and-forget）:
  │                 │
  │                 ├─ fetchingIds に追加（UI インジケーター ON）
  │                 ├─ repoService.fetchRepository(id) ─── git fetch 実行
  │                 │     └─ 失敗しても続行（ベストエフォート）
  │                 ├─ repoService.getRemoteBranches(id) ─── ブランチ一覧取得
  │                 │     └─ 成功 → branchesMap 更新
  │                 └─ fetchingIds から削除（UI インジケーター OFF）
  │
  └─ ユーザー操作（リポジトリ選択・ブランチ指定）は fetch 完了を待たずに可能
```

### 設計ポイント

- **UI ノンブロッキング**: `loadingRepos` は `getRepositories()` 完了時に `false` になる。fetch はバックグラウンドで継続するが、リポジトリ一覧は即座に表示される
- **個別 fetch**: `Promise.all` ではなく各リポジトリを独立して fetch する。1つのリポジトリの fetch 失敗（ネットワークエラー等）が他に影響しない
- **fetch 中インジケーター**: `fetchingIds` シグナルで各リポジトリの fetch 状態を管理し、UI にスピナーを表示する
- **ブランチ一覧の遅延表示**: ブランチ一覧は fetch 完了後に `branchesMap` に格納される。リポジトリを選択した時点でブランチが未取得の場合は「ブランチを取得中...」と表示する
- **AC5 対応**: 「Workspace 作成時に auto-fetch が実行される」の受入条件を満たす

## テスト計画

### テスト環境の方針

- Angular テストは `@angular/build:unit-test` ビルダー経由で Vitest を使用
- `window.electronAPI` はテスト環境に存在しないため、`RepositoryService` と `WorkspaceService` をモックに差し替える
- テスト実行: `pnpm test:ng`

### ユニットテスト

#### WorkspaceService のテスト

テストファイル: `src/app/services/workspace.service.spec.ts`

- [ ] `getWorkspaces()` が `window.electronAPI.getWorkspaces()` を呼び出す
- [ ] `createWorkspace(name, entries)` が `window.electronAPI.createWorkspace(name, entries)` を呼び出す
- [ ] `deleteWorkspace(id)` が `window.electronAPI.deleteWorkspace(id)` を呼び出す
- [ ] `openWorkspace(id)` が `window.electronAPI.openWorkspace(id)` を呼び出す

**テスト方針**: `RepositoryService` のテストと同じパターンで `window.electronAPI` をグローバルモックとして設定する。

#### WorkspaceCreateComponent のテスト

テストファイル: `src/app/workspaces/workspace-create.spec.ts`

##### 初期化

- [ ] 初期化時に `RepositoryService.getRepositories()` が呼ばれる
- [ ] リポジトリ取得成功時に `repositories` シグナルが更新される
- [ ] リポジトリ取得失敗時に `toast.error()` が呼ばれる

##### Auto-Fetch

- [ ] 初期化時に全リポジトリに対して `RepositoryService.fetchRepository()` が呼ばれる
- [ ] fetch 完了後に `RepositoryService.getRemoteBranches()` が呼ばれる
- [ ] fetch 成功後に `branchesMap` が更新される
- [ ] fetch 失敗時もブランチ一覧取得が試みられる
- [ ] 1つのリポジトリの fetch 失敗が他のリポジトリに影響しない

##### リポジトリ選択ロジック

- [ ] `toggleRepo()` でリポジトリが `selectedRepoIds` に追加される
- [ ] `toggleRepo()` で選択済みリポジトリが `selectedRepoIds` から削除される
- [ ] リポジトリ選択解除時に `selectedBranches` からも該当エントリが削除される

##### ブランチ選択ロジック

- [ ] `selectBranch()` で `selectedBranches` が更新される

##### バリデーション

- [ ] 空の Workspace 名で `validate()` が失敗する
- [ ] 不正な形式の Workspace 名（日本語、スペース等）で `validate()` が失敗する
- [ ] リポジトリ未選択で `validate()` が失敗する
- [ ] ブランチ未選択のリポジトリがある状態で `validate()` が失敗する
- [ ] 有効な入力で `validate()` が成功する

##### canSubmit computed

- [ ] 名前未入力時に `false` を返す
- [ ] リポジトリ未選択時に `false` を返す
- [ ] ブランチ未選択時に `false` を返す
- [ ] 全条件を満たす場合に `true` を返す
- [ ] `creating` が `true` の場合に `false` を返す

##### Workspace 作成

- [ ] `onCreate()` が `WorkspaceService.createWorkspace()` を正しい引数で呼ぶ
- [ ] 作成成功時に `toast.success()` が呼ばれる
- [ ] 作成成功時に `router.navigate(['/'])` で遷移する
- [ ] 作成失敗時に `toast.error()` が呼ばれる
- [ ] バリデーション失敗時に `createWorkspace()` が呼ばれない

##### ナビゲーション

- [ ] `onCancel()` が `router.navigate(['/'])` を呼ぶ

### テストモック戦略

```typescript
// RepositoryService のモック
const mockRepoService = {
  getRepositories: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'repo-1',
        name: 'backend',
        remoteUrl: 'https://github.com/org/backend.git',
        registeredAt: '2026-02-08T12:00:00.000Z',
      },
      {
        id: 'repo-2',
        name: 'frontend',
        remoteUrl: 'https://github.com/org/frontend.git',
        registeredAt: '2026-02-08T12:00:00.000Z',
      },
    ],
  }),
  getRemoteBranches: vi.fn().mockResolvedValue({
    success: true,
    data: ['main', 'develop', 'feature/payment'],
  }),
  fetchRepository: vi.fn().mockResolvedValue({ success: true, data: null }),
};

// WorkspaceService のモック
const mockWorkspaceService = {
  createWorkspace: vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'ws-1',
      name: 'feature-payment-a3f2b1c9',
      entries: [
        { repositoryId: 'repo-1', branch: 'feature/payment' },
        { repositoryId: 'repo-2', branch: 'main' },
      ],
      createdAt: '2026-02-09T12:00:00.000Z',
      updatedAt: '2026-02-09T12:00:00.000Z',
    },
  }),
  getWorkspaces: vi.fn(),
  deleteWorkspace: vi.fn(),
  openWorkspace: vi.fn(),
};

// Router のモック
const mockRouter = {
  navigate: vi.fn().mockResolvedValue(true),
};

// TestBed 設定
TestBed.configureTestingModule({
  imports: [WorkspaceCreateComponent],
  providers: [
    { provide: RepositoryService, useValue: mockRepoService },
    { provide: WorkspaceService, useValue: mockWorkspaceService },
    { provide: Router, useValue: mockRouter },
  ],
});
```

## 非機能要件

### パフォーマンス

- リポジトリ一覧の初期表示: IPC 通信のオーバーヘッドは < 1ms のため、JSON ファイル読み込み含めて即座に表示される
- auto-fetch: バックグラウンド非同期実行。UI をブロックしない。各リポジトリの fetch は並行実行される
- Workspace 作成（`workspace:create`）: Worktree 生成 + `.code-workspace` 作成で 5 秒以内（AC3 のパフォーマンス要件）
- `loadComponent` による遅延読み込みで、初期バンドルサイズへの影響を最小化

### セキュリティ

- `window.electronAPI` 経由の IPC 通信のみを使用し、レンダラーから直接 Node.js API にアクセスしない
- Workspace 名のバリデーションはフロントエンドで基本チェック、メインプロセス側で厳密チェックの二段構え
- テンプレート内の `{{ }}` バインディングは Angular が自動的に HTML エスケープするため、XSS リスクなし

### アクセシビリティ

- `hlm-checkbox` による選択操作のキーボード対応（Space キーでトグル）
- `brn-select` + `hlm-select-*` によるブランチ選択のキーボード対応（矢印キーで選択）
- `hlmField` + `hlmFieldLabel` による Workspace 名入力のラベル紐付け
- `hlm-field-error` によるバリデーションエラーのアクセシブルな通知
- `aria-label` による戻るボタン・チェックボックスのスクリーンリーダー対応
- `aria-invalid` によるエラー状態の明示
- `disabled` 属性による操作不可状態の明示
- `role="list"` / `role="listitem"` によるリポジトリ一覧のセマンティクス
- `<form>` + `<button type="submit">` で Enter キー送信に対応
- Sonner トーストは `role="status"` + `aria-live="polite"` でスクリーンリーダーに通知される

### 監視・ログ

- 本 Unit ではロガーは導入しない
- IPC エラーは `IpcResult.error.message` をそのまま `toast.error()` で UI に表示する
- auto-fetch の失敗はサイレントに処理する（ユーザーへの通知不要。ブランチ一覧が古い可能性があるが、致命的ではない）

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2026-02-09 | 初版作成 |
