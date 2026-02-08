import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { Repository, Workspace, ReposConfig, WorkspacesConfig } from '../types/models.js';
import { reposConfigSchema, workspacesConfigSchema } from '../types/models.js';
import { createSquadPaths, type SquadPaths } from './squad-paths.js';
import { generateSuffix, appendSuffix, MAX_SUFFIX_RETRY } from '../git/uuid-suffix.js';

const CURRENT_VERSION = 1;

/**
 * `~/.squad` 配下の JSON ストアに対する CRUD 操作を提供する。
 *
 * @remarks
 * リポジトリおよび Workspace の登録情報を JSON ファイルで永続化する。
 * 書き込みはアトミック（一時ファイル経由の rename）で行い、ファイル破損を防止する。
 */
export class SquadStore {
  private readonly paths: SquadPaths;

  /**
   * SquadStore インスタンスを生成する。
   *
   * @param rootPath - ストアのルートパス。省略時は `~/.squad`
   */
  constructor(rootPath?: string) {
    this.paths = createSquadPaths(rootPath);
  }

  // --- 初期化 ---

  /**
   * `~/.squad` ディレクトリ構造を初期化する。
   *
   * @remarks
   * 設定ファイルが存在しない場合のみ空の初期状態で作成する（冪等）。
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.paths.configDir, { recursive: true });
    await fs.mkdir(this.paths.reposDir, { recursive: true });
    await fs.mkdir(this.paths.workspacesDir, { recursive: true });

    await this.initConfigFile(this.paths.reposConfig, {
      version: CURRENT_VERSION,
      repositories: [],
    });
    await this.initConfigFile(this.paths.workspacesConfig, {
      version: CURRENT_VERSION,
      workspaces: [],
    });
  }

  // --- リポジトリ操作 ---

  /**
   * 登録済み全リポジトリを取得する。
   *
   * @returns リポジトリの配列
   */
  async getRepositories(): Promise<Repository[]> {
    const config = await this.readReposConfig();
    return config.repositories;
  }

  /**
   * ID でリポジトリを取得する。
   *
   * @param id - リポジトリの UUID
   * @returns 該当するリポジトリ。見つからない場合は `undefined`
   */
  async getRepository(id: string): Promise<Repository | undefined> {
    const repos = await this.getRepositories();
    return repos.find((r) => r.id === id);
  }

  /**
   * 新しいリポジトリを登録する。
   *
   * @param repo - 登録するリポジトリの `name` と `remoteUrl`
   * @returns `id` と `registeredAt` が自動付与されたリポジトリ
   */
  async addRepository(repo: Pick<Repository, 'name' | 'remoteUrl'>): Promise<Repository> {
    const config = await this.readReposConfig();
    const newRepo: Repository = {
      id: crypto.randomUUID(),
      name: repo.name,
      remoteUrl: repo.remoteUrl,
      registeredAt: new Date().toISOString(),
    };
    config.repositories.push(newRepo);
    await this.writeAtomically(this.paths.reposConfig, config);
    return newRepo;
  }

  /**
   * ID でリポジトリを削除する。
   *
   * @remarks 存在しない ID を渡した場合は何もしない。
   * @param id - 削除するリポジトリの UUID
   */
  async removeRepository(id: string): Promise<void> {
    const config = await this.readReposConfig();
    config.repositories = config.repositories.filter((r) => r.id !== id);
    await this.writeAtomically(this.paths.reposConfig, config);
  }

  // --- Workspace 操作 ---

  /**
   * 作成済み全 Workspace を取得する。
   *
   * @returns Workspace の配列
   */
  async getWorkspaces(): Promise<Workspace[]> {
    const config = await this.readWorkspacesConfig();
    return config.workspaces;
  }

