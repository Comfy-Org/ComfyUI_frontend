import type { Mock } from 'vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

// Import after mocks
import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { ChangeTracker } from '@/scripts/changeTracker'
import { defaultGraph } from '@/scripts/defaultGraph'
import { createMockPositionable } from '@/utils/__tests__/litegraphTestUtils'

function createMockWorkflow(
  overrides: Partial<LoadedComfyWorkflow> = {}
): LoadedComfyWorkflow {
  const workflow = new ComfyWorkflow({
    path: 'workflows/color-picker-test.json',
    modified: 0,
    size: 0
  })

  const changeTracker = Object.assign(
    new ChangeTracker(workflow, structuredClone(defaultGraph)),
    {
      captureCanvasState: vi.fn() as Mock
    }
  )

  const workflowOverrides = {
    changeTracker,
    ...overrides
  } satisfies Partial<LoadedComfyWorkflow>

  return Object.assign(workflow, workflowOverrides) as LoadedComfyWorkflow
}

// Mock the litegraph module
vi.mock('@/lib/litegraph/src/litegraph', async () => {
  const actual = await vi.importActual('@/lib/litegraph/src/litegraph')
  return {
    ...actual,
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
  }
})

// Mock the colorUtil module
vi.mock('@/utils/colorUtil', () => ({
  adjustColor: vi.fn((color: string) => color + '_light')
}))

// Mock the litegraphUtil module
vi.mock('@/utils/litegraphUtil', () => ({
  getItemsColorOption: vi.fn(() => null),
  isLGraphNode: vi.fn((item) => item?.type === 'LGraphNode'),
  isLGraphGroup: vi.fn((item) => item?.type === 'LGraphGroup'),
  isReroute: vi.fn(() => false)
}))

describe('ColorPickerButton', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let workflowStore: ReturnType<typeof useWorkflowStore>

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
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    workflowStore = useWorkflowStore()

    // Set up default store state
    canvasStore.selectedItems = []

    // Mock workflow store
    workflowStore.activeWorkflow = createMockWorkflow()
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
    canvasStore.selectedItems = [createMockPositionable()]
    renderComponent()
    expect(screen.getByTestId('color-picker-button')).toBeInTheDocument()
  })

  it('should toggle color picker visibility on button click', async () => {
    canvasStore.selectedItems = [createMockPositionable()]
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
