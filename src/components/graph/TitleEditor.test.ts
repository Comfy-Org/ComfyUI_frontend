import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  useCanvasStore,
  useTitleEditorStore
} from '@/renderer/core/canvas/canvasStore'

import TitleEditor from './TitleEditor.vue'

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { canvas: { setDirty: vi.fn() } }
}))

vi.mock<unknown>(import('@/composables/element/useAbsolutePosition'), () => ({
  useAbsolutePosition: () => ({ style: ref({}), updatePosition: vi.fn() })
}))

describe('TitleEditor', () => {
  let canvas: LGraphCanvas
  let node: LGraphNode

  beforeEach(() => {
    canvas = fromPartial<LGraphCanvas>({
      allow_dragcanvas: true,
      ds: { scale: 1, offset: [0, 0] }
    })
    useCanvasStore().canvas = canvas
    node = new LGraphNode('Original title')
  })

  async function openEditorFor(target: LGraphNode) {
    render(TitleEditor)
    useTitleEditorStore().titleEditorTarget = target
    await nextTick()
    return userEvent.setup()
  }

  it('disables canvas dragging while the editor is open', async () => {
    await openEditorFor(node)

    expect(screen.getByRole('textbox')).toHaveValue('Original title')
    expect(canvas.allow_dragcanvas).toBe(false)
  })

  it('restores canvas dragging and discards changes when cancelled with Escape', async () => {
    const user = await openEditorFor(node)

    await user.type(screen.getByRole('textbox'), ' edited{Escape}')

    expect(canvas.allow_dragcanvas).toBe(true)
    expect(useTitleEditorStore().titleEditorTarget).toBeNull()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(node.title).toBe('Original title')
  })

  it('restores canvas dragging and applies the new title on Enter', async () => {
    const user = await openEditorFor(node)

    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Renamed{Enter}')

    expect(canvas.allow_dragcanvas).toBe(true)
    expect(useTitleEditorStore().titleEditorTarget).toBeNull()
    expect(node.title).toBe('Renamed')
  })

  it('restores the previous drag setting rather than forcing it on', async () => {
    canvas.allow_dragcanvas = false
    const user = await openEditorFor(node)

    await user.type(screen.getByRole('textbox'), '{Escape}')

    expect(canvas.allow_dragcanvas).toBe(false)
  })
})
