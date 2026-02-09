# Design: repo_management

## 概要

リポジトリ管理画面の Angular コンポーネントとサービスを実装する。リポジトリの追加（URL 入力 → Bare Repository クローン）と登録済みリポジトリの一覧表示機能を提供する。

Angular 21 のスタンドアロンコンポーネント・シグナル・ゾーンレス変更検知を活用し、`window.electronAPI` 経由の IPC 通信でメインプロセスと連携する。UI は spartan-ng/helm コンポーネントと Tailwind CSS 4 で構築する。

## ドメインモデル

### Angular サービス

#### RepositoryService

- **責務**: `window.electronAPI` のリポジトリ関連メソッドをラップし、Angular コンポーネントに IPC 通信を抽象化して提供する
- **設計方針**:
  - `Injectable({ providedIn: 'root' })` でシングルトン提供
  - 全メソッドは `IpcResult<T>` を返す `Promise` ベース（IPC 通信の性質上、Observable ではなく Promise が自然）
  - エラーハンドリングはコンポーネント側に委譲（サービスは IPC 結果をそのまま返す）

```typescript
@Injectable({ providedIn: 'root' })
export class RepositoryService {
  /** 登録済みリポジトリ一覧を取得する */
  getRepositories(): Promise<IpcResult<Repository[]>>;

  /** リモート URL を指定してリポジトリを登録する */
  addRepository(remoteUrl: string): Promise<IpcResult<Repository>>;

  /** 指定 ID のリポジトリを削除する */
  removeRepository(id: string): Promise<IpcResult<null>>;

  /** 指定リポジトリのリモートブランチ一覧を取得する */
  getRemoteBranches(repositoryId: string): Promise<IpcResult<string[]>>;

  /** 指定リポジトリのリモート情報を最新に更新する */
  fetchRepository(repositoryId: string): Promise<IpcResult<null>>;
}
```

**設計ポイント**:

- `window.electronAPI` への直接アクセスをサービスに集約することで、テスト時のモック差し替えが容易になる
- 将来的に Electron 以外の環境（Web 版等）に対応する場合、このサービスの実装を差し替えるだけで済む
- `IpcResult<T>` をそのまま返すことで、コンポーネント側で `success` / `error` の分岐を明示的に行える

### コンポーネント

#### RepoListComponent

- **責務**: 登録済みリポジトリの一覧表示と、リポジトリ追加・削除の操作 UI を提供する
- **ルート**: `/repos`
- **状態管理**: Angular Signals で管理

```typescript
@Component({
  selector: 'app-repo-list',
  standalone: true,
  // ...
})
export class RepoListComponent {
  /** 登録済みリポジトリ一覧 */
  repositories: Signal<Repository[]>;

  /** ローディング状態 */
  loading: Signal<boolean>;

  /** エラーメッセージ */
  error: Signal<string | null>;

  /** リポジトリ追加フォームの表示状態 */
  showAddForm: Signal<boolean>;
}
```

#### RepoAddFormComponent

- **責務**: リポジトリ追加フォーム（URL 入力 + バリデーション + 送信）を提供する
- **入出力**:
  - Output: `submitted` — 登録成功時に `Repository` を emit
  - Output: `cancelled` — キャンセル時に emit
- **状態管理**: Angular Signals で管理

```typescript
@Component({
  selector: 'app-repo-add-form',
  standalone: true,
  // ...
})
export class RepoAddFormComponent {
  /** URL 入力値 */
  remoteUrl: WritableSignal<string>;

  /** 送信中フラグ（クローン処理中） */
  submitting: Signal<boolean>;

  /** バリデーションエラーまたは IPC エラーメッセージ */
  errorMessage: Signal<string | null>;

  /** フォーム送信イベント */
  submitted = output<Repository>();

  /** キャンセルイベント */
  cancelled = output<void>();
}
```

## API 仕様

本 Unit は新たな IPC チャネルを追加しない。Unit 3（ipc_bridge）で定義済みの以下のチャネルを Angular 側から利用する:

