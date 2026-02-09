# Design: dashboard

## 概要

Dashboard 画面の Angular コンポーネントを実装する。作成済み Workspace の一覧表示・Open（VS Code 起動）・Delete（確認ダイアログ + 完全消去）操作を提供するアプリのメイン画面。

Dashboard はアプリ起動時のデフォルト画面として機能し、ユーザーが最も頻繁にアクセスする画面となる。Workspace 一覧には名前・リポジトリ × ブランチ構成・作成日時を表示し、ワンクリックで VS Code を起動できる。

Angular 21 のスタンドアロンコンポーネント・シグナル・ゾーンレス変更検知を活用し、`window.electronAPI` 経由の IPC 通信でメインプロセスと連携する。UI は spartan-ng/helm コンポーネントと Tailwind CSS 4 で構築する。

## ドメインモデル

### Angular サービス（既存・変更なし）

#### WorkspaceService

- **責務**: `window.electronAPI` の Workspace 関連メソッドをラップし、Angular コンポーネントに IPC 通信を抽象化して提供する
- **設計方針**: Unit 5（workspace_create）で実装済み。Dashboard からは以下のメソッドを使用する

```typescript
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  /** Workspace 一覧を取得する */
  getWorkspaces(): Promise<IpcResult<Workspace[]>>;

  /** Workspace を削除する */
  deleteWorkspace(id: string): Promise<IpcResult<null>>;

  /** Workspace を VS Code で開く */
  openWorkspace(id: string): Promise<IpcResult<null>>;
}
```

#### RepositoryService

- **責務**: リポジトリ情報の取得。Dashboard では Workspace のエントリに含まれる `repositoryId` からリポジトリ名を解決するために使用する
- **設計方針**: Unit 4（repo_management）で実装済み。Dashboard からは以下のメソッドを使用する

```typescript
@Injectable({ providedIn: 'root' })
export class RepositoryService {
  /** 登録済みリポジトリ一覧を取得する */
  getRepositories(): Promise<IpcResult<Repository[]>>;
}
```

### コンポーネント

#### DashboardComponent

- **責務**: Dashboard 画面全体を管理するページコンポーネント。Workspace 一覧の表示、Open・Delete 操作を提供する
- **ルート**: `/dashboard`（デフォルトルート）
- **状態管理**: Angular Signals で管理

```typescript
@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  // ...
})
export class DashboardComponent {
  /** 作成済み Workspace 一覧 */
  protected readonly workspaces = signal<Workspace[]>([]);

  /** 登録済みリポジトリ一覧（repositoryId → name の解決用） */
  protected readonly repositories = signal<Repository[]>([]);

  /** ローディング状態 */
  protected readonly loading = signal(true);

  /** 削除処理中の Workspace ID セット */
  protected readonly deletingIds = signal<Set<string>>(new Set());

  /** Open 処理中の Workspace ID セット */
  protected readonly openingIds = signal<Set<string>>(new Set());

  /** repositoryId → Repository の Map（computed） */
  protected readonly repoMap = computed(() => {
    const map = new Map<string, Repository>();
    for (const repo of this.repositories()) {
      map.set(repo.id, repo);
    }
    return map;
  });
}
```

**状態設計ポイント**:

- `workspaces` と `repositories` を並行取得し、`repoMap` computed で repositoryId → リポジトリ名の解決を効率化する
- `deletingIds` / `openingIds` で個別の Workspace に対する操作中状態を管理し、UI でローディング表示を出す
- `loading` は初期データ取得中のみ `true`。取得完了後は個別操作の状態管理に切り替わる

## API 仕様

本 Unit は新たな IPC チャネルを追加しない。Unit 3（ipc_bridge）で定義済みの以下のチャネルを Angular 側から利用する:

| 使用チャネル       | 用途                             | 呼び出し元         |
| ------------------ | -------------------------------- | ------------------ |
| `workspace:list`   | Workspace 一覧取得               | DashboardComponent |
| `workspace:delete` | Workspace 削除                   | DashboardComponent |
| `workspace:open`   | Workspace を VS Code で開く      | DashboardComponent |
| `repo:list`        | リポジトリ一覧取得（名前解決用） | DashboardComponent |

