import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import type { Positionable } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphCanvas,
  LGraphGroup
} from '@/lib/litegraph/src/litegraph'
import type { CanvasEventDetail } from '@/lib/litegraph/src/types/events'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSelectionStore } from '@/core/selection/selectionStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toGroupId } from '@/types/groupId'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/litegraphTestUtils'

function createMockPositionable(): Positionable {
  return fromPartial<Positionable>({ id: toGroupId(1), pos: [0, 0] })
}

vi.mock(import('@/scripts/app'))

describe('ColorPickerButton', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        color: {
          noColor: 'No Color',
          red: 'Red',
          green: 'Green',
          blue: 'Blue'
        }
      }
    }
  })

  function renderComponent() {
    const user = userEvent.setup()

    render(ColorPickerButton, {
      global: {
        plugins: [PrimeVue, i18n],
        directives: {
          tooltip: Tooltip
        }
      }
    })

    return { user }
  }

  it('should render when nodes are selected', () => {
    setCanvasSelection([createMockPositionable()])
    renderComponent()
    expect(screen.getByTestId('color-picker-button')).toBeInTheDocument()
  })

  it('should toggle color picker visibility on button click', async () => {
    setCanvasSelection([createMockPositionable()])
    const { user } = renderComponent()
    const button = screen.getByTestId('color-picker-button')

    expect(screen.queryByTestId('noColor')).not.toBeInTheDocument()

    await user.click(button)
    expect(screen.getByTestId('noColor')).toBeInTheDocument()
    expect(screen.getByTestId('red')).toBeInTheDocument()
    expect(screen.getByTestId('green')).toBeInTheDocument()
    expect(screen.getByTestId('blue')).toBeInTheDocument()

    await user.click(button)
    expect(screen.queryByTestId('noColor')).not.toBeInTheDocument()
  })

  it.for([
    { subType: 'after-change', color: '#533' },
    { subType: 'before-change', color: '#335' }
  ] as const)(
    'shows $color after $subType without reselection',
    async ({ subType, color }) => {
      const graph = new LGraph()
      const group = new LGraphGroup()
      group.color = LGraphCanvas.node_colors.blue.groupcolor
      graph.add(group)
      const canvas = createTestCanvas(
        graph,
        createMockCanvasRenderingContext2D()
      )
      document.body.append(canvas.canvas)
      onTestFinished(() => {
        canvas.unbindEvents()
        canvas.canvas.remove()
      })
      const store = useCanvasStore()
      store.canvas = canvas
      await nextTick()
      canvas.select(group)
      canvas.onSelectionChange = vi.fn()
      renderComponent()

      group.color = LGraphCanvas.node_colors.red.groupcolor
      document.dispatchEvent(
        new CustomEvent<CanvasEventDetail>('litegraph:canvas', {
          detail: { subType }
        })
      )
      await nextTick()

      expect(screen.getByTestId('color-picker-current-color')).toHaveStyle({
        color
      })
      expect({
        keys: useSelectionStore().selectedKeys(graphScopeOf(graph)),
        legacyItems: [...canvas.selectedItems],
        vueItems: store.selectedItems,
        selected: group.selected
      }).toEqual({
        keys: [`group:${group.id}`],
        legacyItems: [group],
        vueItems: [group],
        selected: true
      })
      expect(canvas.onSelectionChange).not.toHaveBeenCalled()
    }
  )
})
