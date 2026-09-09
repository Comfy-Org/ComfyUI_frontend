import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import PasswordRules from './PasswordRules.vue'

const copy = {
  requirements: 'Password requirements',
  length: 'Must be between 8 and 32 characters',
  uppercase: 'Must contain at least one uppercase letter',
  lowercase: 'Must contain at least one lowercase letter',
  number: 'Must contain at least one number',
  special: 'Must contain at least one special character'
}

describe('PasswordRules', () => {
  it('lists every rule and marks only the unmet ones', () => {
    render(PasswordRules, { props: { password: 'short', copy } })

    expect(screen.getByText('Password requirements:')).toBeTruthy()
    expect(
      screen.getByText(copy.length).classList.contains('text-red-500')
    ).toBe(true)
    expect(
      screen.getByText(copy.uppercase).classList.contains('text-red-500')
    ).toBe(true)
    expect(
      screen.getByText(copy.lowercase).classList.contains('text-red-500')
    ).toBe(false)
  })

  it('clears every mark once the password satisfies all rules', () => {
    render(PasswordRules, { props: { password: 'Sup3r-secret', copy } })

    for (const item of screen.getAllByRole('listitem')) {
      expect(item.classList.contains('text-red-500')).toBe(false)
    }
  })
})
