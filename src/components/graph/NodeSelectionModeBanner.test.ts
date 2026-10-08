import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { getActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDialogStore } from '@/stores/dialogStore'

import NodeSelectionModeBanner from './NodeSelectionModeBanner.vue'

vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))

describe('NodeSelectionModeBanner', () => {
  it('shows the selection instructions and exits from the CTA', async () => {
    const pinia = getActivePinia()!
    const store = useCanvasStore()
    store.isPickingNodes = true

    render(NodeSelectionModeBanner, {
      global: { plugins: [pinia, i18n] }
    })

    expect(screen.getByText('Mention nodes from graph')).toBeVisible()
    expect(
      screen.getByText('Select one or many nodes to add as reference')
    ).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Exit mode' }))

    expect(store.isPickingNodes).toBe(false)
  })

  it('leaves Escape to an open dialog, then exits picking when it closes', async () => {
    const store = useCanvasStore()
    store.isPickingNodes = true
    render(NodeSelectionModeBanner, {
      global: { plugins: [getActivePinia()!, i18n] }
    })
    const dialogs = useDialogStore()
    dialogs.showDialog({ key: 'test', component: {} })

    await userEvent.keyboard('{Escape}')
    expect(store.isPickingNodes).toBe(true)

    dialogs.closeDialog({ key: 'test' })
    await userEvent.keyboard('{Escape}')
    expect(store.isPickingNodes).toBe(false)
  })
})