## 使用する spartan-ng コンポーネント

| コンポーネント | import                  | 用途                               |
| -------------- | ----------------------- | ---------------------------------- |
| Button         | `HlmButtonImports`      | Open・Delete・Workspace 作成ボタン |
| Card           | `HlmCardImports`        | Workspace カード、空状態の表示     |
| Sonner         | `toast`（ngx-sonner）   | エラー・成功通知のトースト表示     |
| Alert Dialog   | `HlmAlertDialogImports` | 削除確認ダイアログ                 |
| Spinner        | `HlmSpinnerImports`     | ローディング・削除中・Open 中表示  |
| Icon           | `HlmIconImports`        | Lucide アイコン                    |
| Separator      | `HlmSeparatorImports`   | セクション区切り（必要に応じて）   |

全て既にインストール済み。追加インストールは不要。

### Lucide アイコン

`@ng-icons/lucide` から以下のアイコンを使用:

- `lucideExternalLink` — Open ボタン（VS Code で開く）
- `lucideTrash2` — Delete ボタン
- `lucidePlus` — Workspace 作成ボタン
- `lucideGitBranch` — ブランチ情報の視覚的インジケーター

`provideIcons()` でコンポーネントレベルに登録する。

## コンポーネント構成

```
src/
├── app/
│   ├── app.routes.ts                          # 変更: /dashboard ルート追加、デフォルトリダイレクト変更
│   ├── dashboard/
│   │   ├── dashboard.ts                       # Dashboard 画面コンポーネント
│   │   ├── dashboard.html                     # テンプレート
│   │   └── dashboard.spec.ts                  # ユニットテスト
│   └── services/
│       ├── workspace.service.ts               # 既存（変更なし）
│       └── repository.service.ts              # 既存（変更なし）
```

### ファイル詳細

#### `src/app/dashboard/dashboard.ts` — Dashboard 画面

```typescript
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideGitBranch, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { RepositoryService } from '../services/repository.service';
import { WorkspaceService } from '../services/workspace.service';
import type { Repository, Workspace } from '../../../electron/types/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  imports: [
    HlmAlertDialogImports,
    HlmButtonImports,
    HlmCardImports,
    HlmIconImports,
    HlmSpinnerImports,
  ],
  providers: [provideIcons({ lucideExternalLink, lucideGitBranch, lucidePlus, lucideTrash2 })],
})
export class DashboardComponent {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly repoService = inject(RepositoryService);
  private readonly router = inject(Router);

  /** 作成済み Workspace 一覧 */
  protected readonly workspaces = signal<Workspace[]>([]);

  /** 登録済みリポジトリ一覧 */
  protected readonly repositories = signal<Repository[]>([]);

  /** ローディング状態 */
  protected readonly loading = signal(true);

  /** 削除処理中の Workspace ID セット */
  protected readonly deletingIds = signal<Set<string>>(new Set());

  /** Open 処理中の Workspace ID セット */
  protected readonly openingIds = signal<Set<string>>(new Set());

  /** repositoryId → Repository の Map */
  protected readonly repoMap = computed(() => {
    const map = new Map<string, Repository>();
    for (const repo of this.repositories()) {
      map.set(repo.id, repo);
    }
    return map;
  });

  constructor() {
    void this.initialize();
  }

  /** 初期化: Workspace 一覧 + リポジトリ一覧を並行取得 */
  private async initialize(): Promise<void> {
    this.loading.set(true);

    const [wsResult, repoResult] = await Promise.all([
      this.workspaceService.getWorkspaces(),
      this.repoService.getRepositories(),
    ]);

    if (wsResult.success) {
      this.workspaces.set(wsResult.data);
    } else {
      toast.error(wsResult.error.message);
    }

    if (repoResult.success) {
      this.repositories.set(repoResult.data);
    } else {
      toast.error(repoResult.error.message);
    }

    this.loading.set(false);
  }

  /** repositoryId からリポジトリ名を解決する */
  protected getRepoName(repositoryId: string): string {
    return this.repoMap().get(repositoryId)?.name ?? '不明なリポジトリ';
  }

  /** Workspace を VS Code で開く */
  protected async openWorkspace(id: string): Promise<void> {
    this.openingIds.update((ids) => new Set([...ids, id]));

    const result = await this.workspaceService.openWorkspace(id);
    if (result.success) {
      toast.success('VS Code を起動しました');
    } else {
      toast.error(result.error.message);
    }

    this.openingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  /** Workspace を削除する */
  protected async deleteWorkspace(id: string): Promise<void> {
    this.deletingIds.update((ids) => new Set([...ids, id]));

    const result = await this.workspaceService.deleteWorkspace(id);
    if (result.success) {
      this.workspaces.update((ws) => ws.filter((w) => w.id !== id));
      toast.success('Workspace を削除しました');
    } else {
      toast.error(result.error.message);
    }

    this.deletingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  /** Workspace 作成画面に遷移する */
  protected navigateToCreate(): void {
    void this.router.navigate(['/workspaces/new']);
  }

  /** リポジトリ管理画面に遷移する */
  protected navigateToRepos(): void {
    void this.router.navigate(['/repos']);
  }
}
```

