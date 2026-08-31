import { describe, expect, it } from 'vitest'

import type { Distribution } from '@/platform/distribution/types'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'

import { resolveAgentPaywallPresentation } from './agentPaywallPresentation'

describe('resolveAgentPaywallPresentation', () => {
  it.for([
    {
      name: 'Cloud owner with both self-serve actions',
      distribution: 'cloud',
      role: 'owner',
      canTopUp: true,
      canSubscribeSelfServe: true,
      expected: { kind: 'subscribed', showUpgrade: true }
    },
    {
      name: 'Cloud owner with top-up only',
      distribution: 'cloud',
      role: 'owner',
      canTopUp: true,
      canSubscribeSelfServe: false,
      expected: { kind: 'subscribed', showUpgrade: false }
    },
    {
      name: 'Cloud owner who must subscribe before buying credits',
      distribution: 'cloud',
      role: 'owner',
      canTopUp: false,
      canSubscribeSelfServe: true,
      expected: { kind: 'subscriptionRequired' }
    },
    {
      name: 'Cloud sales-managed owner',
      distribution: 'cloud',
      role: 'owner',
      canTopUp: false,
      canSubscribeSelfServe: false,
      expected: { kind: 'salesManaged' }
    },
    {
      name: 'Cloud workspace member',
      distribution: 'cloud',
      role: 'member',
      canTopUp: true,
      canSubscribeSelfServe: true,
      expected: { kind: 'member' }
    },
    {
      name: 'Desktop owner without a subscription',
      distribution: 'desktop',
      role: 'owner',
      canTopUp: true,
      canSubscribeSelfServe: false,
      expected: { kind: 'local' }
    },
    {
      name: 'Localhost owner without a subscription',
      distribution: 'localhost',
      role: 'owner',
      canTopUp: true,
      canSubscribeSelfServe: false,
      expected: { kind: 'local' }
    },
    {
      name: 'Desktop workspace member',
      distribution: 'desktop',
      role: 'member',
      canTopUp: true,
      canSubscribeSelfServe: false,
      expected: { kind: 'member' }
    }
  ] satisfies Array<{
    name: string
    distribution: Distribution
    role: WorkspaceRole
    canTopUp: boolean
    canSubscribeSelfServe: boolean
    expected: ReturnType<typeof resolveAgentPaywallPresentation>
  }>)('$name', ({ expected, name: _, ...input }) => {
    expect(resolveAgentPaywallPresentation(input)).toEqual(expected)
  })
})
