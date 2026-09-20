import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SocialAuthButtons from './SocialAuthButtons.vue'

const props = {
  googleLabel: 'Continue with Google',
  githubLabel: 'Continue with GitHub'
}

describe('SocialAuthButtons', () => {
  it('emits only google when the google button is clicked', async () => {
    const { emitted } = render(SocialAuthButtons, { props })

    await userEvent.click(
      screen.getByRole('button', { name: 'Continue with Google' })
    )

    expect(emitted('google')).toHaveLength(1)
    expect(
      emitted('github'),
      'a click must not cross-fire the other provider'
    ).toBeUndefined()
  })

  it('emits only github when the github button is clicked', async () => {
    const { emitted } = render(SocialAuthButtons, { props })

    await userEvent.click(
      screen.getByRole('button', { name: 'Continue with GitHub' })
    )

    expect(emitted('github')).toHaveLength(1)
    expect(emitted('google')).toBeUndefined()
  })

  it('emits nothing while disabled', async () => {
    const { emitted } = render(SocialAuthButtons, {
      props: { ...props, disabled: true }
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Continue with Google' })
    )

    expect(emitted('google')).toBeUndefined()
  })
})