| 使用チャネル  | 用途               | 呼び出し元           |
| ------------- | ------------------ | -------------------- |
| `repo:list`   | リポジトリ一覧取得 | RepoListComponent    |
| `repo:add`    | リポジトリ登録     | RepoAddFormComponent |
| `repo:remove` | リポジトリ削除     | RepoListComponent    |

### フロントエンドバリデーション

`RepoAddFormComponent` で送信前に実施するクライアントサイドバリデーション:

| ルール   | 条件                                                | エラーメッセージ                               |
| -------- | --------------------------------------------------- | ---------------------------------------------- |
| 必須     | `remoteUrl` が空文字またはホワイトスペースのみ      | `リポジトリURLを入力してください`              |
| URL 形式 | HTTPS (`https://`) または SSH (`git@`) で始まらない | `HTTPS または SSH 形式のURLを入力してください` |

**設計ポイント**:

- 厳密な URL バリデーションはメインプロセス側（`git-validation.ts`）で実施済みのため、フロントエンドでは最低限の形式チェックのみ行う
- メインプロセスから返される `VALIDATION_ERROR` はそのままユーザーに表示する

## 使用する spartan-ng コンポーネント

| コンポーネント | import                        | 用途                                            |
| -------------- | ----------------------------- | ----------------------------------------------- |
| Button         | `HlmButtonImports`            | 追加・削除・キャンセルボタン                    |
| Card           | `HlmCardImports`              | リポジトリ行、追加フォーム、空状態の表示        |
| Alert          | `HlmAlertImports`             | エラーメッセージ表示（destructive variant）     |
| Alert Dialog   | `HlmAlertDialogImports`       | 削除確認ダイアログ                              |
| Field          | `HlmFieldImports`             | フォームフィールド構造（label + input + error） |
| Input          | `HlmInputImports`             | URL テキスト入力                                |
| Spinner        | `HlmSpinnerImports`           | ローディング・送信中表示                        |
| Icon           | `HlmIconComponent` + `NgIcon` | Lucide アイコン（Plus, Trash2, TriangleAlert）  |

### インストール（未インストールの場合）

```bash
ng g @spartan-ng/cli:ui card
ng g @spartan-ng/cli:ui alert
ng g @spartan-ng/cli:ui alert-dialog
ng g @spartan-ng/cli:ui field
ng g @spartan-ng/cli:ui input
ng g @spartan-ng/cli:ui spinner
ng g @spartan-ng/cli:ui icon
```

`button` と `utils` は既にインストール済み。

### Lucide アイコン

`@ng-icons/lucide` から以下のアイコンを使用:

- `lucidePlus` — 追加ボタン
- `lucideTrash2` — 削除ボタン
- `lucideTriangleAlert` — エラーアラート

`provideIcons()` でコンポーネントレベルに登録する。

## コンポーネント構成

```
src/
├── app/
│   ├── app.routes.ts                          # 変更: /repos ルート追加
│   ├── app.html                               # 変更: router-outlet 追加
│   ├── app.ts                                 # 変更: RouterOutlet import
│   ├── repos/
│   │   ├── repo-list.ts                       # リポジトリ一覧画面コンポーネント
│   │   ├── repo-list.html                     # テンプレート
│   │   ├── repo-list.spec.ts                  # ユニットテスト
│   │   ├── repo-add-form.ts                   # リポジトリ追加フォームコンポーネント
│   │   ├── repo-add-form.html                 # テンプレート
│   │   └── repo-add-form.spec.ts              # ユニットテスト
│   └── services/
│       ├── repository.service.ts              # リポジトリ IPC サービス
│       └── repository.service.spec.ts         # ユニットテスト
```

### ファイル詳細

#### `src/app/services/repository.service.ts` — リポジトリ IPC サービス

