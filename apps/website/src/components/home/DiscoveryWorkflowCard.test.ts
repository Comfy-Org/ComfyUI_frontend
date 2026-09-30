import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { DiscoveryWorkflow } from '../../data/modelDiscovery'
import DiscoveryWorkflowCard from './DiscoveryWorkflowCard.vue'

const workflow: DiscoveryWorkflow = {
  name: 'Turn a rough sketch into a finished product render with reflections',
  href: '/models/workflows/sketch-to-render/',
  thumbnailUrl: '/fixture-workflow.png'
}

describe('DiscoveryWorkflowCard', () => {
  it('keeps the whole name within reach of a name the card cuts short', () => {
    render(DiscoveryWorkflowCard, { props: { workflow } })

    expect(screen.getByText(workflow.name)).toHaveAttribute(
      'title',
      workflow.name
    )
  })
})
