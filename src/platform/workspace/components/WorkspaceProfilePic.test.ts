import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkspaceProfilePic from './WorkspaceProfilePic.vue'

describe('WorkspaceProfilePic', () => {
  it('applies the plan style only when the tier is known', () => {
    const { unmount } = render(WorkspaceProfilePic, {
      props: { workspaceName: 'Acme', subscriptionTier: null }
    })
    expect(screen.getByText('A')).toHaveAttribute('style')
    unmount()

    render(WorkspaceProfilePic, { props: { workspaceName: 'Acme' } })
    expect(screen.getByText('A')).not.toHaveAttribute('style')
  })
})