**設計ポイント**:

- `constructor` で `initialize()` を呼び出し、画面表示と同時に Workspace 一覧 + リポジトリ一覧を並行取得する
- `Promise.all` で並行取得することで、初期表示のレイテンシを最小化する（パフォーマンス要件: 1 秒以内）
- `repoMap` computed で repositoryId → リポジトリ名の O(1) ルックアップを実現
- 削除成功時は楽観的更新（ローカルのシグナルから即座に削除）で UI の応答性を確保
- `openingIds` / `deletingIds` で個別 Workspace の操作中状態を管理し、二重操作を防止
- Open 操作は `code` コマンドの起動のみのため高速だが、念のためローディング表示を出す

#### `src/app/dashboard/dashboard.html` — Dashboard テンプレート

```html
<div class="mx-auto max-w-6xl p-6">
  <!-- ヘッダー -->
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold">Dashboard</h1>
    <div class="flex gap-2">
      <button hlmBtn variant="outline" (click)="navigateToRepos()">リポジトリ管理</button>
      <button hlmBtn (click)="navigateToCreate()">
        <ng-icon hlm name="lucidePlus" size="sm" class="mr-1" />
        Workspace を作成
      </button>
    </div>
  </div>

  <!-- ローディング -->
  @if (loading()) {
  <div class="flex items-center justify-center gap-2 py-8">
    <hlm-spinner />
    <span class="text-muted-foreground text-sm">読み込み中...</span>
  </div>
  } @else {
  <!-- Workspace 一覧 -->
  @if (workspaces().length === 0) {
  <section hlmCard class="text-center">
    <div hlmCardHeader>
      <h3 hlmCardTitle>Workspace がありません</h3>
      <p hlmCardDescription>「Workspace を作成」ボタンから新しい Workspace を作成してください。</p>
    </div>
  </section>
  } @else {
  <div class="flex flex-col gap-4" role="list">
    @for (ws of workspaces(); track ws.id) {
    <div hlmCard role="listitem" class="p-4">
      <div class="flex items-start justify-between gap-4">
        <!-- Workspace 情報 -->
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-lg font-semibold">{{ ws.name }}</h3>
          <p class="text-muted-foreground mb-3 text-xs">
            作成日: {{ ws.createdAt | date: 'yyyy/MM/dd HH:mm' }}
          </p>

          <!-- リポジトリ × ブランチ構成 -->
          <div class="flex flex-wrap gap-2">
            @for (entry of ws.entries; track entry.repositoryId) {
            <span class="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs">
              <span class="font-medium">{{ getRepoName(entry.repositoryId) }}</span>
              <ng-icon hlm name="lucideGitBranch" size="xs" class="text-muted-foreground" />
              <span class="text-muted-foreground">{{ entry.branch }}</span>
            </span>
            }
          </div>
        </div>

        <!-- アクションボタン -->
        <div class="flex shrink-0 gap-2">
          <button
            hlmBtn
            variant="outline"
            size="sm"
            (click)="openWorkspace(ws.id)"
            [disabled]="openingIds().has(ws.id) || deletingIds().has(ws.id)"
            aria-label="VS Code で開く"
          >
            @if (openingIds().has(ws.id)) {
            <hlm-spinner class="mr-1 text-xs" />
            起動中... } @else {
            <ng-icon hlm name="lucideExternalLink" size="sm" class="mr-1" />
            Open }
          </button>

          <hlm-alert-dialog>
            <button
              hlmAlertDialogTrigger
              hlmBtn
              variant="destructive"
              size="sm"
              [disabled]="deletingIds().has(ws.id) || openingIds().has(ws.id)"
              aria-label="削除"
            >
              @if (deletingIds().has(ws.id)) {
              <hlm-spinner class="text-xs" />
              } @else {
              <ng-icon hlm name="lucideTrash2" size="sm" />
              }
            </button>
            <hlm-alert-dialog-content *hlmAlertDialogPortal="let ctx">
              <hlm-alert-dialog-header>
                <h2 hlmAlertDialogTitle>Workspace を削除しますか？</h2>
                <p hlmAlertDialogDescription>
                  「{{ ws.name }}」を削除すると、関連する Worktree と .code-workspace
                  ファイルがディスクから完全に消去されます。 この操作は取り消せません。
                </p>
              </hlm-alert-dialog-header>
              <hlm-alert-dialog-footer>
                <button hlmAlertDialogCancel (click)="ctx.close()">キャンセル</button>
                <button hlmAlertDialogAction (click)="ctx.close(); deleteWorkspace(ws.id)">
                  削除する
                </button>
              </hlm-alert-dialog-footer>
            </hlm-alert-dialog-content>
          </hlm-alert-dialog>
        </div>
      </div>
    </div>
    }
  </div>
  } }
</div>
```