```typescript
import { Injectable } from '@angular/core';
import type { Repository } from '../../../electron/types/models';
import type { IpcResult } from '../../../electron/types/ipc-result';

@Injectable({ providedIn: 'root' })
export class RepositoryService {
  getRepositories(): Promise<IpcResult<Repository[]>> {
    return window.electronAPI.getRepositories();
  }

  addRepository(remoteUrl: string): Promise<IpcResult<Repository>> {
    return window.electronAPI.addRepository(remoteUrl);
  }

  removeRepository(id: string): Promise<IpcResult<null>> {
    return window.electronAPI.removeRepository(id);
  }

  getRemoteBranches(repositoryId: string): Promise<IpcResult<string[]>> {
    return window.electronAPI.getRemoteBranches(repositoryId);
  }

  fetchRepository(repositoryId: string): Promise<IpcResult<null>> {
    return window.electronAPI.fetchRepository(repositoryId);
  }
}
```

**設計ポイント**:

- 型は `electron/types/` から直接 import する（`tsconfig.app.json` の `include` に `electron/types/**/*.ts` が含まれているため）
- 各メソッドは `window.electronAPI` の対応メソッドを単純に委譲する薄いラッパー
- テスト時は `TestBed.overrideProvider` でモックに差し替え可能

#### `src/app/repos/repo-list.ts` — リポジトリ一覧画面

```typescript
@Component({
  selector: 'app-repo-list',
  standalone: true,
  templateUrl: './repo-list.html',
  imports: [
    RepoAddFormComponent,
    HlmButtonImports,
    HlmCardImports,
    HlmAlertImports,
    HlmAlertDialogImports,
    HlmSpinnerImports,
    HlmIconComponent,
    NgIcon,
  ],
  providers: [provideIcons({ lucideTrash2, lucidePlus, lucideTriangleAlert })],
})
export class RepoListComponent implements OnInit {
  private readonly repoService = inject(RepositoryService);

  /** 登録済みリポジトリ一覧 */
  protected readonly repositories = signal<Repository[]>([]);

  /** ローディング状態 */
  protected readonly loading = signal(true);

  /** エラーメッセージ */
  protected readonly error = signal<string | null>(null);

  /** 追加フォーム表示フラグ */
  protected readonly showAddForm = signal(false);

  /** 削除処理中のリポジトリ ID セット */
  protected readonly deletingIds = signal<Set<string>>(new Set());

  async ngOnInit(): Promise<void> {
    await this.loadRepositories();
  }

  /** リポジトリ一覧を読み込む */
  protected async loadRepositories(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.repoService.getRepositories();
    if (result.success) {
      this.repositories.set(result.data);
    } else {
      this.error.set(result.error.message);
    }
    this.loading.set(false);
  }

  /** リポジトリ追加成功時のハンドラー */
  protected onRepoAdded(repo: Repository): void {
    this.repositories.update((repos) => [...repos, repo]);
    this.showAddForm.set(false);
  }

  /** リポジトリ削除 */
  protected async removeRepository(id: string): Promise<void> {
    this.deletingIds.update((ids) => new Set([...ids, id]));

    const result = await this.repoService.removeRepository(id);
    if (result.success) {
      this.repositories.update((repos) => repos.filter((r) => r.id !== id));
    } else {
      this.error.set(result.error.message);
    }

    this.deletingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }
}
```

**設計ポイント**:

- `ngOnInit` で初期データを読み込む。ゾーンレス環境のため、`async/await` 後のシグナル更新で自動的にビューが更新される
- リポジトリ追加成功時はローカルのシグナルに追加するだけで、再度 `repo:list` を呼ばない（楽観的更新）
- 削除中のリポジトリ ID を `deletingIds` で管理し、UI 上でローディング表示を出す
- `OnInit` ライフサイクルフックを使用（`constructor` での非同期処理は避ける）

#### `src/app/repos/repo-list.html` — リポジトリ一覧テンプレート

