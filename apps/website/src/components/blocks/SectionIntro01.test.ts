// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SectionIntro01 from './SectionIntro01.vue'

describe('SectionIntro01', () => {
  it('renders the eyebrow, heading, and subtitle', () => {
    render(SectionIntro01, {
      props: {
        eyebrow: 'WAYS TO SCALE WITH COMFY',
        heading:
          'The open standard for visual AI, ready for your organization.',
        subtitle:
          'Keep your team focused on the Comfy Workflows that differentiate your business.'
      }
    })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'The open standard for visual AI, ready for your organization.'
      })
    ).toBeTruthy()
    expect(screen.getByText('WAYS TO SCALE WITH COMFY')).toBeTruthy()
    expect(
      screen.getByText(
        'Keep your team focused on the Comfy Workflows that differentiate your business.'
      )
    ).toBeTruthy()
  })

  it('renders the heading alone when eyebrow and subtitle are omitted', () => {
    render(SectionIntro01, {
      props: { heading: 'The open standard for visual AI.' }
    })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'The open standard for visual AI.'
      })
    ).toBeTruthy()
    expect(screen.queryByText('WAYS TO SCALE WITH COMFY')).toBeNull()
    expect(
      screen.queryByText(
        'Keep your team focused on the Comfy Workflows that differentiate your business.'
      )
    ).toBeNull()
  })

  it('renders the heading with the requested tag', () => {
    render(SectionIntro01, {
      props: {
        heading: 'The open standard for visual AI.',
        headingTag: 'h1'
      }
    })

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'The open standard for visual AI.'
      })
    ).toBeTruthy()
  })
})
