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
  imports: [RepoAddFormComponent, HlmButtonImports],
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
      @if (showAddForm()) { キャンセル } @else { 追加 }
    </button>
  </div>

  <!-- 追加フォーム -->
  @if (showAddForm()) {
  <app-repo-add-form (submitted)="onRepoAdded($event)" (cancelled)="showAddForm.set(false)" />
  }

  <!-- エラー表示 -->
  @if (error()) {
  <div
    class="border-destructive/50 bg-destructive/10 text-destructive mb-4 rounded-md border p-3 text-sm"
  >
    {{ error() }}
  </div>
  }

  <!-- ローディング -->
  @if (loading()) {
  <p class="text-muted-foreground">読み込み中...</p>
  } @else {
  <!-- リポジトリ一覧 -->
  @if (repositories().length === 0) {
  <p class="text-muted-foreground">
    リポジトリが登録されていません。「追加」ボタンからリポジトリを登録してください。
  </p>
  } @else {
  <ul class="space-y-3" role="list">
    @for (repo of repositories(); track repo.id) {
    <li class="border-border flex items-center justify-between rounded-lg border p-4">
      <div class="min-w-0 flex-1">
        <p class="font-medium">{{ repo.name }}</p>
        <p class="text-muted-foreground truncate text-sm">{{ repo.remoteUrl }}</p>
      </div>
      <button
        hlmBtn
        variant="destructive"
        size="sm"
        [disabled]="deletingIds().has(repo.id)"
        (click)="removeRepository(repo.id)"
      >
        @if (deletingIds().has(repo.id)) { 削除中... } @else { 削除 }
      </button>
    </li>
    }
  </ul>
  } }
</div>
```

**設計ポイント**:

- Angular 21 の `@if` / `@for` 制御フロー構文を使用（`*ngIf` / `*ngFor` は使わない）
- `@for` の `track` に `repo.id` を指定し、DOM の再利用を最適化
- Tailwind CSS のユーティリティクラスで oklch テーマ変数（`text-muted-foreground`, `border-border` 等）を使用
- `role="list"` でアクセシビリティを確保
- 削除ボタンは `deletingIds` で disabled 制御し、二重クリックを防止

#### `src/app/repos/repo-add-form.ts` — リポジトリ追加フォーム

```typescript
@Component({
  selector: 'app-repo-add-form',
  standalone: true,
  templateUrl: './repo-add-form.html',
  imports: [HlmButtonImports],
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
<form
  class="border-border mb-6 rounded-lg border p-4"
  (submit)="onSubmit(); $event.preventDefault()"
>
  <div class="mb-3">
    <label for="remote-url" class="mb-1 block text-sm font-medium"> リポジトリ URL </label>
    <input
      id="remote-url"
      type="text"
      class="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
      placeholder="https://github.com/org/repo.git"
      [value]="remoteUrl()"
      (input)="remoteUrl.set($any($event.target).value)"
      [disabled]="submitting()"
      autocomplete="url"
    />
  </div>

  <!-- エラー表示 -->
  @if (errorMessage()) {
  <p class="text-destructive mb-3 text-sm" role="alert">{{ errorMessage() }}</p>
  }

  <div class="flex gap-2">
    <button hlmBtn type="submit" [disabled]="submitting()">
      @if (submitting()) { クローン中... } @else { 登録 }
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
```

**設計ポイント**:

- `<form>` タグで囲み、Enter キーでの送信に対応
- `$event.preventDefault()` でフォームのデフォルト送信を抑止
- `<label>` と `for` / `id` の紐付けでアクセシビリティを確保
- `role="alert"` でエラーメッセージをスクリーンリーダーに通知
- `autocomplete="url"` でブラウザの URL 補完を有効化
- `placeholder` で入力例を提示
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
- [ ] 削除ボタンクリックで `RepositoryService.removeRepository()` が呼ばれる
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

- `<label>` と `for` / `id` の紐付けによるフォームアクセシビリティ
- `role="alert"` によるエラーメッセージのスクリーンリーダー通知
- `role="list"` によるリスト構造の明示
- `disabled` 属性による操作不可状態の明示
- キーボード操作: `<form>` + `<button type="submit">` で Enter キー送信に対応

### 監視・ログ

- 本 Unit ではロガーは導入しない
- IPC エラーは `IpcResult.error.message` をそのまま UI に表示する
- 将来的にエラートラッキングサービスを導入する場合、`RepositoryService` にインターセプターを追加する拡張ポイントとして認識

## 更新履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2026-02-09 | 初版作成 |
