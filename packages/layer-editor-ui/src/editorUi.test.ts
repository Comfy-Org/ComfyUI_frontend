import '@testing-library/jest-dom/vitest'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it, onTestFinished, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useLayerEditorSession } from '@comfyorg/layer-editor/vue'

import LayerEditorToolbar from './LayerEditorToolbar.vue'
import LayerPropertiesPanel from './LayerPropertiesPanel.vue'

function i18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        layerEditor: {
          selectTool: 'Select',
          handTool: 'Hand',
          zoom: 'Zoom',
          undo: 'Undo',
          redo: 'Redo',
          exportPsd: 'Export PSD',
          background: 'Background',
          dimensions: 'Dimensions',
          fill: 'Fill'
        },
        color: {
          hex: 'Hex',
          rgba: 'RGBA',
          hue: 'Hue',
          alpha: 'Alpha',
          red: 'Red',
          green: 'Green',
          blue: 'Blue',
          saturationBrightness: 'Saturation and brightness'
        },
        g: { color: 'Color' }
      }
    }
  })
}

it.for([
  { available: true, exporting: false, requests: [[]] },
  { available: false, exporting: false, requests: undefined },
  { available: true, exporting: true, requests: undefined }
])(
  'requests host export only when available=$available and exporting=$exporting',
  async ({ available, exporting, requests }) => {
    const session = useLayerEditorSession()
    session.glOk.value = available
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { emitted, unmount } = render(LayerEditorToolbar, {
      props: { session, exporting },
      global: { plugins: [i18n()] }
    })
    onTestFinished(() => {
      unmount()
      session.dispose()
    })

    await user.click(screen.getByRole('button', { name: 'Export PSD' }))

    expect(emitted('export-psd')).toEqual(requests)
  }
)

it('edits background color and alpha through the translated picker', async () => {
  const session = useLayerEditorSession()
  session.setBackgroundVisible(true)
  session.selectBackground()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { unmount } = render(LayerPropertiesPanel, {
    props: { session },
    global: { plugins: [i18n()] }
  })
  onTestFinished(() => {
    unmount()
    session.dispose()
  })

  await user.click(screen.getByRole('button', { name: '#ffffff 100%' }))
  const hex = screen.getByRole('textbox', { name: 'Hex' })
  await user.clear(hex)
  await user.paste('#ff0000')
  const alpha = screen.getByRole('spinbutton', { name: 'Alpha' })
  await user.clear(alpha)
  await user.type(alpha, '50')
  await user.tab()

  expect(session.backgroundLayer.value?.fill).toEqual({
    type: 'solid',
    color: '#ff0000'
  })
  expect(session.backgroundLayer.value?.opacity).toBeCloseTo(128 / 255)
})
