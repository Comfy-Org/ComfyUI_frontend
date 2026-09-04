import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'

import WorkspaceProfilePic from './WorkspaceProfilePic.vue'

describe('WorkspaceProfilePic', () => {
  it('handles a tier added by the backend', () => {
    expect(() =>
      render(WorkspaceProfilePic, {
        props: {
          workspaceName: 'Acme',
          subscriptionTier: 'FUTURE_TIER' as unknown as SubscriptionTier
        }
      })
    ).not.toThrow()

    expect(screen.getByText('A')).toBeInTheDocument()
  })
})
