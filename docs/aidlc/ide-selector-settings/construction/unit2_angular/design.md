# Functional Design: Unit 2 — 設定 UI（Angular）

## 概要

Angular フロントエンド側に設定画面を追加する。`@spartan-ng/helm/select` を使った IDE 選択 UI、
IDE 検出状態のリアルタイム表示、選択時の即時自動保存、サイドバーナビゲーション、ルーティングを実装する。

## Module 一覧

- [ ] Module 1: Settings Page
- [ ] Module 2: Routing
- [ ] Module 3: Navigation
- [ ] Module 4: i18n

---

## Module 1: Settings Page

### ファイル

| ファイル                         | 種別     |
| -------------------------------- | -------- |
| `src/app/settings/settings.ts`   | 新規作成 |
| `src/app/settings/settings.html` | 新規作成 |

### コンポーネント設計

```typescript
@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.html',
  imports: [
    TranslocoDirective,
    BrnSelectImports,
    HlmSelectImports,
    HlmSpinnerImports,
    HlmIconImports,
  ],
  providers: [provideIcons({ lucideSettings })],
})
export class SettingsComponent {
  /** IDE 検出結果の配列 */
  protected readonly ideOptions = signal<IdeDetectionResult[]>([]);

  /** 現在選択されている IDE の ID */
  protected readonly selectedIdeId = signal<IdeId>('vscode');

  /** IDE 検出中フラグ */
  protected readonly detectingIdes = signal(true);

  /** 設定保存中フラグ */
  protected readonly saving = signal(false);
}
```

### 状態管理フロー

```
1. コンポーネント初期化
   ├─ window.electronAPI.getSettings() → selectedIdeId を設定
   └─ window.electronAPI.detectIdes()  → ideOptions を設定、detectingIdes = false

2. IDE 選択変更時（valueChange イベント）
   ├─ selectedIdeId を即座に更新
   ├─ saving = true
   ├─ window.electronAPI.updateSettings({ selectedIde: newValue })
   ├─ 成功 → toast.success()
   ├─ 失敗 → toast.error()、selectedIdeId を元の値に戻す
   └─ saving = false
```

### 初期化ロジック

```typescript
constructor() {
  void this.initialize();
}

private async initialize(): Promise<void> {
  // 設定取得と IDE 検出を並列実行
  const [settingsResult, idesResult] = await Promise.all([
    window.electronAPI.getSettings(),
    window.electronAPI.detectIdes(),
  ]);

  if (settingsResult.success) {
    this.selectedIdeId.set(settingsResult.data.selectedIde);
  } else {
    toast.error(settingsResult.error.message);
  }

  if (idesResult.success) {
    this.ideOptions.set(idesResult.data);
  } else {
    toast.error(idesResult.error.message);
  }

  this.detectingIdes.set(false);
}
```

### IDE 選択変更ハンドラー

```typescript
protected async onIdeChange(newIdeId: IdeId): Promise<void> {
  const previousIdeId = this.selectedIdeId();
  this.selectedIdeId.set(newIdeId);
  this.saving.set(true);

  const result = await window.electronAPI.updateSettings({ selectedIde: newIdeId });

  if (result.success) {
    toast.success(this.transloco.translate('settings.saveSuccess'));
  } else {
    // 失敗時はロールバック
    this.selectedIdeId.set(previousIdeId);
    toast.error(result.error.message);
  }

  this.saving.set(false);
}
```

### テンプレート設計

```html
<ng-container *transloco="let t">
  <div class="mx-auto max-w-6xl p-6">
    <h1 class="mb-6 text-2xl font-bold">{{ t('settings.title') }}</h1>

    <!-- IDE セクション -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ t('settings.ide.sectionTitle') }}</h2>
      <p class="text-muted-foreground text-sm">{{ t('settings.ide.description') }}</p>

      @if (detectingIdes()) {
      <!-- IDE 検出中: select 部分のみスピナー -->
      <div class="flex items-center gap-2">
        <hlm-spinner />
        <span class="text-muted-foreground text-sm"> {{ t('settings.ide.detecting') }} </span>
      </div>
      } @else {
      <!-- IDE 選択 select -->
      <hlm-select
        [value]="selectedIdeId()"
        (valueChange)="onIdeChange($event)"
        [disabled]="saving()"
      >
        <hlm-select-trigger class="w-[240px]">
          <hlm-select-value />
        </hlm-select-trigger>
        <div hlmSelectContent>
          @for (ide of ideOptions(); track ide.id) {
          <hlm-option [value]="ide.id" [disabled]="!ide.installed">
            <span>{{ ide.displayName }}</span>
            @if (!ide.installed) {
            <span class="text-muted-foreground text-xs">
              {{ t('settings.ide.notInstalled') }}
            </span>
            }
          </hlm-option>
          }
        </div>
      </hlm-select>
      }
    </section>
  </div>
</ng-container>
```

