import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import StepsGrid01 from './StepsGrid01.vue'

type StepsGridProps = ComponentProps<typeof StepsGrid01>

const timelineProps = {
  heading: 'Timeline',
  layout: 'timeline',
  steps: [
    {
      id: 'signup',
      title: 'Signups open',
      label: '10/1',
      description: 'Registration opens for the online competition.'
    },
    {
      id: 'close',
      label: '10/19',
      description: 'Send your repo and demo before the deadline.'
    }
  ]
} satisfies StepsGridProps

describe('StepsGrid01 timeline', () => {
  it('renders a heading only for the milestones that have a title', () => {
    render(StepsGrid01, { props: timelineProps })

    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent.trim())
    ).toEqual(['Signups open'])
    expect(screen.getByText('10/1')).toBeTruthy()
    expect(screen.getByText('10/19')).toBeTruthy()
  })
})