```html
<div class="mx-auto max-w-2xl p-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold">リポジトリ</h1>
    <button hlmBtn (click)="showAddForm.set(!showAddForm())">
      @if (showAddForm()) { キャンセル } @else {
      <ng-icon hlm name="lucidePlus" size="sm" class="mr-1" />
      追加 }
    </button>
  </div>

  <!-- 追加フォーム -->
  @if (showAddForm()) {
  <app-repo-add-form (submitted)="onRepoAdded($event)" (cancelled)="showAddForm.set(false)" />
  }

  <!-- エラー表示 -->
  @if (error()) {
  <div hlmAlert variant="destructive" class="mb-4">
    <ng-icon hlm hlmAlertIcon name="lucideTriangleAlert" />
    <h4 hlmAlertTitle>エラー</h4>
    <div hlmAlertDescription>{{ error() }}</div>
  </div>
  }

  <!-- ローディング -->
  @if (loading()) {
  <div class="flex items-center justify-center gap-2 py-8">
    <hlm-spinner />
    <span class="text-muted-foreground text-sm">読み込み中...</span>
  </div>
  } @else {
  <!-- リポジトリ一覧 -->
  @if (repositories().length === 0) {
  <section hlmCard class="text-center">
    <div hlmCardHeader>
      <h3 hlmCardTitle>リポジトリが登録されていません</h3>
      <p hlmCardDescription>「追加」ボタンからリポジトリを登録してください。</p>
    </div>
  </section>
  } @else {
  <ul class="space-y-3" role="list">
    @for (repo of repositories(); track repo.id) {
    <li hlmCard>
      <div class="flex items-center justify-between p-4">
        <div class="min-w-0 flex-1">
          <p class="font-medium">{{ repo.name }}</p>
          <p class="text-muted-foreground truncate text-sm">{{ repo.remoteUrl }}</p>
        </div>
        <!-- 削除確認ダイアログ -->
        <hlm-alert-dialog>
          <button
            hlmAlertDialogTrigger
            hlmBtn
            variant="destructive"
            size="sm"
            [disabled]="deletingIds().has(repo.id)"
          >
            @if (deletingIds().has(repo.id)) {
            <hlm-spinner class="mr-1 text-xs" />
            削除中... } @else {
            <ng-icon hlm name="lucideTrash2" size="sm" class="mr-1" />
            削除 }
          </button>
          <hlm-alert-dialog-content *hlmAlertDialogPortal="let ctx">
            <hlm-alert-dialog-header>
              <h2 hlmAlertDialogTitle>リポジトリを削除しますか？</h2>
              <p hlmAlertDialogDescription>
                「{{ repo.name }}」を削除すると、Bare Repository
                がディスクから完全に消去されます。この操作は取り消せません。
              </p>
            </hlm-alert-dialog-header>
            <hlm-alert-dialog-footer>
              <button hlmAlertDialogCancel (click)="ctx.close()">キャンセル</button>
              <button hlmAlertDialogAction (click)="ctx.close(); removeRepository(repo.id)">
                削除する
              </button>
            </hlm-alert-dialog-footer>
          </hlm-alert-dialog-content>
        </hlm-alert-dialog>
      </div>
    </li>
    }
  </ul>
  } }
</div>
```

**設計ポイント**:

- Angular 21 の `@if` / `@for` 制御フロー構文を使用（`*ngIf` / `*ngFor` は使わない）
- `@for` の `track` に `repo.id` を指定し、DOM の再利用を最適化
- `hlmCard` でリポジトリ各行をカードとして表示し、空状態もカードで統一感を持たせる
- `hlmAlert` + `variant="destructive"` でエラー表示（アイコン・タイトル・説明の構造化）
- `hlm-alert-dialog` で削除前の確認ダイアログを表示（誤操作防止、AC8 の確認ダイアログ要件に対応）
- `hlm-spinner` でローディング中・削除中のフィードバックを提供
- `ng-icon` + `hlm` で Lucide アイコン（`lucidePlus`, `lucideTrash2`, `lucideTriangleAlert`）を使用
- 削除ボタンは `deletingIds` で disabled 制御し、二重クリックを防止

