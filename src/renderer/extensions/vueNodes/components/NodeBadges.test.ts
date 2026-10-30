import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import NodeBadges from '@/renderer/extensions/vueNodes/components/NodeBadges.vue'

describe('NodeBadges', () => {
  it('renders the Comfy badge after the core badges', () => {
    render(NodeBadges, {
      props: {
        groups: [
          { kind: 'core', badges: [{ text: '#1' }, { text: 'BETA' }] },
          {
            kind: 'source',
            badges: [{ text: '', cssIcon: 'icon-[comfy--comfy-c]' }]
          }
        ]
      }
    })

    const coreBadge = screen.getByText('BETA')
    const comfyBadge = screen.getByTestId('node-badge-group-source')
    expect(
      coreBadge.compareDocumentPosition(comfyBadge) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('renders pricing without identity or extension badges', () => {
    render(NodeBadges, {
      props: {
        groups: [
          {
            kind: 'credits',
            badges: [{ text: '0.25 credits / image' }]
          }
        ]
      }
    })

    expect(screen.getByText('0.25 credits / image')).toBeVisible()
  })
})
