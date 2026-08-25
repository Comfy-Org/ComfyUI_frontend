import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import AgentPaywallCard from './AgentPaywallCard.vue'

describe('AgentPaywallCard visual contract', () => {
  it('keeps the Figma card width and CTA treatments', () => {
    render(AgentPaywallCard, {
      attrs: { 'aria-label': 'Usage limit card' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByLabelText('Usage limit card')).toHaveClass(
      'w-full',
      'max-w-[372px]'
    )
    expect(screen.getByRole('button', { name: 'Add credits' })).toHaveClass(
      'bg-transparent',
      'text-base-foreground'
    )
    expect(
      screen.getByRole('button', { name: 'Upgrade subscription' })
    ).toHaveClass('bg-base-foreground', 'text-base-background')
  })
})
