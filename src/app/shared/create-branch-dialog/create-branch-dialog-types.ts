/** 新規ブランチ作成ダイアログの確定結果 */
export interface CreateBranchResult {
  /** 起点ブランチ名 */
  baseBranch: string;
  /** 新規ブランチ名 */
  newBranchName: string;
}