  /**
   * ID で Workspace を取得する。
   *
   * @param id - Workspace の UUID
   * @returns 該当する Workspace。見つからない場合は `undefined`
   */
  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const workspaces = await this.getWorkspaces();
    return workspaces.find((w) => w.id === id);
  }

  /**
   * 新しい Workspace を追加する。
   *
   * @remarks 名前には UUID v4 先頭8文字の suffix が自動付与される。
   * 同名が既に存在する場合は新しい UUID で最大3回リトライする。
   * @param workspace - 追加する Workspace の `name` と `entries`
   * @returns `id`, `createdAt`, `updatedAt` が自動付与された Workspace（name は suffix 付き）
   */
  async addWorkspace(workspace: Pick<Workspace, 'name' | 'entries'>): Promise<Workspace> {
    for (let attempt = 0; attempt < MAX_SUFFIX_RETRY; attempt++) {
      const config = await this.readWorkspacesConfig();
      const suffix = generateSuffix();
      const actualName = appendSuffix(workspace.name, suffix);

      // 同名チェック
      if (config.workspaces.some((w) => w.name === actualName)) {
        continue;
      }

      const now = new Date().toISOString();
      const newWorkspace: Workspace = {
        id: crypto.randomUUID(),
        name: actualName,
        entries: [...workspace.entries],
        createdAt: now,
        updatedAt: now,
      };
      config.workspaces.push(newWorkspace);
      await this.writeAtomically(this.paths.workspacesConfig, config);
      return newWorkspace;
    }

    throw new Error(
      `Workspace '${workspace.name}' already exists after ${String(MAX_SUFFIX_RETRY)} retries`,
    );
  }

  /**
   * Workspace の `entries` を更新する。
   *
   * @remarks `updatedAt` は自動更新される。`createdAt` は変更されない。
   * @param id - 更新する Workspace の UUID
   * @param updates - 新しい `entries`
   * @returns 更新後の Workspace。存在しない ID の場合は `undefined`
   */
  async updateWorkspace(
    id: string,
    updates: Pick<Workspace, 'entries'>,
  ): Promise<Workspace | undefined> {
    const config = await this.readWorkspacesConfig();
    const index = config.workspaces.findIndex((w) => w.id === id);
    if (index === -1) {
      return undefined;
    }
    const existing = config.workspaces[index];
    const updated: Workspace = {
      ...existing,
      entries: [...updates.entries],
      updatedAt: new Date().toISOString(),
    };
    config.workspaces[index] = updated;
    await this.writeAtomically(this.paths.workspacesConfig, config);
    return updated;
  }

  /**
   * ID で Workspace を削除する。
   *
   * @remarks 存在しない ID を渡した場合は何もしない。
   * @param id - 削除する Workspace の UUID
   */
  async removeWorkspace(id: string): Promise<void> {
    const config = await this.readWorkspacesConfig();
    config.workspaces = config.workspaces.filter((w) => w.id !== id);
    await this.writeAtomically(this.paths.workspacesConfig, config);
  }

  // --- プライベートメソッド ---

  private async initConfigFile(
    filePath: string,
    defaultData: ReposConfig | WorkspacesConfig,
  ): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      await this.writeAtomically(filePath, defaultData);
    }
  }

  private async readReposConfig(): Promise<{ version: number; repositories: Repository[] }> {
    const raw = await fs.readFile(this.paths.reposConfig, 'utf-8');
    const config = reposConfigSchema.parse(JSON.parse(raw));
    if (config.version !== CURRENT_VERSION) {
      throw new Error(
        `Unsupported repos.json version: ${String(config.version)}. Expected version ${String(CURRENT_VERSION)}.`,
      );
    }
    return { version: config.version, repositories: [...config.repositories] };
  }

  private async readWorkspacesConfig(): Promise<{
    version: number;
    workspaces: Workspace[];
  }> {
    const raw = await fs.readFile(this.paths.workspacesConfig, 'utf-8');
    const config = workspacesConfigSchema.parse(JSON.parse(raw));
    if (config.version !== CURRENT_VERSION) {
      throw new Error(
        `Unsupported workspaces.json version: ${String(config.version)}. Expected version ${String(CURRENT_VERSION)}.`,
      );
    }
    return { version: config.version, workspaces: [...config.workspaces] };
  }

  private async writeAtomically(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    const tmpFile = path.join(dir, `.${path.basename(filePath)}.tmp.${crypto.randomUUID()}`);
    await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmpFile, filePath);
  }
}
