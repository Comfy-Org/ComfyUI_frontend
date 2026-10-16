import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import HowToEnterSection from './HowToEnterSection.vue'

const props = {
  heading: 'How to enter',
  facts: [
    { id: 'what', term: 'What you make', description: 'A working app.' },
    {
      id: 'deadline',
      term: 'Submission deadline',
      description: 'October 30'
    }
  ],
  intro: 'Every submission must include:',
  deliverables: [
    { id: 'repo', title: 'GitHub repo', description: 'Your app code.' },
    { id: 'demo', title: 'Demo video', description: 'Two minutes max.' }
  ],
  requirementsHeading: 'Requirements',
  requirements: ['One submission per person', 'Lawful and SFW'],
  note: 'About the demo video.'
} satisfies ComponentProps<typeof HowToEnterSection>

const textOf = (elements: HTMLElement[]) =>
  elements.map((element) => element.textContent.trim())

describe('HowToEnterSection', () => {
  it('pairs each fact term with its description', () => {
    render(HowToEnterSection, { props })

    expect(
      screen.getByRole('heading', { level: 2, name: 'How to enter' })
    ).toBeInTheDocument()
    expect(textOf(screen.getAllByRole('term'))).toEqual([
      'What you make',
      'Submission deadline'
    ])
    expect(textOf(screen.getAllByRole('definition'))).toEqual([
      'A working app.',
      'October 30'
    ])
  })

  it('numbers the deliverables in order', () => {
    render(HowToEnterSection, { props })

    expect(textOf(screen.getAllByText(/^0\d$/))).toEqual(['01', '02'])
    expect(textOf(screen.getAllByRole('heading', { level: 3 }))).toEqual([
      'GitHub repo',
      'Demo video'
    ])
  })

  it('shows the requirements open by default with the demo note', () => {
    render(HowToEnterSection, { props })

    const requirements = screen.getByRole('group')
    expect(requirements).toHaveAttribute('open')
    expect(textOf(within(requirements).getAllByRole('listitem'))).toEqual([
      'One submission per person',
      'Lawful and SFW'
    ])
    expect(screen.getByText('About the demo video.')).toBeInTheDocument()
  })
})