**テンプレート設計ポイント**:

- Angular 21 の `@if` / `@for` / `@else` 制御フロー構文を使用
- `@for` の `track` に `ws.id` / `entry.repositoryId` を指定し、DOM の再利用を最適化
- Workspace カードはリスト形式（縦並び）で表示。各カードに名前・作成日時・リポジトリ × ブランチ構成・アクションボタンを配置
- リポジトリ × ブランチ構成は `bg-muted` のバッジ（タグ）として表示し、視覚的に構成を把握しやすくする
- `lucideGitBranch` アイコンでブランチ情報を視覚的に区別
- Open ボタンと Delete ボタンは操作中に相互に disabled にし、競合操作を防止
- `hlm-alert-dialog` で削除前の確認ダイアログを表示（AC8 の確認ダイアログ要件に対応）
- 空状態もカードで統一感を持たせ、Workspace 作成への誘導メッセージを表示
- `max-w-6xl` でコンテナ幅を広げ、Workspace 情報を十分に表示できるスペースを確保
- `date` パイプで `createdAt` を `yyyy/MM/dd HH:mm` 形式にフォーマット
- `truncate` で長い Workspace 名がカードからはみ出さないようにする

#### `src/app/app.routes.ts` — ルーティング変更

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.DashboardComponent),
  },
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
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
];
```

**変更内容**:

- `/dashboard` ルートを追加（遅延読み込み）
- デフォルトルートを `/repos` から `/dashboard` に変更
- `/dashboard` をルート定義の先頭に配置（デフォルト画面であることを明示）

#### 既存コンポーネントへの影響

##### WorkspaceCreateComponent

- 作成成功時の遷移先 `router.navigate(['/'])` は変更不要。デフォルトルートが `/dashboard` にリダイレクトされるため、自動的に Dashboard に遷移する
- キャンセル時の遷移先も同様

##### RepoListComponent

- 変更不要。「Workspace を作成」ボタンの遷移先 `/workspaces/new` はそのまま

## 画面遷移

```
/dashboard（Dashboard 画面）— デフォルト画面
  ├─ 「Workspace を作成」ボタン → /workspaces/new
  ├─ 「リポジトリ管理」ボタン → /repos
  ├─ Workspace「Open」ボタン → VS Code 起動（画面遷移なし）
  └─ Workspace「Delete」ボタン → 確認ダイアログ → 削除（画面遷移なし）

/repos（リポジトリ管理画面）
  └─ 「Workspace を作成」ボタン → /workspaces/new

