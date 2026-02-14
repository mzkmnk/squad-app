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
  /** ローディングスピナー */
  readonly spinner: Locator;
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
    this.spinner = content.locator('hlm-spinner');
    this.emptyTitle = content.getByRole('heading', { name: 'No workspaces', level: 3 });
    this.emptyDescription = content.getByText('Create a new workspace using the "Create" button.');
    this.workspaceCards = content.getByRole('listitem');
  }

  /** ローディングが完了するまで待機する */
  async waitForLoaded(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
    // スピナーが消えるまで待つ（表示されない場合もあるので短いタイムアウト）
    await this.spinner
      .first()
      .waitFor({ state: 'hidden', timeout: 10_000 })
      .catch(() => {
        // スピナーが最初から表示されない場合は無視
      });
  }
}
