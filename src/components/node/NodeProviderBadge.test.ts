import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'

import NodeProviderBadge from './NodeProviderBadge.vue'

function renderBadge(nodeDef: Partial<ComfyNodeDefImpl>) {
  return render(NodeProviderBadge, {
    props: { nodeDef: fromPartial<ComfyNodeDefImpl>(nodeDef) }
  })
}

describe('NodeProviderBadge', () => {
  it('outlines a single-color provider in its color', () => {
    renderBadge({ api_node: true, category: 'api/text/Anthropic' })

    expect(screen.getByText('Anthropic')).toHaveStyle({
      borderColor: '#D97757'
    })
  })

  it('draws a gradient provider border through the background', () => {
    renderBadge({ api_node: true, category: 'api/image/Gemini' })

    expect(screen.getByText('Gemini')).toHaveStyle({
      borderColor: 'transparent',
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box'
    })
  })

  it('renders nothing for a non-API node', () => {
    renderBadge({ api_node: false, category: 'image/Gemini' })

    expect(screen.queryByText('Gemini')).not.toBeInTheDocument()
  })
})
