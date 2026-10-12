import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SectionHeading from './SectionHeading.vue'

describe('SectionHeading', () => {
  it('gives the section a heading and one line beneath it', () => {
    render(SectionHeading, {
      props: {
        title: 'Inside the workflow',
        subtitle: 'A read-only preview of the source template.'
      }
    })
    expect(
      screen.getByRole('heading', { level: 2, name: 'Inside the workflow' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('A read-only preview of the source template.')
    ).toBeInTheDocument()
  })

  it('names the heading so a panel can point at it', () => {
    render(SectionHeading, {
      props: {
        title: 'Call this model from your code',
        subtitle: 'Call Comfy Router with your Playground inputs.',
        titleId: 'workflow-api-heading'
      }
    })
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'workflow-api-heading'
    )
  })
})
