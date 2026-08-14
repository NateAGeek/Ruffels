import type {
  InitializationProposal,
  ProjectError,
  ProjectIndex,
  RecentProject,
} from "../../pages/SourceExplorer/SourceExplorer.types";

export type SourceGraphState =
  | { readonly type: "loadingRecents" }
  | { readonly type: "idle"; readonly recents: ReadonlyArray<RecentProject> }
  | { readonly type: "inspecting"; readonly recents: ReadonlyArray<RecentProject> }
  | {
      readonly type: "needsInitialization";
      readonly proposal: InitializationProposal;
      readonly recents: ReadonlyArray<RecentProject>;
    }
  | { readonly type: "indexing"; readonly projectName: string }
  | { readonly type: "open"; readonly index: ProjectIndex }
  | {
      readonly type: "error";
      readonly error: ProjectError;
      readonly recents: ReadonlyArray<RecentProject>;
    };

export interface SourceGraphController {
  readonly state: SourceGraphState;
  readonly selectProject: () => Promise<void>;
  readonly confirmInitialization: () => Promise<void>;
  readonly cancelInitialization: () => void;
  readonly openRecentProject: (root: string) => Promise<void>;
  readonly forgetRecentProject: (root: string) => Promise<void>;
  readonly reindexProject: () => Promise<void>;
  readonly includeProjectFile: (path: string) => Promise<void>;
  readonly closeProject: () => Promise<void>;
}
