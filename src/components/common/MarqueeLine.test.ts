import { describe, expect, it } from 'vitest'

import { render, screen } from '@testing-library/vue'

import MarqueeLine from './MarqueeLine.vue'

describe(MarqueeLine, () => {
  it('renders slot content', () => {
    render(MarqueeLine, {
      slots: { default: 'Hello World' }
    })
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('renders content inside a span within the container', () => {
    render(MarqueeLine, {
      slots: { default: 'Test Text' }
    })
    const el = screen.getByText('Test Text')
    expect(el.tagName).toBe('SPAN')
  })
})