/workspaces/new（Workspace 作成画面）
  ├─ 「作成」成功 → /（→ /dashboard にリダイレクト）
  └─ 「キャンセル」or 戻るボタン → /（→ /dashboard にリダイレクト）
```

## date パイプの使用

Dashboard テンプレートで `createdAt`（ISO 8601 文字列）を表示するために Angular の `DatePipe` を使用する。

```typescript
// dashboard.ts の imports に追加
import { DatePipe } from '@angular/common';

@Component({
  // ...
  imports: [
    DatePipe,
    // ... 他の imports
  ],
})
```

テンプレートでの使用:

```html
{{ ws.createdAt | date: 'yyyy/MM/dd HH:mm' }}
```

**設計ポイント**:

- `DatePipe` はスタンドアロンコンポーネントの `imports` に直接追加する（`CommonModule` の import は不要）
- ISO 8601 文字列を `DatePipe` に渡すと自動的にパースされる

## テスト計画

### テスト環境の方針

- Angular テストは `@angular/build:unit-test` ビルダー経由で Vitest を使用
- `window.electronAPI` はテスト環境に存在しないため、`WorkspaceService` と `RepositoryService` をモックに差し替える
- テスト実行: `pnpm test:ng`

### ユニットテスト

#### DashboardComponent のテスト

テストファイル: `src/app/dashboard/dashboard.spec.ts`

##### 初期化

- [ ] 初期化時に `WorkspaceService.getWorkspaces()` と `RepositoryService.getRepositories()` が並行で呼ばれる
- [ ] Workspace 取得成功時に `workspaces` シグナルが更新される
- [ ] リポジトリ取得成功時に `repositories` シグナルが更新される
- [ ] Workspace 取得失敗時に `toast.error()` が呼ばれる
- [ ] リポジトリ取得失敗時に `toast.error()` が呼ばれる
- [ ] 初期化完了後に `loading` が `false` になる

##### リポジトリ名解決

- [ ] `getRepoName()` が `repoMap` から正しいリポジトリ名を返す
- [ ] 存在しない repositoryId に対して `'不明なリポジトリ'` を返す

##### Workspace Open

- [ ] `openWorkspace()` が `WorkspaceService.openWorkspace()` を正しい ID で呼ぶ
- [ ] Open 成功時に `toast.success()` が呼ばれる
- [ ] Open 失敗時に `toast.error()` が呼ばれる
- [ ] Open 処理中に `openingIds` に ID が追加される
- [ ] Open 完了後に `openingIds` から ID が削除される

##### Workspace Delete

- [ ] `deleteWorkspace()` が `WorkspaceService.deleteWorkspace()` を正しい ID で呼ぶ
- [ ] 削除成功時に `workspaces` シグナルから該当 Workspace が削除される（楽観的更新）
- [ ] 削除成功時に `toast.success()` が呼ばれる
- [ ] 削除失敗時に `toast.error()` が呼ばれる
- [ ] 削除失敗時に `workspaces` シグナルは変更されない
- [ ] 削除処理中に `deletingIds` に ID が追加される
- [ ] 削除完了後に `deletingIds` から ID が削除される

##### ナビゲーション

- [ ] `navigateToCreate()` が `router.navigate(['/workspaces/new'])` を呼ぶ
- [ ] `navigateToRepos()` が `router.navigate(['/repos'])` を呼ぶ

##### 空状態

- [ ] Workspace が 0 件の場合に空状態メッセージが表示される

##### repoMap computed

- [ ] `repoMap` が `repositories` シグナルから正しい Map を生成する
- [ ] `repositories` が空の場合に空の Map を返す

### テストモック戦略

```typescript
// テストデータ
const mockRepos: Repository[] = [
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
];

const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'feature-payment-a3f2b1c9',
    entries: [
      { repositoryId: 'repo-1', branch: 'feature/payment' },
      { repositoryId: 'repo-2', branch: 'main' },
    ],
    createdAt: '2026-02-09T10:00:00.000Z',
    updatedAt: '2026-02-09T10:00:00.000Z',
  },
  {
    id: 'ws-2',
    name: 'hotfix-auth-b4e3c2d1',
    entries: [{ repositoryId: 'repo-1', branch: 'hotfix/auth' }],
    createdAt: '2026-02-09T11:00:00.000Z',
    updatedAt: '2026-02-09T11:00:00.000Z',
  },
];

