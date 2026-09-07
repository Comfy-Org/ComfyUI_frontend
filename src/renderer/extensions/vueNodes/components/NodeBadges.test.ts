import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import NodeBadges from '@/renderer/extensions/vueNodes/components/NodeBadges.vue'

describe('NodeBadges', () => {
  it('renders the Comfy badge after the core badges', () => {
    render(NodeBadges, {
      props: {
        hasComfyBadge: true,
        core: [{ text: '#1' }, { text: 'BETA' }],
        extension: []
      }
    })

    const coreBadge = screen.getByText('BETA')
    const comfyBadge = screen.getByTestId('comfy-badge')
    expect(
      coreBadge.compareDocumentPosition(comfyBadge) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})
