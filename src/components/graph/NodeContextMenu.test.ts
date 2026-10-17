import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import {
  showNodeOptions,
  toggleNodeOptions
} from '@/composables/graph/useMoreOptionsMenu'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import NodeContextMenu from './NodeContextMenu.vue'

const i18n = createI18n({ legacy: false, locale: 'en' })

describe('NodeContextMenu', () => {
  beforeEach(() => {
    useCanvasStore().canvas = fromPartial({
      canvas: document.createElement('canvas'),
      ds: { scale: 1, offset: [0, 0] }
    })
  })

  it('opens through the registered instance', async () => {
    render(NodeContextMenu, { global: { plugins: [i18n] } })
    const event = new PointerEvent('contextmenu', {
      bubbles: true,
      button: 2,
      clientX: 100,
      clientY: 120
    })

    showNodeOptions(event)

    expect(await screen.findByRole('menu')).toBeVisible()
  })

  it('refreshes options when toggled open', async () => {
    render(NodeContextMenu, { global: { plugins: [i18n] } })
    const event = new MouseEvent('click', {
      bubbles: true,
      clientX: 100,
      clientY: 120
    })

    toggleNodeOptions(event)

    expect(await screen.findByRole('menu')).toBeVisible()
    expect(
      screen.getByRole('menuitem', { name: 'contextMenu.Rename' })
    ).toBeVisible()
  })
})
