// @vitest-environment happy-dom
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HeaderMain from './HeaderMain.vue'

const hoisted = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined
}))

vi.mock(import('../../../scripts/posthog.ts'), async () => {
  const { ref } = await import('vue')
  const flag = ref(false)
  hoisted.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock<unknown>(import('../../workshop/HeaderAccount.vue'), async () => {
  const { defineComponent, h } = await import('vue')
  return {
    __esModule: true,
    default: defineComponent({
      name: 'HeaderAccountStub',
      render: () => h('div', { 'data-testid': 'header-account' })
    })
  }
})

beforeEach(() => {
  hoisted.flag!.value = false
})

describe('HeaderMain workshop gating', () => {
  it.for([
    { workshopInBuild: false, modelsAvailable: false },
    { workshopInBuild: true, modelsAvailable: true }
  ])(
    'renders Models availability as $modelsAvailable when workshopInBuild is $workshopInBuild',
    ({ workshopInBuild, modelsAvailable }) => {
      render(HeaderMain, { props: { workshopInBuild } })

      expect(screen.queryByRole('link', { name: /^Models\b/i }) !== null).toBe(
        modelsAvailable
      )
    }
  )

  it('mounts no account island while the flag is off', () => {
    render(HeaderMain)

    expect(screen.queryByTestId('header-account')).toBeNull()
  })

  it('mounts the account island when the flag turns on after mount', async () => {
    render(HeaderMain)
    expect(screen.queryByTestId('header-account')).toBeNull()

    hoisted.flag!.value = true

    await waitFor(() => {
      expect(
        screen.getAllByTestId('header-account').length,
        'a one-shot flag read at the header layer would strand every flag-on visitor signed out'
      ).toBeGreaterThan(0)
    })
  })

  it('mounts the account island in the mobile row as well as the desktop row', async () => {
    hoisted.flag!.value = true
    render(HeaderMain)

    await waitFor(() => {
      expect(
        within(screen.getByTestId('mobile-nav-cta')).getByTestId(
          'header-account'
        ),
        'the desktop row is hidden below lg, so a phone would have no sign-in, account, or sign-out'
      ).toBeTruthy()
    })
    expect(
      within(screen.getByTestId('desktop-nav-cta')).getByTestId(
        'header-account'
      )
    ).toBeTruthy()
  })
})
