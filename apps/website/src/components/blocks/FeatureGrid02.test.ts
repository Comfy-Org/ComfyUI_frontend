// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import FeatureGrid02 from './FeatureGrid02.vue'

type FeatureGridProps = ComponentProps<typeof FeatureGrid02>

const requiredProps = {
  heading: 'From idea to production',
  steps: [
    {
      id: 'build',
      title: 'Build',
      description: 'Compose a workflow with the models and tools you choose.'
    },
    {
      id: 'ship',
      title: 'Ship',
      description:
        'Run the same graph locally, in the cloud, or through an API.'
    }
  ]
} satisfies FeatureGridProps

function renderFeatureGrid(props: Partial<FeatureGridProps> = {}) {
  return render(FeatureGrid02, {
    props: { ...requiredProps, ...props }
  })
}

describe('FeatureGrid02', () => {
  it('renders the heading and each step title', () => {
    renderFeatureGrid()

    expect(screen.getByText('From idea to production')).toBeTruthy()
    expect(screen.getByText('Build')).toBeTruthy()
    expect(screen.getByText('Ship')).toBeTruthy()
  })

  it('omits the step number when a step has none', () => {
    renderFeatureGrid()

    expect(screen.queryByText('01')).toBeNull()
  })

  it('renders the step number when a step supplies one', () => {
    renderFeatureGrid({
      steps: [{ ...requiredProps.steps[0], number: '01' }]
    })

    expect(screen.getByText('01')).toBeTruthy()
  })
})
