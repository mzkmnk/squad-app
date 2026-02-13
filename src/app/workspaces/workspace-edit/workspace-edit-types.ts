import { WorkspaceCreateEntry } from '../../../../electron/ipc/ipc-channels';

export type PendingEntry =
  | {
      readonly type: 'existing';
      readonly repositoryId: string;
      readonly branch: string;
    }
  | {
      readonly type: 'new';
      readonly repositoryId: string;
      readonly newBranchInfo: {
        readonly sourceBranch: string;
        readonly newBranchName: string;
      };
    };

export function toWorkspaceCreateEntry(entry: PendingEntry): WorkspaceCreateEntry {
  if (entry.type === 'existing') {
    return { repositoryId: entry.repositoryId, branch: entry.branch };
  }
  return {
    repositoryId: entry.repositoryId,
    branch: entry.newBranchInfo.newBranchName,
    sourceBranch: entry.newBranchInfo.sourceBranch,
  };
}
