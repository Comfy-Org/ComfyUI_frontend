// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import StepsAccordion01 from './StepsAccordion01.vue'

const steps = [
  { id: 'plan', title: 'Plan it' },
  { id: 'host', title: 'Host it' }
]

const slots = {
  plan: '<p>Pick a date.</p>',
  host: '<p>Run the show.</p>'
}

function trigger(name: string) {
  return screen.getByRole('button', { name })
}

describe('StepsAccordion01', () => {
  it('opens the first step by default and renders its slot content in the body', () => {
    render(StepsAccordion01, {
      props: { title: 'How it works', steps },
      slots
    })

    expect(trigger('1. Plan it').getAttribute('aria-expanded')).toBe('true')
    expect(trigger('2. Host it').getAttribute('aria-expanded')).toBe('false')
    expect(
      within(screen.getByRole('region', { name: '1. Plan it' })).getByText(
        'Pick a date.'
      )
    ).toBeTruthy()
  })

  it('opens the step named by defaultOpen instead of the first', () => {
    render(StepsAccordion01, {
      props: { title: 'How it works', steps, defaultOpen: 'host' },
      slots
    })

    expect(trigger('2. Host it').getAttribute('aria-expanded')).toBe('true')
    expect(trigger('1. Plan it').getAttribute('aria-expanded')).toBe('false')
  })

  it('opens a step when its header is clicked', async () => {
    render(StepsAccordion01, {
      props: { title: 'How it works', steps },
      slots
    })

    await userEvent.click(trigger('2. Host it'))
    await nextTick()

    expect(trigger('2. Host it').getAttribute('aria-expanded')).toBe('true')
    expect(trigger('1. Plan it').getAttribute('aria-expanded')).toBe('false')
    expect(
      within(screen.getByRole('region', { name: '2. Host it' })).getByText(
        'Run the show.'
      )
    ).toBeTruthy()
  })

  it('renders the CTA link only when the cta prop is given', () => {
    const { unmount } = render(StepsAccordion01, {
      props: { title: 'How it works', steps }
    })
    expect(screen.queryByRole('link')).toBeNull()
    unmount()

    render(StepsAccordion01, {
      props: {
        title: 'How it works',
        steps,
        cta: { label: 'Apply to host', href: '/host' }
      }
    })
    expect(
      screen.getByRole('link', { name: 'Apply to host' }).getAttribute('href')
    ).toBe('/host')
  })

  it('lets titleClass override the heading defaults via cn()', () => {
    const { unmount } = render(StepsAccordion01, {
      props: { title: 'How it works', steps }
    })
    const heading = () => screen.getByRole('heading', { name: 'How it works' })
    expect(heading().classList.contains('text-3xl')).toBe(true)
    unmount()

    render(StepsAccordion01, {
      props: { title: 'How it works', steps, titleClass: 'text-6xl' }
    })
    expect(heading().classList.contains('text-6xl')).toBe(true)
    expect(heading().classList.contains('text-3xl')).toBe(false)
  })

  it('renders without error for an empty steps array', () => {
    render(StepsAccordion01, { props: { title: 'How it works', steps: [] } })
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
