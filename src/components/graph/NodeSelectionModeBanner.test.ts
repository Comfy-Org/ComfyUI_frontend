import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

import NodeSelectionModeBanner from './NodeSelectionModeBanner.vue'

vi.mock('@/renderer/core/canvas/useCanvasInteractions', () => ({
  useCanvasInteractions: () => ({ forwardEventToCanvas: vi.fn() })
}))

describe('NodeSelectionModeBanner', () => {
  it('shows the selection instructions and exits from the CTA', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useAgentNodeSelectionStore()
    store.isActive = true
    store.isBannerVisible = true

    render(NodeSelectionModeBanner, {
      global: { plugins: [pinia, i18n] }
    })

    expect(screen.getByText('Add nodes from graph')).toBeVisible()
    expect(
      screen.getByText('Select one or many nodes to add as reference')
    ).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Exit mode' }))

    expect(store.isActive).toBe(false)
  })
})
