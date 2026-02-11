# ストーリーマッピング — IDE Selector & Settings

## 要件 → Unit マッピング

| 要件  | 内容                             | Unit |
| ----- | -------------------------------- | ---- |
| FR-1  | サポート対象 IDE 定義            | 1    |
| FR-2  | IDE 選択の粒度（グローバル設定） | 1, 2 |
| FR-3  | IDE 自動検出                     | 1    |
| FR-4  | 設定画面                         | 2    |
| FR-5  | Workspace 作成時の IDE 起動削除  | 1    |
| FR-6  | Workspace オープン時の IDE 起動  | 1    |
| FR-7  | 設定の永続化                     | 1    |
| FR-8  | 設定 IPC API                     | 1    |
| NFR-1 | デフォルト値（VS Code）          | 1    |
| NFR-2 | IDE 検出の並列実行               | 1    |
| NFR-3 | セキュリティ（execFile 使用）    | 1    |
| EC-1  | IDE が見つからない場合のエラー   | 1, 2 |
| EC-2  | 設定ファイル破損時の再初期化     | 1    |

## Unit → Module → 要件 逆引き

### Unit 1: 設定基盤 & IDE 検出 & IPC

| Module           | 対応要件                 |
| ---------------- | ------------------------ |
| Settings Store   | FR-7, NFR-1, EC-2        |
| IDE Detector     | FR-1, FR-3, NFR-2, NFR-3 |
| Settings IPC     | FR-8                     |
| Workspace 変更   | FR-5, FR-6, EC-1         |
| Preload & 型定義 | FR-8（公開）             |

### Unit 2: 設定 UI

| Module        | 対応要件               |
| ------------- | ---------------------- |
| Settings Page | FR-2, FR-3, FR-4, EC-1 |
| Navigation    | FR-4                   |
| Routing       | FR-4                   |