#### `src/app/repos/repo-add-form.ts` — リポジトリ追加フォーム

```typescript
@Component({
  selector: 'app-repo-add-form',
  standalone: true,
  templateUrl: './repo-add-form.html',
  imports: [HlmButtonImports, HlmCardImports, HlmFieldImports, HlmInputImports, HlmSpinnerImports],
})
export class RepoAddFormComponent {
  private readonly repoService = inject(RepositoryService);

  /** URL 入力値 */
  protected readonly remoteUrl = signal('');

  /** 送信中フラグ */
  protected readonly submitting = signal(false);

  /** エラーメッセージ */
  protected readonly errorMessage = signal<string | null>(null);

  /** フォーム送信イベント */
  readonly submitted = output<Repository>();

  /** キャンセルイベント */
  readonly cancelled = output<void>();

  /** クライアントサイドバリデーション */
  private validate(): string | null {
    const url = this.remoteUrl().trim();
    if (url.length === 0) {
      return 'リポジトリURLを入力してください';
    }
    if (!url.startsWith('https://') && !url.startsWith('git@')) {
      return 'HTTPS または SSH 形式のURLを入力してください';
    }
    return null;
  }

  /** フォーム送信 */
  protected async onSubmit(): Promise<void> {
    this.errorMessage.set(null);

    const validationError = this.validate();
    if (validationError) {
      this.errorMessage.set(validationError);
      return;
    }

    this.submitting.set(true);

    const result = await this.repoService.addRepository(this.remoteUrl().trim());
    if (result.success) {
      this.remoteUrl.set('');
      this.submitted.emit(result.data);
    } else {
      this.errorMessage.set(result.error.message);
    }

    this.submitting.set(false);
  }
}
```

**設計ポイント**:

- `output<T>()` は Angular 21 の新しい output API を使用
- バリデーションは `validate()` プライベートメソッドに集約し、テスト容易性を確保
- 送信成功時に `remoteUrl` をリセットし、`submitted` イベントで親コンポーネントに通知
- `submitting` フラグで送信ボタンを disabled にし、クローン処理中の二重送信を防止

#### `src/app/repos/repo-add-form.html` — 追加フォームテンプレート

```html
<section hlmCard class="mb-6">
  <form (submit)="onSubmit(); $event.preventDefault()">
    <div hlmCardHeader>
      <h3 hlmCardTitle>リポジトリを追加</h3>
      <p hlmCardDescription>
        リモートリポジトリの URL を入力してください。HTTPS と SSH 形式に対応しています。
      </p>
    </div>
    <div hlmCardContent>
      <div hlmField [attr.data-invalid]="errorMessage() ? true : null">
        <label hlmFieldLabel for="remote-url">リポジトリ URL</label>
        <input
          hlmInput
          id="remote-url"
          type="text"
          placeholder="https://github.com/org/repo.git"
          [value]="remoteUrl()"
          (input)="remoteUrl.set($any($event.target).value)"
          [disabled]="submitting()"
          [attr.aria-invalid]="errorMessage() ? true : null"
          autocomplete="url"
        />
        @if (errorMessage()) {
        <hlm-field-error>{{ errorMessage() }}</hlm-field-error>
        }
      </div>
    </div>
    <div hlmCardFooter class="flex gap-2">
      <button hlmBtn type="submit" [disabled]="submitting()">
        @if (submitting()) {
        <hlm-spinner class="mr-1 text-xs" />
        クローン中... } @else { 登録 }
      </button>
      <button
        hlmBtn
        variant="outline"
        type="button"
        [disabled]="submitting()"
        (click)="cancelled.emit()"
      >
        キャンセル
      </button>
    </div>
  </form>
</section>
```

**設計ポイント**:

