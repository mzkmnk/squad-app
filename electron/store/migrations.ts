import { stripSuffix } from '../git/uuid-suffix.js';

/**
 * JSON 設定ファイルのマイグレーション関数の型。
 *
 * @remarks
 * 入力は前バージョンの生データ（`unknown` 型）。
 * `version` フィールドを次のバージョンに更新した新しいオブジェクトを返す。
 */
export type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * バージョン番号 → マイグレーション関数のマッピング。
 *
 * @remarks
 * キーは「このバージョンから次のバージョンへ」のマイグレーションを表す。
 * 例: `{ 1: fn }` は v1 → v2 へのマイグレーション。
 */
export type MigrationMap = Partial<Record<number, MigrationFn>>;

// ============================================================
// repos.json マイグレーション
// ============================================================

/** repos.json の最新バージョン */
export const REPOS_CURRENT_VERSION = 2;

/** repos.json のマイグレーション定義 */
export const reposMigrations: MigrationMap = {
  /** v1 → v2: displayName フィールドを追加（name から suffix を除去） */
  1: (data) => {
    const repos = data.repositories as Record<string, unknown>[];
    return {
      ...data,
      version: 2,
      repositories: repos.map((r) => ({
        ...r,
        displayName: stripSuffix(r.name as string),
      })),
    };
  },
};

// ============================================================
// workspaces.json マイグレーション
// ============================================================

/** workspaces.json の最新バージョン */
export const WORKSPACES_CURRENT_VERSION = 2;

// ============================================================
// settings.json バージョン
// ============================================================

/** settings.json の最新バージョン */
export const SETTINGS_CURRENT_VERSION = 1;

/** workspaces.json のマイグレーション定義 */
export const workspacesMigrations: MigrationMap = {
  /** v1 → v2: displayName フィールドを追加（name から suffix を除去） */
  1: (data) => {
    const workspaces = data.workspaces as Record<string, unknown>[];
    return {
      ...data,
      version: 2,
      workspaces: workspaces.map((w) => ({
        ...w,
        displayName: stripSuffix(w.name as string),
      })),
    };
  },
};

// ============================================================
// マイグレーションランナー
// ============================================================

/**
 * 指定されたマイグレーションマップを使って、データを最新バージョンまで順次マイグレーションする。
 *
 * @param data - JSON ファイルから読み込んだ生データ
 * @param migrations - バージョン番号 → マイグレーション関数のマップ
 * @param targetVersion - マイグレーション先の最新バージョン
 * @returns マイグレーション済みデータと、マイグレーションが実行されたかどうか
 * @throws バージョンが不正、またはマイグレーションパスが見つからない場合
 */
export function runMigrations(
  data: Record<string, unknown>,
  migrations: MigrationMap,
  targetVersion: number,
): { result: Record<string, unknown>; migrated: boolean } {
  let current = data;
  const startVersion = current.version as number;

  if (typeof startVersion !== 'number' || startVersion < 1) {
    throw new Error(`Invalid config version: ${String(startVersion)}`);
  }

  if (startVersion > targetVersion) {
    throw new Error(
      `Config version ${String(startVersion)} is newer than supported version ${String(targetVersion)}. Please update the application.`,
    );
  }

  if (startVersion === targetVersion) {
    return { result: current, migrated: false };
  }

  for (let v = startVersion; v < targetVersion; v++) {
    const migrationFn = migrations[v];
    if (!migrationFn) {
      throw new Error(
        `No migration found for version ${String(v)} → ${String(v + 1)}. ` +
          `Cannot migrate from v${String(startVersion)} to v${String(targetVersion)}.`,
      );
    }
    current = migrationFn(current);
  }

  return { result: current, migrated: true };
}