// WorkspaceService のモック
const mockWorkspaceService = {
  getWorkspaces: vi.fn().mockResolvedValue({
    success: true,
    data: mockWorkspaces,
  }),
  deleteWorkspace: vi.fn().mockResolvedValue({ success: true, data: null }),
  openWorkspace: vi.fn().mockResolvedValue({ success: true, data: null }),
  createWorkspace: vi.fn(),
};

// RepositoryService のモック
const mockRepoService = {
  getRepositories: vi.fn().mockResolvedValue({
    success: true,
    data: mockRepos,
  }),
  addRepository: vi.fn(),
  removeRepository: vi.fn(),
  getRemoteBranches: vi.fn(),
  fetchRepository: vi.fn(),
};

// Router のモック
const mockRouter = {
  navigate: vi.fn().mockResolvedValue(true),
};

// TestBed 設定
TestBed.configureTestingModule({
  imports: [DashboardComponent],
  providers: [
    { provide: WorkspaceService, useValue: mockWorkspaceService },
    { provide: RepositoryService, useValue: mockRepoService },
    { provide: Router, useValue: mockRouter },
  ],
});
```

## 非機能要件

### パフォーマンス

- Dashboard 初期表示: 1 秒以内（AC6 のパフォーマンス要件）
  - `Promise.all` で Workspace 一覧 + リポジトリ一覧を並行取得し、レイテンシを最小化
  - IPC 通信のオーバーヘッドは < 1ms、JSON ファイル読み込みも < 10ms のため、要件を十分に満たせる
  - `loadComponent` による遅延読み込みで、初期バンドルサイズへの影響を最小化
- `repoMap` computed で repositoryId → リポジトリ名の解決を O(1) に最適化（Workspace 数 × エントリ数の繰り返しルックアップを回避）
- 削除成功時の楽観的更新で、再取得の IPC 通信を省略

### セキュリティ

- `window.electronAPI` 経由の IPC 通信のみを使用し、レンダラーから直接 Node.js API にアクセスしない
- テンプレート内の `{{ }}` バインディングは Angular が自動的に HTML エスケープするため、XSS リスクなし
- 削除操作は `hlm-alert-dialog` による確認ダイアログを必須とし、誤操作を防止

### アクセシビリティ

- `role="list"` / `role="listitem"` による Workspace 一覧のセマンティクス
- `hlm-alert-dialog` による削除確認のモーダルダイアログ（フォーカストラップ・ESC キー閉じ対応）
- `aria-label` による Open・Delete ボタンのスクリーンリーダー対応
- `disabled` 属性による操作不可状態の明示（操作中のボタンを disabled にする）
- `hlm-spinner` の `aria-label="Loading"` によるスクリーンリーダー対応
- Sonner トーストは `role="status"` + `aria-live="polite"` でスクリーンリーダーに通知される

### 監視・ログ

- 本 Unit ではロガーは導入しない
- IPC エラーは `IpcResult.error.message` をそのまま `toast.error()` で UI に表示する
- Open / Delete 操作の成功は `toast.success()` でフィードバックする

## 受入条件との対応

| 受入条件                                          | 対応内容                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| AC6: Dashboard で Workspace 一覧を確認できる      | `WorkspaceService.getWorkspaces()` で一覧取得し、名前・リポジトリ・ブランチ構成を表示 |
| AC7: 既存 Workspace を再度開ける                  | Open ボタンで `WorkspaceService.openWorkspace()` を呼び出し、VS Code を起動           |
| AC8: Workspace を削除しディスクからも消去できる   | Delete ボタン → 確認ダイアログ → `WorkspaceService.deleteWorkspace()` で完全消去      |
| AC10: アプリ再起動後も Workspace 設定が保持される | `~/.squad/config/workspaces.json` から読み込むため、再起動後も一覧に表示される        |
| パフォーマンス: Dashboard 初期表示 1 秒以内       | `Promise.all` による並行取得 + 遅延読み込みで達成                                     |

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2026-02-09 | 初版作成 |
