import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeaderSignInLink from './HeaderSignInLink.vue'

function renderLink(compact: boolean) {
  return render(HeaderSignInLink, {
    props: { href: '/login/', compact }
  })
}

describe('HeaderSignInLink', () => {
  it.for([{ compact: false }, { compact: true }])(
    'is still reachable by name when compact is $compact',
    ({ compact }) => {
      renderLink(compact)

      expect(
        screen.getByRole('link', { name: 'Sign in' }),
        'dropping the label for an icon would leave a screen reader an unnamed link'
      ).toHaveAttribute('href', '/login/')
    }
  )

  it.for([
    { compact: true, icon: true },
    { compact: false, icon: false }
  ])('draws the icon when compact is $compact', ({ compact, icon }) => {
    renderLink(compact)

    expect(
      screen.queryByTestId('sign-in-icon') !== null,
      'a compact control with neither word nor icon is a blank square'
    ).toBe(icon)
  })
})
