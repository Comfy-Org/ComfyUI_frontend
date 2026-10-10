import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ButtonVariants } from '.'
import Button from './Button.vue'

describe('Button', () => {
  it.for<{ variant: ButtonVariants['variant']; brandYellow: boolean }>([
    { variant: 'default', brandYellow: true },
    { variant: 'secondary', brandYellow: false },
    { variant: 'secondaryOutline', brandYellow: false }
  ])(
    'keeps the brand yellow to the primary action: $variant uses it $brandYellow',
    ({ variant, brandYellow }) => {
      render(Button, { props: { variant }, slots: { default: 'Run' } })

      const restingClasses = [
        ...screen.getByRole('button', { name: 'Run' }).classList
      ].filter((token) => !token.includes(':'))

      expect(
        restingClasses.some((token) =>
          /^(bg|text)-primary-comfy-yellow/.test(token)
        )
      ).toBe(brandYellow)
    }
  )
})
