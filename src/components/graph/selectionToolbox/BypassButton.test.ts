import { createPinia, setActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

function getMockLGraphNode(): LGraphNode {
  return createMockLGraphNode({ type: 'TestNode' })
}

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => true)
}))

describe('BypassButton', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let commandStore: ReturnType<typeof useCommandStore>

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        commands: {
          Comfy_Canvas_ToggleSelectedNodes_Bypass: {
            label: 'Toggle bypass mode'
          }
        }
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    commandStore = useCommandStore()

    vi.clearAllMocks()
  })

  function renderComponent() {
    const user = userEvent.setup()

    render(BypassButton, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        stubs: {
          'i-lucide:ban': true
        }
      }
    })

    return { user }
  }

  it('should render bypass button', () => {
    canvasStore.selectedItems = [getMockLGraphNode()]
    renderComponent()
    expect(screen.getByTestId('bypass-button')).toBeInTheDocument()
  })

  it('should have correct test id', () => {
    canvasStore.selectedItems = [getMockLGraphNode()]
    renderComponent()
    expect(screen.getByTestId('bypass-button')).toBeInTheDocument()
  })

  it('should execute bypass command when clicked', async () => {
    canvasStore.selectedItems = [getMockLGraphNode()]
    const executeSpy = vi.spyOn(commandStore, 'execute').mockResolvedValue()

    const { user } = renderComponent()
    await user.click(screen.getByTestId('bypass-button'))

    expect(executeSpy).toHaveBeenCalledWith(
      'Comfy.Canvas.ToggleSelectedNodes.Bypass'
    )
  })

  it('should show bypassed styling when node is bypassed', async () => {
    const bypassedNode = Object.assign(getMockLGraphNode(), {
      mode: LGraphEventMode.BYPASS
    })
    canvasStore.selectedItems = [bypassedNode]
    vi.spyOn(commandStore, 'execute').mockResolvedValue()
    const { user } = renderComponent()

    await user.click(screen.getByTestId('bypass-button'))
    await nextTick()

    expect(screen.getByTestId('bypass-button')).toBeInTheDocument()
  })

  it('should handle multiple selected items', () => {
    vi.spyOn(commandStore, 'execute').mockResolvedValue()
    canvasStore.selectedItems = [getMockLGraphNode(), getMockLGraphNode()]
    renderComponent()
    expect(screen.getByTestId('bypass-button')).toBeInTheDocument()
  })
})
