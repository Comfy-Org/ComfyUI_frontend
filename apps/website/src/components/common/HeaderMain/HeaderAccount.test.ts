// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { useMockSession } from '../../../composables/useMockSession'
import HeaderAccount from './HeaderAccount.vue'

function mountAccount(kind: 'existing' | 'new') {
  let api!: ReturnType<typeof useMockSession>
  render(
    defineComponent({
      setup() {
        api = useMockSession()
        api.signIn(kind)
        return () => h(HeaderAccount)
      }
    })
  )
  return api
}

describe('HeaderAccount', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the balance in the header and buys credits from the menu', async () => {
    const user = userEvent.setup()
    mountAccount('existing')
    await nextTick()

    expect(screen.getByTestId('header-credits').textContent).toContain('5,840')

    await user.click(screen.getByTestId('header-account'))
    await user.click(await screen.findByTestId('account-plan'))
    expect(await screen.findByTestId('buy-credits-dialog')).toBeTruthy()
  })

  it('offers an empty account the upgrade that opens the credits flow', async () => {
    const user = userEvent.setup()
    mountAccount('new')
    await nextTick()

    const chip = screen.getByTestId('header-credits')
    expect(chip.textContent).toContain('Upgrade')

    await user.click(chip)
    expect(await screen.findByTestId('buy-credits-dialog')).toBeTruthy()
  })

  it('switches workspace from the submenu', async () => {
    const user = userEvent.setup()
    const api = mountAccount('existing')
    await nextTick()

    await user.click(screen.getByTestId('header-account'))
    await user.click(await screen.findByTestId('account-workspace'))
    await user.click(await screen.findByTestId('account-workspace-Comfy team'))
    expect(
      api.session.value.status === 'signedIn' &&
        api.session.value.account.workspace
    ).toBe('Comfy team')
  })

  it('signs out back to the sign-in button', async () => {
    const user = userEvent.setup()
    mountAccount('existing')
    await nextTick()

    await user.click(screen.getByTestId('header-account'))
    await user.click(await screen.findByTestId('account-sign-out'))
    expect(await screen.findByTestId('header-sign-in')).toBeTruthy()
  })
})
