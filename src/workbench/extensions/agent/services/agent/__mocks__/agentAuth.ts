import { vi } from 'vitest'

import type {
  agentSettingsAuthHeader as realAgentSettingsAuthHeader,
  agentSocketAuthParams as realAgentSocketAuthParams,
  ensureSignedIn as realEnsureSignedIn,
  hasAgentCredential as realHasAgentCredential,
  withAgentAuth as realWithAgentAuth
} from '@/workbench/extensions/agent/services/agent/agentAuth'

export const withAgentAuth = vi.fn<typeof realWithAgentAuth>(
  async (init) => init
)

export const agentSettingsAuthHeader = vi.fn<
  typeof realAgentSettingsAuthHeader
>(async () => ({ Authorization: 'Bearer workspace-token' }))

export const agentSocketAuthParams = vi.fn<typeof realAgentSocketAuthParams>(
  async () => new URLSearchParams()
)

export const hasAgentCredential = vi.fn<typeof realHasAgentCredential>(
  () => true
)

export const ensureSignedIn = vi.fn<typeof realEnsureSignedIn>(async () => true)
