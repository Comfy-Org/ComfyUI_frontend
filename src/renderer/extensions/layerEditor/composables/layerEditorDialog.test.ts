import { render, screen, waitFor, within } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import {
  LayerEditorDialogContent,
  LayerEditorDialogHeader,
  layerEditorDialogProps
} from '@/renderer/extensions/layerEditor/composables/layerEditorDialog'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock<unknown>(
  import('@/renderer/extensions/layerEditor/components/dialog/TopBarHeader.vue'),
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
    const { defineComponent, h } = await import('vue')
    return {
      default: defineComponent(
        () => () =>
          h('div', [
            h('div', { id: 'layer-editor-header-actions', role: 'group' })
          ])
      )
    }
  }
)

vi.mock<unknown>(
  import('@/renderer/extensions/layerEditor/components/LayerEditorContent.vue'),
  async () => {
    const { defineComponent, h, Teleport } = await import('vue')
    return {
      __esModule: true,
      default: defineComponent(
        () => () =>
          h(Teleport, { to: '#layer-editor-header-actions', defer: true }, [
            h('button', 'Restore')
          ])
      )
    }
  }
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { close: 'Close' } } }
})

it('shows the header actions even when the header module loads last', async () => {
  render(GlobalDialog, { global: { plugins: [i18n] } })
  useDialogStore().showDialog({
    key: 'layer-editor-test',
    headerComponent: LayerEditorDialogHeader,
    component: LayerEditorDialogContent,
    dialogComponentProps: layerEditorDialogProps
  })

  const header = await screen.findByRole('group')
  await waitFor(() =>
    expect(
      within(header).getByRole('button', { name: 'Restore' })
    ).toBeInTheDocument()
  )
})
