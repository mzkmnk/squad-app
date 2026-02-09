# SquadApp — プロダクト概要

SquadApp は、複数の Git リポジトリを横断して開発環境（Workspace）を管理するデスクトップアプリケーション。

## 主な機能

- Git リポジトリの登録・削除（Bare Repository として `~/.squad/` 配下にクローン）
- リモートブランチの一覧取得・fetch
- 複数リポジトリ × ブランチの組み合わせで Workspace を作成（git worktree ベース）
- `.code-workspace` ファイルを自動生成し、VS Code で開く
- Workspace の削除（worktree + ファイル + ストアのクリーンアップ）

## データ管理

- リポジトリ情報: `~/.squad/config/repos.json`
- Workspace 情報: `~/.squad/config/workspaces.json`
- Bare Repository: `~/.squad/repos/`
- Worktree: `~/.squad/workspaces/`

## 対象ユーザー

複数リポジトリにまたがる機能開発を頻繁に行う開発チーム。
