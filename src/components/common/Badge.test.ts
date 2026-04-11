import { describe, expect, it } from 'vitest'

import { render, screen } from '@testing-library/vue'

import Badge from './Badge.vue'
import { badgeVariants } from './badge.variants'

describe('Badge', () => {
  it('renders label text', () => {
    render(Badge, { props: { label: 'NEW' } })
    expect(screen.getByText('NEW')).toBeInTheDocument()
  })

  it('renders numeric label', () => {
    render(Badge, { props: { label: 5 } })
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('defaults to dot variant when no label is provided', () => {
    const { container } = render(Badge)
    // eslint-disable-next-line testing-library/no-node-access -- dot badge has no text/role to query
    expect(container.firstElementChild).toHaveClass('size-2')
  })

  it('defaults to label variant when label is provided', () => {
    render(Badge, { props: { label: 'NEW' } })
    const el = screen.getByText('NEW')
    expect(el).toHaveClass('font-semibold')
    expect(el).toHaveClass('uppercase')
  })

  it('applies circle variant', () => {
    render(Badge, { props: { label: '3', variant: 'circle' } })
    expect(screen.getByText('3')).toHaveClass('size-3.5')
  })

  it('merges custom class via cn()', () => {
    render(Badge, { props: { label: 'Test', class: 'ml-2' } })
    const el = screen.getByText('Test')
    expect(el).toHaveClass('ml-2')
    expect(el).toHaveClass('rounded-full')
  })

  describe('twMerge preserves color alongside text-3xs font size', () => {
    it.each([
      ['default', 'text-white'],
      ['secondary', 'text-white'],
      ['warn', 'text-white'],
      ['danger', 'text-white'],
      ['contrast', 'text-base-background']
    ] as const)(
      '%s severity retains its text color class',
      (severity, expectedColor) => {
        const classes = badgeVariants({ severity, variant: 'label' })
        expect(classes).toContain(expectedColor)
        expect(classes).toContain('text-3xs')
      }
    )

    it('cn() does not clobber text-white when merging with text-3xs', () => {
      render(Badge, { props: { label: 'Test', severity: 'danger' } })
      const el = screen.getByText('Test')
      expect(el).toHaveClass('text-white')
      expect(el).toHaveClass('text-3xs')
    })
  })
})
