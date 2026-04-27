import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import RoleBadge from './RoleBadge.vue'

describe('RoleBadge', () => {
  it('renders the label text', () => {
    render(RoleBadge, { props: { label: 'PRO' } })
    expect(screen.getByText('PRO')).toBeInTheDocument()
  })

  it('renders as a span element', () => {
    const { container } = render(RoleBadge, { props: { label: 'OWNER' } })
    expect(container.firstElementChild?.tagName).toBe('SPAN')
  })

  it('updates rendered text when label changes', async () => {
    const { rerender } = render(RoleBadge, { props: { label: 'PRO' } })
    expect(screen.getByText('PRO')).toBeInTheDocument()
    await rerender({ label: 'OWNER' })
    expect(screen.getByText('OWNER')).toBeInTheDocument()
  })

  it('merges caller-provided classes onto root element', () => {
    const { container } = render(RoleBadge, {
      props: { label: 'PRO' },
      attrs: { class: 'shrink-0' }
    })
    expect(container.firstElementChild?.className).toContain('shrink-0')
  })
})
