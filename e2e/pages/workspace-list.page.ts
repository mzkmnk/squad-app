import type { Locator, Page } from '@playwright/test';

/**
 * ワークスペース一覧画面の Page Object Model。
 *
 * デフォルトルート（`/workspaces`）にリダイレクトされる初期画面。
 */
export class WorkspaceListPage {
  /** ページタイトル「Workspaces」 */
  readonly heading: Locator;
  /** 「Create」ボタン */
  readonly createButton: Locator;
  /** 空状態のカードタイトル「No workspaces」 */
  readonly emptyTitle: Locator;
  /** 空状態の説明文 */
  readonly emptyDescription: Locator;
  /** ワークスペースカードのリスト */
  readonly workspaceCards: Locator;

  constructor(private readonly page: Page) {
    const content = page.locator('main');
    this.heading = content.getByRole('heading', { name: 'Workspaces', level: 1 });
    this.createButton = content.getByRole('button', { name: /Create/ });
    this.emptyTitle = content.getByRole('heading', { name: 'No workspaces', level: 3 });
    this.emptyDescription = content.getByText('Create a new workspace using the "Create" button.');
    this.workspaceCards = content.getByRole('listitem');
  }

  /** ローディングが完了するまで待機する */
  async waitForLoaded(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
    // スピナーの有無を追わず、ローディング完了後に必ず表示されるコンテンツを待つ。
    // 空状態（emptyTitle）またはワークスペースカード（workspaceCards）のいずれかが
    // 表示されればローディング完了とみなす。
    await Promise.race([
      this.emptyTitle.waitFor({ state: 'visible' }),
      this.workspaceCards.first().waitFor({ state: 'visible' }),
    ]);
  }
}
