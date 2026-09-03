// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ModelLaunchSteps } from './types'

import ModelLaunchStepsSection from './ModelLaunchStepsSection.vue'

const item = (id: string) => ({
  id,
  title: { en: id, 'zh-CN': id },
  description: { en: `${id} description`, 'zh-CN': `${id} 描述` }
})

const steps = (count: number): ModelLaunchSteps => ({
  headingKey: 'minimaxLicense.steps.heading',
  stepLabelKey: 'minimaxLicense.steps.step',
  items: Array.from({ length: count }, (_, i) => item(`item-${i + 1}`))
})

describe('ModelLaunchStepsSection', () => {
  it('lays two items out on a two-column grid', () => {
    render(ModelLaunchStepsSection, { props: { steps: steps(2) } })

    expect(screen.getByRole('list').className).toContain('md:grid-cols-2')
  })

  it('keeps the three-column grid for longer step lists', () => {
    render(ModelLaunchStepsSection, { props: { steps: steps(3) } })

    expect(screen.getByRole('list').className).toContain('md:grid-cols-3')
  })
})
