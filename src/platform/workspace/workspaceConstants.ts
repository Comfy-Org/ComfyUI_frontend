export const WORKSPACE_STORAGE_KEYS = {
  // sessionStorage keys (cleared on browser close)
  CURRENT_WORKSPACE: 'Comfy.Workspace.Current',
  TOKEN: 'Comfy.Workspace.Token',
  EXPIRES_AT: 'Comfy.Workspace.ExpiresAt',
  // localStorage key (persists across browser sessions)
  LAST_WORKSPACE_ID: 'Comfy.Workspace.LastWorkspaceId'
} as const

export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

/** Max length for a workspace name (create, rename, edit). */
export const WORKSPACE_NAME_MAX_LENGTH = 30