- `hlmCard` + `hlmCardHeader` / `hlmCardContent` / `hlmCardFooter` でフォーム全体を構造化
- `hlmField` + `hlmFieldLabel` + `hlmInput` + `hlm-field-error` で spartan-ng のフォームフィールドパターンを使用
- `data-invalid` 属性で `hlmField` をエラー状態に切り替え、`aria-invalid` でアクセシビリティを確保
- `hlm-spinner` で送信中のフィードバックをボタン内に表示
- `<form>` タグで囲み、Enter キーでの送信に対応
- `$event.preventDefault()` でフォームのデフォルト送信を抑止
- `autocomplete="url"` でブラウザの URL 補完を有効化
- シグナルベースの双方向バインディング: `[value]` + `(input)` で実現（`FormsModule` / `ReactiveFormsModule` は不使用）

#### `src/app/app.routes.ts` — ルーティング変更

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'repos',
    loadComponent: () => import('./repos/repo-list').then((m) => m.RepoListComponent),
  },
  {
    path: '',
    redirectTo: 'repos',
    pathMatch: 'full',
  },
];
```

**設計ポイント**:

- `loadComponent` による遅延読み込みで初期バンドルサイズを最適化
- 現時点ではデフォルトルートを `/repos` にリダイレクト（Unit 6 で Dashboard 実装後に変更予定）
- Unit 5（workspace_create）、Unit 6（dashboard）のルートは各 Unit で追加する

#### `src/app/app.ts` — ルートコンポーネント変更

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [RouterOutlet],
})
export class App {}
```

**変更内容**:

- `HlmButtonImports` の import を削除（テスト用コードの除去）
- `RouterOutlet` を import に追加
- テスト用の `title`, `message` シグナルと `testIPC()` メソッドを削除

#### `src/app/app.html` — ルートテンプレート変更

```html
<router-outlet />
```

**変更内容**:

- テスト用の UI を削除し、`<router-outlet />` のみに変更
- 全ての画面コンテンツはルーティングされたコンポーネントが描画する

## ルーティング設計

```
/repos          → RepoListComponent（リポジトリ管理画面）
/               → /repos にリダイレクト（暫定。Unit 6 で /dashboard に変更予定）
```

**将来のルート拡張（他 Unit で追加）**:

```
/dashboard      → DashboardComponent（Unit 6）
/workspaces/new → WorkspaceCreateComponent（Unit 5）
```

## テスト計画

### テスト環境の方針

- Angular テストは `@angular/build:unit-test` ビルダー経由で Vitest を使用
- `window.electronAPI` はテスト環境に存在しないため、`RepositoryService` をモックに差し替える
- テスト実行: `pnpm test:ng`

### ユニットテスト

#### RepositoryService のテスト

テストファイル: `src/app/services/repository.service.spec.ts`

- [ ] `getRepositories()` が `window.electronAPI.getRepositories()` を呼び出す
- [ ] `addRepository(url)` が `window.electronAPI.addRepository(url)` を呼び出す
- [ ] `removeRepository(id)` が `window.electronAPI.removeRepository(id)` を呼び出す
- [ ] `getRemoteBranches(id)` が `window.electronAPI.getRemoteBranches(id)` を呼び出す
- [ ] `fetchRepository(id)` が `window.electronAPI.fetchRepository(id)` を呼び出す

**テスト方針**: `window.electronAPI` をグローバルモックとして設定し、各メソッドの委譲が正しく行われることを検証する。

#### RepoListComponent のテスト

テストファイル: `src/app/repos/repo-list.spec.ts`

- [ ] 初期表示時に `RepositoryService.getRepositories()` が呼ばれる
- [ ] 取得成功時にリポジトリ一覧が表示される（名前・URL）
- [ ] 取得失敗時にエラーメッセージが表示される
- [ ] リポジトリが0件の場合に空状態メッセージが表示される
- [ ] 「追加」ボタンクリックで `RepoAddFormComponent` が表示される
- [ ] 「キャンセル」ボタンクリックで追加フォームが非表示になる
- [ ] 削除ボタンクリックで確認ダイアログが表示される
- [ ] 確認ダイアログで「削除する」をクリックすると `RepositoryService.removeRepository()` が呼ばれる
- [ ] 確認ダイアログで「キャンセル」をクリックするとダイアログが閉じ、削除されない
- [ ] 削除成功時にリポジトリが一覧から消える
- [ ] 削除失敗時にエラーメッセージが表示される
- [ ] 削除中はボタンが disabled になり「削除中...」と表示される
- [ ] ローディング中に「読み込み中...」が表示される

