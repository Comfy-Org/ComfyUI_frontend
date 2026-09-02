import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import BadgePill from './BadgePill.vue'

describe('BadgePill', () => {
  it('renders text content', () => {
    render(BadgePill, {
      props: { text: 'Test Badge' }
    })
    expect(screen.getByText('Test Badge')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(BadgePill, {
      props: { icon: 'icon-[lucide--coins]', text: 'Credits' }
    })
    expect(screen.getByTestId('badge-icon')).toHaveClass('icon-[lucide--coins]')
  })

  it('applies iconClass to icon', () => {
    render(BadgePill, {
      props: {
        icon: 'icon-[lucide--coins]',
        iconClass: 'text-amber-400'
      }
    })
    expect(screen.getByTestId('badge-icon')).toHaveClass('text-amber-400')
  })

  it('uses default border color when no borderStyle', () => {
    render(BadgePill, {
      props: { text: 'Default' }
    })
    expect(screen.getByTestId('badge-pill')).toHaveAttribute(
      'style',
      expect.stringContaining('border-color: var(--border-color)')
    )
  })

  it('applies solid border color when borderStyle is a color', () => {
    render(BadgePill, {
      props: { text: 'Colored', borderStyle: '#f59e0b' }
    })
    expect(screen.getByTestId('badge-pill')).toHaveAttribute(
      'style',
      expect.stringContaining('border-color: #f59e0b')
    )
  })

  it('applies gradient border when borderStyle contains linear-gradient', () => {
    const gradient = 'linear-gradient(90deg, #3186FF, #FABC12)'
    render(BadgePill, {
      props: { text: 'Gradient', borderStyle: gradient }
    })
    const element = screen.getByTestId('badge-pill') as HTMLElement
    expect(element.style.borderColor).toBe('transparent')
    expect(element.style.backgroundOrigin).toBe('border-box')
    expect(element.style.backgroundClip).toBe('padding-box, border-box')
  })

  it('applies filled style with background and text color', () => {
    render(BadgePill, {
      props: { text: 'Filled', borderStyle: '#f59e0b', filled: true }
    })
    const pill = screen.getByTestId('badge-pill')
    expect(pill).toHaveAttribute(
      'style',
      expect.stringContaining('border-color: #f59e0b')
    )
    expect(pill).toHaveAttribute(
      'style',
      expect.stringContaining('background-color: #f59e0b33')
    )
    expect(pill).toHaveAttribute(
      'style',
      expect.stringContaining('color: #f59e0b')
    )
  })

  it('has foreground text when not filled', () => {
    render(BadgePill, {
      props: { text: 'Not Filled', borderStyle: '#f59e0b' }
    })
    expect(screen.getByTestId('badge-pill')).toHaveClass('text-foreground')
  })

  it('does not have foreground text class when filled', () => {
    render(BadgePill, {
      props: { text: 'Filled', borderStyle: '#f59e0b', filled: true }
    })
    expect(screen.getByTestId('badge-pill')).not.toHaveClass('text-foreground')
  })

  it('renders slot content', () => {
    render(BadgePill, {
      slots: { default: 'Slot Content' }
    })
    expect(screen.getByText('Slot Content')).toBeInTheDocument()
  })

  it('paints a solid pill in the border colour with ink content', () => {
    render(BadgePill, {
      props: { text: 'Comfy Cloud', borderStyle: '#f0ff41', solid: true }
    })

    const pill = screen.getByTestId('badge-pill') as HTMLElement
    expect(pill.style.borderColor).toBe('#f0ff41')
    expect(pill.style.backgroundColor).toBe('#f0ff41')
    expect(pill).toHaveClass('text-primary-comfy-ink')
  })

  it('keeps the gradient border when solid is set on a dual-colour provider', () => {
    render(BadgePill, {
      props: {
        text: 'Gradient',
        borderStyle: 'linear-gradient(90deg, #3186FF, #FABC12)',
        solid: true
      }
    })

    const pill = screen.getByTestId('badge-pill') as HTMLElement
    expect(pill.style.borderColor).toBe('transparent')
    expect(pill.style.backgroundColor).toBe('')
  })

  it('leaves a solid pill unpainted without a border colour', () => {
    render(BadgePill, {
      props: { text: 'Plain', solid: true }
    })

    const pill = screen.getByTestId('badge-pill') as HTMLElement
    expect(pill.style.backgroundColor).toBe('')
    expect(pill).toHaveClass('text-foreground')
  })
})
