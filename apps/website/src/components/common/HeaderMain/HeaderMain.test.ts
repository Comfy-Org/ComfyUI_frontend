// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HeaderMain from './HeaderMain.vue'

const hoisted = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined
}))

vi.mock('../../../scripts/posthog.ts', async () => {
  const { ref } = await import('vue')
  const flag = ref(false)
  hoisted.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock('../../workshop/HeaderAccount.vue', async () => {
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
})
