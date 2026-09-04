import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'

import WorkspaceProfilePic from './WorkspaceProfilePic.vue'

function renderAvatarStyle(
  props: ComponentProps<typeof WorkspaceProfilePic>
): string | null {
  const { unmount } = render(WorkspaceProfilePic, { props })
  const style = screen.getByText('A').getAttribute('style')
  unmount()
  return style
}

describe('WorkspaceProfilePic', () => {
  it('renders the neutral avatar when the tier is unavailable', () => {
    expect(renderAvatarStyle({ workspaceName: 'Acme' })).toBeNull()
  })

  it('renders the Free avatar for a null tier and a tier added by the backend', () => {
    const freeStyle = renderAvatarStyle({
      workspaceName: 'Acme',
      subscriptionTier: null
    })
    const unknownTierStyle = renderAvatarStyle({
      workspaceName: 'Acme',
      subscriptionTier: 'FUTURE_TIER' as unknown as SubscriptionTier
    })

    expect(freeStyle).not.toBeNull()
    expect(unknownTierStyle).toBe(freeStyle)
  })
})
