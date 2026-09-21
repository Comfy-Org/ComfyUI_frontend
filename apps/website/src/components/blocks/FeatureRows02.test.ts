// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import FeatureRows02 from './FeatureRows02.vue'

type FeatureRowsProps = ComponentProps<typeof FeatureRows02>

const requiredProps = {
  heading: 'One ComfyUI build for the whole team',
  rows: [
    {
      id: 'packaging',
      term: 'Environment packaging',
      description:
        'Replace one-off install scripts, dependency matrices, and machine-specific fixes with one versioned build.'
    },
    {
      id: 'governance',
      term: 'Node governance',
      description: 'Pin and approve the nodes included in each build.'
    }
  ]
} satisfies FeatureRowsProps

function renderFeatureRows(props: Partial<FeatureRowsProps> = {}) {
  return render(FeatureRows02, {
    props: { ...requiredProps, ...props }
  })
}

describe('FeatureRows02', () => {
  it('renders the heading and each row term with its description', () => {
    renderFeatureRows()

    expect(
      screen.getByText('One ComfyUI build for the whole team')
    ).toBeTruthy()
    expect(screen.getByText('Environment packaging')).toBeTruthy()
    expect(
      screen.getByText(
        'Replace one-off install scripts, dependency matrices, and machine-specific fixes with one versioned build.'
      )
    ).toBeTruthy()
    expect(screen.getByText('Node governance')).toBeTruthy()
    expect(
      screen.getByText('Pin and approve the nodes included in each build.')
    ).toBeTruthy()
  })

  it('omits the footnote by default', () => {
    renderFeatureRows()

    expect(screen.queryByText('The graph stays flexible.')).toBeNull()
  })

  it('renders the footnote when provided', () => {
    renderFeatureRows({ footnote: 'The graph stays flexible.' })

    expect(screen.getByText('The graph stays flexible.')).toBeTruthy()
  })

  it('omits the heading element when no heading is provided', () => {
    renderFeatureRows({ heading: undefined })

    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    expect(screen.getByText('Environment packaging')).toBeTruthy()
  })
})
