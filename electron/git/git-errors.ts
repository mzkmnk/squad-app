/** Git 入力値バリデーションエラー */
export class GitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitValidationError';
  }
}

/** Git コマンド実行エラー */
export class GitOperationError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'GitOperationError';
  }
}

/** リポジトリ重複エラー */
export class GitRepositoryExistsError extends Error {
  constructor(repoName: string) {
    super(`Repository '${repoName}' already exists`);
    this.name = 'GitRepositoryExistsError';
  }
}
