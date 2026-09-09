// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { useMockSession } from '../../../composables/useMockSession'
import { usePrototypeTweaks } from '../../../composables/usePrototypeTweaks'
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

  it('shows an empty balance as zero and opens the credits flow', async () => {
    const user = userEvent.setup()
    mountAccount('new')
    await nextTick()

    expect(screen.getByTestId('header-credits').textContent?.trim()).toBe('0')

    await user.click(screen.getByTestId('header-account'))
    await user.click(await screen.findByTestId('account-plan'))
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

describe('HeaderAccount — who can buy, and by which rail', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('gives a member no purchase route at all', async () => {
    const user = userEvent.setup()
    const api = mountAccount('existing')
    api.setRole('member')
    await nextTick()

    await user.click(screen.getByTestId('header-account'))
    // The header pill still carries the balance — the member workspace is the
    // empty one — so repeating it in the menu under an action they cannot take
    // is the thing being removed.
    expect(screen.queryByTestId('account-plan')).toBeNull()
    expect(screen.getByTestId('header-credits').textContent).toContain('0')
  })

  it('links out to platform on the MVP rail instead of opening the dialog', async () => {
    const user = userEvent.setup()
    let tweaks!: ReturnType<typeof usePrototypeTweaks>
    render(
      defineComponent({
        setup() {
          useMockSession().signIn('existing')
          tweaks = usePrototypeTweaks()
          tweaks.topUpRail.value = 'platform'
          return () => h(HeaderAccount)
        }
      })
    )
    await nextTick()

    await user.click(screen.getByTestId('header-account'))
    // as-child merges the row into the anchor, so the row *is* the link.
    const row = await screen.findByTestId('account-plan')
    expect(row.tagName).toBe('A')
    expect(row.getAttribute('href')).toBe(
      'https://platform.comfy.org/billing?workspace=Ada%27s+Studio'
    )
    expect(row.getAttribute('target')).toBe('_blank')
    expect(screen.queryByTestId('buy-credits-dialog')).toBeNull()
    tweaks.topUpRail.value = 'in-place'
  })
})
