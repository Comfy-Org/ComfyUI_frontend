import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import type { Positionable } from '@/lib/litegraph/src/litegraph'
import { toGroupId } from '@/types/groupId'

function createMockPositionable(): Positionable {
  return fromPartial<Positionable>({ id: toGroupId(1), pos: [0, 0] })
}

const mockCanvasStore = vi.hoisted<{ selectedItems: Positionable[] }>(() => ({
  selectedItems: []
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LGraphCanvas: {
    node_colors: {
      red: { bgcolor: '#ff0000' },
      green: { bgcolor: '#00ff00' },
      blue: { bgcolor: '#0000ff' }
    }
  },
  LiteGraph: {
    NODE_DEFAULT_BGCOLOR: '#353535'
  },
  isColorable: vi.fn(() => true)
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ activeWorkflow: null })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore
}))

vi.mock('@/utils/colorUtil', () => ({
  adjustColor: vi.fn((color: string) => color + '_light')
}))

vi.mock('@/utils/litegraphUtil', () => ({
  getItemsColorOption: vi.fn(() => null),
  isLGraphNode: vi.fn((item) => item?.type === 'LGraphNode'),
  isLGraphGroup: vi.fn((item) => item?.type === 'LGraphGroup'),
  isReroute: vi.fn(() => false)
}))

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

  beforeEach(() => {
    mockCanvasStore.selectedItems = []
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
    mockCanvasStore.selectedItems = [createMockPositionable()]
    renderComponent()
    expect(screen.getByTestId('color-picker-button')).toBeInTheDocument()
  })

  it('should toggle color picker visibility on button click', async () => {
    mockCanvasStore.selectedItems = [createMockPositionable()]
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
})
