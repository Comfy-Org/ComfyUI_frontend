import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'

import { useWorkspaceMembersVisibility } from './useWorkspaceMembersVisibility'

const env = vi.hoisted(() => ({ state: { isCloud: false } }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return env.state.isCloud
  }
}))

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

function admitManageMembers() {
  vi.mocked(useBillingCapabilities()).canManageMembers = computed(() =>
    receiveServerFact('can_manage_members', true)
  )
}

describe('useWorkspaceMembersVisibility', () => {
  beforeEach(() => {
    env.state.isCloud = false
  })

  it('admits every Cloud actor, including one who cannot manage members', () => {
    env.state.isCloud = true

    expect(useWorkspaceMembersVisibility().canViewMembers.value).toBe(true)
  })

  it('admits an off-Cloud actor the server says can manage members', () => {
    admitManageMembers()

    expect(useWorkspaceMembersVisibility().canViewMembers.value).toBe(true)
  })

  it('refuses an off-Cloud actor the server does not admit', () => {
    expect(useWorkspaceMembersVisibility().canViewMembers.value).toBe(false)
  })
})
