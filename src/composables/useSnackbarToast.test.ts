import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, provide } from 'vue'

import type { SnackbarToastApi } from './useSnackbarToast'
import { SnackbarToastKey, useSnackbarToast } from './useSnackbarToast'

const Consumer = defineComponent({
  setup() {
    const api = useSnackbarToast()
    return () =>
      h('div', { 'data-testid': 'consumer' }, [
        h('span', { 'data-testid': 'has-show' }, String(typeof api.show)),
        h('span', { 'data-testid': 'has-dismiss' }, String(typeof api.dismiss))
      ])
  }
})

describe('useSnackbarToast', () => {
  it('throws when no SnackbarToastProvider is in scope', () => {
    expect(() => render(Consumer)).toThrow(/SnackbarToastProvider/)
  })

  it('returns the injected api', () => {
    const api: SnackbarToastApi = {
      show: vi.fn(() => 'id-1'),
      dismiss: vi.fn()
    }
    const Provider = defineComponent({
      setup(_, { slots }) {
        provide(SnackbarToastKey, api)
        return () => slots.default?.()
      }
    })

    render(Provider, {
      slots: { default: () => h(Consumer) }
    })

    expect(screen.getByTestId('has-show').textContent).toBe('function')
    expect(screen.getByTestId('has-dismiss').textContent).toBe('function')
  })
})
