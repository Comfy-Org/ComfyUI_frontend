import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'

import BrandButton from './BrandButton.vue'

it('renders enabled links without a disabled attribute', () => {
  render(BrandButton, { props: { href: '/x' }, slots: { default: 'Continue' } })
  expect(screen.getByRole('link', { name: 'Continue' })).not.toHaveAttribute(
    'disabled'
  )
})

it('renders disabled link actions as disabled buttons without a destination', () => {
  render(BrandButton, {
    props: { href: '/x', disabled: true },
    slots: { default: 'Continue' }
  })
  const button = screen.getByRole('button', { name: 'Continue' })
  expect(button).toBeDisabled()
  expect(button).not.toHaveAttribute('href')
  expect(button).toHaveClass(
    'disabled:opacity-50',
    'disabled:cursor-not-allowed'
  )
})