### UI 仕様

| 項目               | 仕様                                                     |
| ------------------ | -------------------------------------------------------- |
| レイアウト         | `mx-auto max-w-6xl p-6`（既存ページと統一）              |
| IDE 選択           | `hlm-select` ドロップダウン、幅 240px                    |
| 未インストール IDE | `disabled` 属性で選択不可、`(未インストール)` ラベル表示 |
| 検出中             | `hlm-spinner` + テキスト（select 部分のみ）              |
| 保存中             | select を `disabled` にして操作をブロック                |
| 保存成功           | `toast.success` で通知                                   |
| 保存失敗           | `toast.error` で通知、選択値をロールバック               |

### 将来の拡張性

設定画面は `<section>` で大項目を区切る構造。新しい設定項目を追加する場合は、
IDE セクションの下に新しい `<section>` を追加するだけで対応可能。

---

## Module 2: Routing

### ファイル

| ファイル                | 変更内容               |
| ----------------------- | ---------------------- |
| `src/app/app.routes.ts` | `/settings` ルート追加 |

### ルート定義

```typescript
{
  path: 'settings',
  loadComponent: () =>
    import('./settings/settings').then((m) => m.SettingsComponent),
},
```

既存の `workspaces`, `repos` と同じ lazy loading パターンを使用する。

---

## Module 3: Navigation

### ファイル

| ファイル           | 変更内容                               |
| ------------------ | -------------------------------------- |
| `src/app/app.ts`   | `lucideSettings` アイコンの追加        |
| `src/app/app.html` | サイドバーに設定ナビゲーション項目追加 |

### app.ts の変更

```typescript
// providers に lucideSettings を追加
providers: [provideIcons({ lucideLayers, lucideGitFork, lucidePanelLeft, lucideSettings })],
```

### app.html の変更

既存の「リポジトリ」メニュー項目の下に追加:

```html
<li hlmSidebarMenuItem>
  <a
    hlmSidebarMenuButton
    routerLink="/settings"
    routerLinkActive
    #rlaSettings="routerLinkActive"
    [isActive]="rlaSettings.isActive"
  >
    <ng-icon hlm name="lucideSettings" size="sm" />
    <span>{{ t('nav.settings') }}</span>
  </a>
</li>
```

---

## Module 4: i18n

### ファイル

| ファイル              | 変更内容     |
| --------------------- | ------------ |
| `public/i18n/ja.json` | 翻訳キー追加 |
| `public/i18n/en.json` | 翻訳キー追加 |

### 追加する翻訳キー

#### ja.json

```json
{
  "nav": {
    "settings": "設定"
  },
  "settings": {
    "title": "設定",
    "saveSuccess": "設定を保存しました",
    "ide": {
      "sectionTitle": "IDE",
      "description": "Workspace を開くときに使用する IDE を選択してください。",
      "detecting": "IDE を検出中...",
      "notInstalled": "（未インストール）"
    }
  }
}
```

#### en.json

```json
{
  "nav": {
    "settings": "Settings"
  },
  "settings": {
    "title": "Settings",
    "saveSuccess": "Settings saved",
    "ide": {
      "sectionTitle": "IDE",
      "description": "Select the IDE to use when opening a Workspace.",
      "detecting": "Detecting IDEs...",
      "notInstalled": "(Not installed)"
    }
  }
}
```

---

## コンポーネント構成（ファイル配置と責務）

### 変更対象ファイル

| ファイル                | 変更内容                                  |
| ----------------------- | ----------------------------------------- |
| `src/app/app.ts`        | `lucideSettings` アイコン追加             |
| `src/app/app.html`      | サイドバーに設定ナビゲーション項目追加    |
| `src/app/app.routes.ts` | `/settings` ルート追加                    |
| `public/i18n/ja.json`   | `nav.settings`, `settings.*` 翻訳キー追加 |
| `public/i18n/en.json`   | `nav.settings`, `settings.*` 翻訳キー追加 |

### 新規作成ファイル

| ファイル                         | 責務                                                       |
| -------------------------------- | ---------------------------------------------------------- |
| `src/app/settings/settings.ts`   | 設定画面コンポーネント（IDE 選択、検出状態表示、自動保存） |
| `src/app/settings/settings.html` | 設定画面テンプレート                                       |
