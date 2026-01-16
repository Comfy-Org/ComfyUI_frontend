export const WORKSPACE_STORAGE_KEYS = {
  CURRENT_WORKSPACE: 'Comfy.Workspace.Current',
  TOKEN: 'Comfy.Workspace.Token',
  EXPIRES_AT: 'Comfy.Workspace.ExpiresAt'
} as const

export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000
