import { vi } from 'vitest'

import type {
  agentSettingsAuthHeader as realAgentSettingsAuthHeader,
  agentSocketAuthParams as realAgentSocketAuthParams,
  ensureSignedIn as realEnsureSignedIn,
  hasAgentCredential as realHasAgentCredential,
  peekLastAgentCredential as realPeekLastAgentCredential,
  withAgentAuth as realWithAgentAuth
} from '@/workbench/extensions/agent/services/agent/agentAuth'

export const withAgentAuth = vi.fn<typeof realWithAgentAuth>(
  async (init) => init
)

export const peekLastAgentCredential = vi.fn<
  typeof realPeekLastAgentCredential
>(() => null)

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
