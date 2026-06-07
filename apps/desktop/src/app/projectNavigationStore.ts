import { create } from "zustand";

export type ProjectLogReturnLocation = {
  href: string;
  updatedAt: string;
};

type ProjectNavigationState = {
  logReturnLocations: Record<string, ProjectLogReturnLocation>;
  viewState: Record<string, Record<string, string>>;
  rememberLogReturnLocation: (projectId: string, href: string) => void;
  setProjectViewState: (projectId: string, key: string, value: string) => void;
  clearProjectViewState: (projectId: string, key: string) => void;
};

export const useProjectNavigationStore = create<ProjectNavigationState>((set) => ({
  logReturnLocations: {},
  viewState: {},
  rememberLogReturnLocation: (projectId, href) => {
    const normalizedHref = normalizeProjectHref(projectId, href);
    if (!normalizedHref || isAiLogHref(projectId, normalizedHref)) {
      return;
    }

    set((state) => ({
      logReturnLocations: {
        ...state.logReturnLocations,
        [projectId]: {
          href: normalizedHref,
          updatedAt: new Date().toISOString()
        }
      }
    }));
  },
  setProjectViewState: (projectId, key, value) =>
    set((state) => ({
      viewState: {
        ...state.viewState,
        [projectId]: {
          ...(state.viewState[projectId] ?? {}),
          [key]: value
        }
      }
    })),
  clearProjectViewState: (projectId, key) =>
    set((state) => {
      const nextProjectState = { ...(state.viewState[projectId] ?? {}) };
      delete nextProjectState[key];

      return {
        viewState: {
          ...state.viewState,
          [projectId]: nextProjectState
        }
      };
    })
}));

export function projectLogReturnHref(
  projectId: string,
  storedLocation?: ProjectLogReturnLocation
): string {
  const normalizedHref = storedLocation
    ? normalizeProjectHref(projectId, storedLocation.href)
    : "";

  if (normalizedHref && !isAiLogHref(projectId, normalizedHref)) {
    return normalizedHref;
  }

  return defaultProjectReturnHref(projectId);
}

export function defaultProjectReturnHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/concept`;
}

function normalizeProjectHref(projectId: string, href: string): string {
  const trimmed = href.trim();
  const projectPrefix = `/projects/${encodeURIComponent(projectId)}`;

  if (!trimmed.startsWith(projectPrefix)) {
    return "";
  }

  return trimmed;
}

function isAiLogHref(projectId: string, href: string): boolean {
  return href.startsWith(`/projects/${encodeURIComponent(projectId)}/ai-log`);
}
