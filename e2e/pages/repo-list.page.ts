import type { Locator, Page } from '@playwright/test';

/**
 * リポジトリ一覧画面の Page Object Model。
 *
 * `/repos` ルートに対応する画面。
 */
export class RepoListPage {
  /** ページタイトル「Repositories」 */
  readonly heading: Locator;
  /** 「Add」ボタン */
  readonly addButton: Locator;
  /** 「Fetch All」ボタン */
  readonly fetchAllButton: Locator;
  /** 空状態のカードタイトル「No repositories registered」 */
  readonly emptyTitle: Locator;
  /** 空状態の説明文 */
  readonly emptyDescription: Locator;
  /** リポジトリカードのリスト */
  readonly repoCards: Locator;

  constructor(private readonly page: Page) {
    const content = page.locator('main');
    this.heading = content.getByRole('heading', { name: 'Repositories', level: 1 });
    this.addButton = content.getByRole('button', { name: /Add/ });
    this.fetchAllButton = content.getByRole('button', { name: /Fetch All/ });
    this.emptyTitle = content.getByRole('heading', {
      name: 'No repositories registered',
      level: 3,
    });
    this.emptyDescription = content.getByText('Register a repository using the "Add" button.');
    this.repoCards = content.getByRole('listitem');
  }

  /** サイドバーの「Repositories」リンクをクリックして遷移し、ローディング完了まで待機する */
  async navigateAndWait(): Promise<void> {
    await this.page.getByRole('link', { name: 'Repositories' }).click();
    await this.waitForLoaded();
  }

  /** ローディングが完了するまで待機する */
  async waitForLoaded(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
    // 空状態（emptyTitle）またはリポジトリカード（repoCards）のいずれかが
    // 表示されればローディング完了とみなす。
    await Promise.race([
      this.emptyTitle.waitFor({ state: 'visible' }),
      this.repoCards.first().waitFor({ state: 'visible' }),
    ]);
  }
}
