// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import WorkshopGate from './WorkshopGate.vue'

const enabled = ref(false)
vi.mock(import('../../scripts/posthog'), () => ({
  useWorkshopEnabled: () => enabled
}))

describe('WorkshopGate', () => {
  it('shows only the public fallback until enabled and restores it on revocation', async () => {
    render(WorkshopGate, {
      slots: {
        default: '<h1>Instant render</h1>',
        fallback: '<h1>Public models</h1>'
      }
    })
    expect(screen.getByRole('heading').textContent).toBe('Public models')
    enabled.value = true
    await nextTick()
    expect(screen.getByRole('heading').textContent).toBe('Instant render')
    enabled.value = false
    await nextTick()
    expect(screen.getByRole('heading').textContent).toBe('Public models')
  })
})
