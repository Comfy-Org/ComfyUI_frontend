// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import {
  EXISTING_CREDITS,
  useMockSession
} from '../../composables/useMockSession'
import WorkshopSignIn from './WorkshopSignIn.vue'

const assign = vi.fn()

function mountSignIn(search = '') {
  vi.stubGlobal('location', { search, assign })
  let api!: ReturnType<typeof useMockSession>
  render(
    defineComponent({
      setup() {
        api = useMockSession()
        api.signOut()
        return () => h(WorkshopSignIn)
      }
    })
  )
  return api
}

const credits = (api: ReturnType<typeof useMockSession>) =>
  api.session.value.status === 'signedIn'
    ? api.session.value.account.credits
    : undefined

describe('WorkshopSignIn', () => {
  beforeEach(() => {
    localStorage.clear()
    assign.mockReset()
  })

  it('signs an existing account in through a provider and returns', async () => {
    const user = userEvent.setup()
    const api = mountSignIn('?return=/workshop/models/kling-o3/')

    await user.click(screen.getByTestId('sign-in-github'))
    expect(credits(api)).toBe(EXISTING_CREDITS)
    expect(assign).toHaveBeenCalledWith('/workshop/models/kling-o3/')
  })

  it('creates an empty account from sign-up mode and falls back to the catalog', async () => {
    const user = userEvent.setup()
    const api = mountSignIn('?return=https://evil.example')

    await user.click(screen.getByTestId('sign-in-switch-signup'))
    expect(screen.getByTestId('workshop-sign-in').dataset.mode).toBe('signUp')
    await user.click(screen.getByTestId('sign-in-google'))
    expect(credits(api)).toBe(0)
    expect(assign).toHaveBeenCalledWith('/workshop')
  })

  it('submits the email form only once both fields are filled', async () => {
    const user = userEvent.setup()
    const api = mountSignIn()

    await user.click(screen.getByTestId('sign-in-use-email'))
    const submit = screen.getByTestId('sign-in-submit')
    expect(submit.hasAttribute('disabled')).toBe(true)

    await user.type(screen.getByTestId('sign-in-email'), 'ada@example.com')
    await user.type(screen.getByTestId('sign-in-password'), 'secret')
    expect(submit.hasAttribute('disabled')).toBe(false)

    await user.click(submit)
    expect(credits(api)).toBe(EXISTING_CREDITS)

    await user.click(screen.getByTestId('sign-in-back-to-social'))
    expect(screen.getByTestId('sign-in-github')).toBeTruthy()
  })
})