#### RepoAddFormComponent のテスト

テストファイル: `src/app/repos/repo-add-form.spec.ts`

- [ ] 空の URL で送信するとバリデーションエラーが表示される
- [ ] 不正な形式の URL で送信するとバリデーションエラーが表示される
- [ ] 有効な HTTPS URL で送信すると `RepositoryService.addRepository()` が呼ばれる
- [ ] 有効な SSH URL（`git@`）で送信すると `RepositoryService.addRepository()` が呼ばれる
- [ ] 登録成功時に `submitted` イベントが emit される
- [ ] 登録成功時に URL 入力がクリアされる
- [ ] 登録失敗時（`VALIDATION_ERROR`）にエラーメッセージが表示される
- [ ] 登録失敗時（`REPOSITORY_EXISTS`）にエラーメッセージが表示される
- [ ] 送信中はボタンが disabled になり「クローン中...」と表示される
- [ ] キャンセルボタンクリックで `cancelled` イベントが emit される

### テストモック戦略

```typescript
// RepositoryService のモック例
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
    ],
  }),
  addRepository: vi.fn(),
  removeRepository: vi.fn(),
  getRemoteBranches: vi.fn(),
  fetchRepository: vi.fn(),
};

// TestBed 設定
TestBed.configureTestingModule({
  imports: [RepoListComponent],
  providers: [{ provide: RepositoryService, useValue: mockRepoService }],
});
```

## 非機能要件

### パフォーマンス

- リポジトリ一覧の初期表示: IPC 通信のオーバーヘッドは < 1ms のため、JSON ファイル読み込み含めて即座に表示される
- `loadComponent` による遅延読み込みで、初期バンドルサイズへの影響を最小化
- クローン処理（`repo:add`）はネットワーク I/O を伴うため数秒〜数十秒かかる可能性がある。`submitting` フラグで UI フィードバックを提供する

### セキュリティ

- `window.electronAPI` 経由の IPC 通信のみを使用し、レンダラーから直接 Node.js API にアクセスしない
- URL 入力のサニタイズはメインプロセス側（`git-validation.ts`）で実施。フロントエンドでは形式チェックのみ
- テンプレート内の `{{ }}` バインディングは Angular が自動的に HTML エスケープするため、XSS リスクなし

### アクセシビリティ

- `hlmField` + `hlmFieldLabel` による `role="group"` 出力とラベル紐付け
- `hlm-field-error` によるバリデーションエラーのアクセシブルな通知
- `data-invalid` + `aria-invalid` によるエラー状態の明示
- `hlm-alert-dialog` による削除確認のモーダルダイアログ（フォーカストラップ・ESC キー閉じ対応）
- `hlmAlertIcon` によるアラートアイコンのアクセシブルな表示
- `hlm-spinner` の `aria-label="Loading"` によるスクリーンリーダー対応
- `disabled` 属性による操作不可状態の明示
- キーボード操作: `<form>` + `<button type="submit">` で Enter キー送信に対応

### 監視・ログ

- 本 Unit ではロガーは導入しない
- IPC エラーは `IpcResult.error.message` をそのまま UI に表示する
- 将来的にエラートラッキングサービスを導入する場合、`RepositoryService` にインターセプターを追加する拡張ポイントとして認識

## 更新履歴

| 日付       | 内容                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| 2026-02-09 | 初版作成                                                                                      |
| 2026-02-09 | spartan-ng コンポーネント活用に変更（card, alert, alert-dialog, field, input, spinner, icon） |
