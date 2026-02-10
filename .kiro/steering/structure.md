# プロジェクト構成

```
src/                          # Angular アプリケーション
  app/                        # ルートコンポーネント・ルーティング
    app.ts                    # ルートコンポーネント（スタンドアロン）
    app.config.ts             # アプリ設定（ゾーンレス、ルーター）
    app.routes.ts             # ルート定義
    app.html / app.css        # テンプレート・スタイル
  lib/                        # 共有 UI コンポーネント（spartan-ng/helm ラッパー）
    button/src/               # ボタンコンポーネント
    utils/src/                # ユーティリティ（hlm 関数など）
  main.ts                     # Angular ブートストラップ
  styles.css                  # グローバルスタイル（Tailwind + テーマ変数）

electron/                     # Electron メインプロセス
  main.ts                     # アプリ起動・ウィンドウ作成・サービス初期化
  preload.ts                  # contextBridge で window.electronAPI を公開
  git/                        # Git 操作サービス
    git-service.ts            # clone, worktree, fetch, branch 操作
    code-workspace-service.ts # .code-workspace ファイル生成
    git-validation.ts         # URL・ブランチ名バリデーション
    git-errors.ts             # Git 固有エラークラス
  ipc/                        # IPC 通信レイヤー
    ipc-channels.ts           # チャネル名定数・リクエスト型・エラーコード
    ipc-handlers.ts           # ipcMain.handle 登録
    ipc-error-mapper.ts       # エラー → IpcResult 変換
  store/                      # データ永続化
    squad-store.ts            # JSON ファイルベースの CRUD ストア
    squad-paths.ts            # ~/.squad/ 配下のパス解決
  types/                      # 共有型定義
    models.ts                 # エンティティ（Repository, Workspace）+ zod スキーマ
    ipc-result.ts             # IpcResult<T> 型（Discriminated Union）
    electron-api.ts           # window.electronAPI の型定義（Angular 側から参照）
```

## アーキテクチャパターン

- Angular → `window.electronAPI.*()` → IPC → Electron メインプロセス
- IPC レスポンスは全て `IpcResult<T>` で統一（success/error の Discriminated Union）
- エラーは `IpcErrorCode` で分類（VALIDATION_ERROR, NOT_FOUND, GIT_OPERATION_FAILED 等）
- データモデルは zod スキーマで定義し、型とバリデーションを一元管理
- テストファイルはソースと同ディレクトリに `*.spec.ts` として配置
- UI コンポーネントは `src/lib/` に spartan-ng/helm ラッパーとして配置（`@spartan-ng/helm/*` パスエイリアス）
