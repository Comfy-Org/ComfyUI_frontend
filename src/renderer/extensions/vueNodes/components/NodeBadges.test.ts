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

  // The Comfy mark is the only thing separating a Comfy Cloud node from any other
  // partner node on canvas, so the tint is what carries the distinction.
  it('fills the chip for a Comfy Cloud node', () => {
    render(NodeBadges, {
      props: {
        hasComfyBadge: true,
        hasComfyCloudBadge: true,
        core: [],
        extension: []
      }
    })

    const chip = screen.getByTestId('comfy-badge')
    expect(chip.className).toContain('bg-brand-yellow')
    expect(chip.className).not.toContain('bg-component-node-widget-background')
  })

  it('leaves the core-node chip on the default surface', () => {
    render(NodeBadges, {
      props: {
        hasComfyBadge: true,
        hasComfyCloudBadge: false,
        core: [],
        extension: []
      }
    })

    const chip = screen.getByTestId('comfy-badge')
    expect(chip.className).not.toContain('bg-brand-yellow')
    expect(chip.className).toContain('bg-component-node-widget-background')
  })
})
