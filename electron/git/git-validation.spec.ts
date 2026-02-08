import { describe, it, expect } from 'vitest';
import { validateRemoteUrl, validateBranchName, validateRepoName } from './git-validation.js';
import { GitValidationError } from './git-errors.js';

describe('validateRemoteUrl', () => {
  it('HTTPS URL（.git 付き）を受け入れる', () => {
    expect(() => {
      validateRemoteUrl('https://github.com/org/repo.git');
    }).not.toThrow();
  });

  it('HTTPS URL（.git 省略）を受け入れる', () => {
    expect(() => {
      validateRemoteUrl('https://github.com/org/repo');
    }).not.toThrow();
  });

  it('SSH URL を受け入れる', () => {
    expect(() => {
      validateRemoteUrl('git@github.com:org/repo.git');
    }).not.toThrow();
  });

  it('空文字列を拒否する', () => {
    expect(() => {
      validateRemoteUrl('');
    }).toThrow(GitValidationError);
  });

  it('http://（非HTTPS）を拒否する', () => {
    expect(() => {
      validateRemoteUrl('http://github.com/org/repo.git');
    }).toThrow(GitValidationError);
  });

  it('スキームなしの文字列を拒否する', () => {
    expect(() => {
      validateRemoteUrl('github.com/org/repo.git');
    }).toThrow(GitValidationError);
  });

  it('シェルメタ文字を含む URL を拒否する', () => {
    expect(() => {
      validateRemoteUrl('https://example.com/repo; rm -rf /');
    }).toThrow(GitValidationError);
  });

  it('スペースを含む URL を拒否する', () => {
    expect(() => {
      validateRemoteUrl('https://example.com/repo name.git');
    }).toThrow(GitValidationError);
  });

  it('改行を含む URL を拒否する', () => {
    expect(() => {
      validateRemoteUrl('https://example.com/repo\n.git');
    }).toThrow(GitValidationError);
  });
});

describe('validateBranchName', () => {
  it('通常のブランチ名を受け入れる', () => {
    expect(() => {
      validateBranchName('main');
    }).not.toThrow();
    expect(() => {
      validateBranchName('develop');
    }).not.toThrow();
  });

  it('スラッシュ区切りのブランチ名を受け入れる', () => {
    expect(() => {
      validateBranchName('feature/payment');
    }).not.toThrow();
  });

  it('空文字列を拒否する', () => {
    expect(() => {
      validateBranchName('');
    }).toThrow(GitValidationError);
  });

  it('".." を含む名前を拒否する', () => {
    expect(() => {
      validateBranchName('feature..branch');
    }).toThrow(GitValidationError);
  });

  it('先頭が "." の名前を拒否する', () => {
    expect(() => {
      validateBranchName('.hidden');
    }).toThrow(GitValidationError);
  });

  it('末尾が ".lock" の名前を拒否する', () => {
    expect(() => {
      validateBranchName('branch.lock');
    }).toThrow(GitValidationError);
  });

  it('スペースを含む名前を拒否する', () => {
    expect(() => {
      validateBranchName('feature branch');
    }).toThrow(GitValidationError);
  });

  it('禁止文字（~, ^, :, ?, *, [, \\）を含む名前を拒否する', () => {
    for (const ch of ['~', '^', ':', '?', '*', '[', '\\']) {
      expect(() => {
        validateBranchName(`feature${ch}branch`);
      }).toThrow(GitValidationError);
    }
  });

  it('制御文字を含む名前を拒否する', () => {
    expect(() => {
      validateBranchName('feature\x01branch');
    }).toThrow(GitValidationError);
  });

  it('先頭が "-" の名前を拒否する', () => {
    expect(() => {
      validateBranchName('-feature');
    }).toThrow(GitValidationError);
  });

  it('末尾が "/" の名前を拒否する', () => {
    expect(() => {
      validateBranchName('feature/');
    }).toThrow(GitValidationError);
  });

  it('連続する "/" を含む名前を拒否する', () => {
    expect(() => {
      validateBranchName('feature//branch');
    }).toThrow(GitValidationError);
  });
});

describe('validateRepoName', () => {
  it('英数字のみの名前を受け入れる', () => {
    expect(() => {
      validateRepoName('backend');
    }).not.toThrow();
    expect(() => {
      validateRepoName('repo123');
    }).not.toThrow();
  });

  it('ハイフン・アンダースコア・ドットを含む名前を受け入れる', () => {
    expect(() => {
      validateRepoName('my-repo_v1.0');
    }).not.toThrow();
  });

  it('空文字列を拒否する', () => {
    expect(() => {
      validateRepoName('');
    }).toThrow(GitValidationError);
  });

  it('101文字以上の名前を拒否する', () => {
    expect(() => {
      validateRepoName('a'.repeat(101));
    }).toThrow(GitValidationError);
  });

  it('スラッシュを含む名前を拒否する', () => {
    expect(() => {
      validateRepoName('org/repo');
    }).toThrow(GitValidationError);
  });

  it('スペースを含む名前を拒否する', () => {
    expect(() => {
      validateRepoName('my repo');
    }).toThrow(GitValidationError);
  });

  it('日本語を含む名前を拒否する', () => {
    expect(() => {
      validateRepoName('リポジトリ');
    }).toThrow(GitValidationError);
  });
});
