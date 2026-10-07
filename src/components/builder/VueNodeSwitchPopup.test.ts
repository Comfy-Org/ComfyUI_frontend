import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { registerBuiltInInterruptionSources } from '@/platform/interruptions/registerBuiltInSources'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useDialogStore } from '@/stores/dialogStore'

import VueNodeSwitchPopup from './VueNodeSwitchPopup.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const POPUP = 'linear-vue-node-switch-popup'

function renderPopup() {
  registerBuiltInInterruptionSources()
  return render(VueNodeSwitchPopup, { global: { plugins: [i18n] } })
}

describe('VueNodeSwitchPopup', () => {
  it('stays hidden until the switch is announced', () => {
    renderPopup()

    expect(screen.queryByTestId(POPUP)).not.toBeInTheDocument()
  })

  it('shows once the switch is announced', async () => {
    renderPopup()

    useAppModeStore().showVueNodeSwitchPopup = true
    await nextTick()

    expect(screen.getByTestId(POPUP)).toBeInTheDocument()
  })

  it('steps aside for node selection mode and returns after', async () => {
    useAppModeStore().showVueNodeSwitchPopup = true
    renderPopup()
    const canvasStore = useCanvasStore()

    canvasStore.isPickingNodes = true
    await nextTick()
    expect(screen.queryByTestId(POPUP)).not.toBeInTheDocument()

    canvasStore.isPickingNodes = false
    await nextTick()
    expect(screen.getByTestId(POPUP)).toBeInTheDocument()
  })

  it('waits behind an open dialog', async () => {
    useAppModeStore().showVueNodeSwitchPopup = true
    renderPopup()
    const dialogStore = useDialogStore()

    dialogStore.showDialog({ key: 'settings', component: {} })
    await nextTick()
    expect(screen.queryByTestId(POPUP)).not.toBeInTheDocument()

    dialogStore.closeDialog({ key: 'settings' })
    await nextTick()
    expect(screen.getByTestId(POPUP)).toBeInTheDocument()
  })
})
