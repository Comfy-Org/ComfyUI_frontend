import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SocialAuthButtons from './SocialAuthButtons.vue'

const props = {
  googleLabel: 'Continue with Google',
  githubLabel: 'Continue with GitHub'
}

describe('SocialAuthButtons', () => {
  it('emits the provider whose button was clicked', async () => {
    const { emitted, getByRole } = render(SocialAuthButtons, { props })

    getByRole('button', { name: 'Continue with Google' }).click()
    getByRole('button', { name: 'Continue with GitHub' }).click()

    expect(emitted('google')).toHaveLength(1)
    expect(emitted('github')).toHaveLength(1)
  })

  it('emits nothing while disabled', () => {
    const { emitted, getByRole } = render(SocialAuthButtons, {
      props: { ...props, disabled: true }
    })

    getByRole('button', { name: 'Continue with Google' }).click()

    expect(emitted('google')).toBeUndefined()
  })
})
