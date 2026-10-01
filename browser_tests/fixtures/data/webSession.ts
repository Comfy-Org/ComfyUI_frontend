import type {
  CurrentWorkspaceResponse,
  ErrorResponse,
  ExchangeTokenResponse,
  PromptResponse,
  WebSessionResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'

import { TEAM_WORKSPACE } from '@e2e/fixtures/data/workspaceSwitcher'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'

export const WEB_SESSION_FEATURES: RemoteConfig = { unified_web_session: true }

/** What ingest answers a caller with no client header or cookie. */
export const WEB_SESSION_ANONYMOUS_FEATURES = {
  unified_web_session: false,
  web_session_probe: true
} satisfies RemoteConfig & { web_session_probe: boolean }

export const WEB_SESSION_COOKIE = {
  name: 'e2e_web_session',
  value: 'cookie-e2e'
}

export const WEB_SESSION_CSRF_TOKEN = 'csrf-e2e'

export const WEB_SESSION: WebSessionResponse = {
  user: {
    id: 'test-user-e2e',
    email: CLOUD_SELF_EMAIL,
    email_verified: true
  },
  csrf_token: WEB_SESSION_CSRF_TOKEN,
  expires_at: '2099-01-01T00:00:00Z',
  absolute_expires_at: '2099-01-02T00:00:00Z'
}

export const WEB_SESSION_MINT: ExchangeTokenResponse = {
  token: 'session-jwt-e2e',
  expires_at: '2099-01-01T00:00:00Z',
  workspace: {
    id: TEAM_WORKSPACE.id,
    name: TEAM_WORKSPACE.name,
    type: TEAM_WORKSPACE.type
  },
  role: TEAM_WORKSPACE.role,
  permissions: []
}

export function currentWorkspace(
  workspace: WorkspaceWithRole
): CurrentWorkspaceResponse {
  return {
    auth_method: 'cookie',
    id: workspace.id,
    name: workspace.name,
    type: workspace.type,
    role: workspace.role
  }
}

export const WORKSPACE_ACCESS_DENIED: ErrorResponse = {
  code: 'workspace_access_denied',
  message: 'You no longer have access to this workspace'
}

export const PROMPT_ACCEPTED: PromptResponse = {
  prompt_id: 'web-session-job',
  number: 1,
  node_errors: {}
}
