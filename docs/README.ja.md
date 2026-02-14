<p align="center">
  <img src="../build/icon.png" alt="Squad" width="128" height="128" />
</p>

<h1 align="center">Squad</h1>

<p align="center">
  複数の Git リポジトリを横断して開発環境（Workspace）を管理するデスクトップアプリ
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Angular-21-dd0031?logo=angular" alt="Angular 21" />
  <img src="https://img.shields.io/badge/Electron-40-47848f?logo=electron" alt="Electron 40" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript" alt="TypeScript 5.9" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
</p>

<p align="center">
  <a href="../README.md">English</a>
</p>

---

## Squad とは？

複数リポジトリにまたがる機能開発を行うとき、リポジトリごとにブランチを切って worktree を作って `.code-workspace` を書いて…という手間を Squad が自動化します。

1. リポジトリを登録（Bare Repository として `~/.squad/repos/` にクローン）
2. リポジトリ × ブランチの組み合わせで Workspace を作成
3. git worktree + `.code-workspace` を自動生成し、VS Code をワンクリックで起動

![ワークスペース一覧](../e2e/screenshots/workspace-list.vrt.spec.ts/workspace-list-multiple.png)

![リポジトリ一覧](../e2e/screenshots/repo-list.vrt.spec.ts/repo-list-multiple.png)

## 主な機能

| 機能             | 説明                                                           |
| ---------------- | -------------------------------------------------------------- |
| リポジトリ管理   | HTTPS / SSH URL からリポジトリを登録・削除                     |
| ブランチ一覧     | リモートブランチの取得・fetch                                  |
| 新規ブランチ作成 | 既存ブランチから新しいブランチを作成して Workspace に追加      |
| Workspace 作成   | 複数リポジトリ × ブランチの組み合わせを1つの開発環境として構成 |
| VS Code 連携     | `.code-workspace` を自動生成し、ワンクリックで VS Code を起動  |
| Workspace 削除   | worktree・ファイル・ストアをまとめてクリーンアップ             |

## 技術スタック

| レイヤー               | 技術                                                |
| ---------------------- | --------------------------------------------------- |
| フロントエンド         | Angular 21（スタンドアロン・ゾーンレス・シグナル）  |
| UI コンポーネント      | spartan-ng/brain + spartan-ng/helm                  |
| スタイリング           | Tailwind CSS 4 + class-variance-authority           |
| デスクトップ           | Electron 40（contextIsolation + contextBridge IPC） |
| バリデーション         | zod 4                                               |
| テスト                 | Vitest 4（happy-dom）                               |
| リンター               | ESLint 9 + Prettier 3                               |
| パッケージマネージャー | pnpm 9                                              |

## インストール

[GitHub Releases](https://github.com/mzkmnk/squad-app/releases) から最新の `.dmg` をダウンロードしてください。

> `main` ブランチへの push 時に GitHub Actions で自動リリースされます。

## 開発

### 前提条件

- Node.js 22+
- pnpm 9+
- Git
- VS Code（Workspace を開くために必要）

### インストール

```bash
git clone https://github.com/mzkmnk/squad-app.git
cd squad-app
pnpm install
```

### 開発

ターミナルを2つ使います。

```bash
# ターミナル 1: Angular dev server
pnpm ng serve

# ターミナル 2: Electron 起動
pnpm electron:serve
```

### ビルド・パッケージング

```bash
# Angular プロダクションビルド
pnpm build

# Electron TypeScript コンパイル
pnpm electron:build

# フルパッケージ（dmg / zip）
pnpm package
```

## テスト

```bash
# 全テスト実行
pnpm test

# Angular テストのみ
pnpm test:ng

# Electron テストのみ
pnpm test:electron
```

## リント・フォーマット

```bash
pnpm lint          # ESLint
pnpm lint:fix      # ESLint 自動修正
pnpm format        # Prettier フォーマット
pnpm format:check  # Prettier チェック（CI 用）
```

## プロジェクト構成

```
src/                          # Angular アプリケーション
  app/
    workspaces/               # ワークスペース一覧・作成
    repos/                    # リポジトリ一覧・追加
    shared/                   # 共有コンポーネント（ブランチ選択など）
    services/                 # Angular サービス（IPC ラッパー）

electron/                     # Electron メインプロセス
  git/                        # Git 操作（clone, worktree, fetch, branch）
  ipc/                        # IPC ハンドラー・チャネル定義
  store/                      # JSON ファイルベースのデータ永続化
  types/                      # 共有型定義（IpcResult, モデル, エラーコード）
```

## アーキテクチャ

```
Angular (Renderer)
  ↓ window.electronAPI.*()
Preload (contextBridge)
  ↓ ipcRenderer.invoke()
IPC Handlers (Main Process)
  ↓
Git Service / Store
```

- IPC レスポンスは全て `IpcResult<T>` で統一（success / error の Discriminated Union）
- エラーは `IpcErrorCode` で分類（`VALIDATION_ERROR`, `NOT_FOUND`, `GIT_OPERATION_FAILED` 等）
- データモデルは zod スキーマで定義し、型とバリデーションを一元管理

## データ保存先

| 種類            | パス                              |
| --------------- | --------------------------------- |
| リポジトリ設定  | `~/.squad/config/repos.json`      |
| Workspace 設定  | `~/.squad/config/workspaces.json` |
| Bare Repository | `~/.squad/repos/`                 |
| Worktree        | `~/.squad/workspaces/`            |

## ライセンス

このプロジェクトは [MIT License](../LICENSE) の下で公開されています。
