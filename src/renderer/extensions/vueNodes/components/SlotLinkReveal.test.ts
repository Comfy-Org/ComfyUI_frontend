import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import {
  clearRootLinkReveals,
  isLinkRevealed
} from '@/lib/litegraph/src/canvas/linkRevealState'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { app } from '@/scripts/app'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkStore } from '@/stores/linkStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import InputSlot from './InputSlot.vue'
import OutputSlot from './OutputSlot.vue'

vi.mock(import('@/scripts/app'))

vi.mock(
  import('@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'),
  () => ({
    useSlotLinkInteraction: () => ({
      onClick: vi.fn(),
      onDoubleClick: vi.fn(),
      onPointerDown: vi.fn()
    })
  })
)

const SCOPE = {
  rootGraphId: toRootGraphId('root-a'),
  owningGraphId: toOwningGraphId('root-a')
}

beforeEach(() => {
  assert.exists(app.canvas.graph)
  app.canvas.graph.id = 'root-a'
})

afterEach(() => {
  clearRootLinkReveals(SCOPE.rootGraphId)
})

describe('slot reveal error recovery', () => {
  it.for([
    ['input', InputSlot],
    ['output', OutputSlot]
  ] as const)(
    'clears the hovered %s slot reveal on a descendant render error',
    async ([, Component]) => {
      const user = userEvent.setup()
      const error = new Error('Connection dot failed to render')
      const reportError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const failRender = ref(false)
      const SlotConnectionDot = defineComponent(() => () => {
        if (failRender.value) throw error
        return h('span', 'Connection dot')
      })
      const linkId = toLinkId(1)
      useLinkStore().registerLink(SCOPE, {
        id: linkId,
        graphId: SCOPE.owningGraphId,
        originNodeId: toNodeId(1),
        originSlot: 0,
        targetNodeId: toNodeId(2),
        targetSlot: 0,
        type: 'MODEL'
      })
      useLinkPresentationStore().patch(SCOPE, linkId, { hidden: true })

      render(Component, {
        props: {
          nodeId: toNodeId(Component === InputSlot ? 2 : 1),
          index: 0,
          slotData: {
            name: 'model',
            type: 'MODEL',
            boundingRect: [0, 0, 0, 0]
          }
        },
        global: {
          plugins: [
            createI18n({
              legacy: false,
              locale: 'en',
              messages: { en: enMessages }
            })
          ],
          directives: { tooltip: {} },
          stubs: { SlotConnectionDot }
        }
      })
      await user.hover(screen.getByText('Connection dot'))
      expect(isLinkRevealed(SCOPE.rootGraphId, linkId)).toBe(true)
      vi.mocked(app.canvas.setDirty).mockClear()

      failRender.value = true
      await nextTick()

      expect(screen.getByText('⚠️')).toBeInTheDocument()
      expect(isLinkRevealed(SCOPE.rootGraphId, linkId)).toBe(false)
      expect(app.canvas.setDirty).toHaveBeenCalledWith(false, true)
      expect(reportError).toHaveBeenCalledWith(error)
    }
  )
})
