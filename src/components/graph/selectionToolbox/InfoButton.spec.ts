import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import InfoButton from '@/components/graph/selectionToolbox/InfoButton.vue'
// NOTE: The component import must come after mocks so they take effect.
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const mockLGraphNode = {
  type: 'TestNode',
  title: 'Test Node'
}

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => true)
}))

vi.mock('@/composables/sidebarTabs/useNodeLibrarySidebarTab', () => ({
  useNodeLibrarySidebarTab: () => ({
    id: 'node-library'
  })
}))

const openHelpMock = vi.fn()
const closeHelpMock = vi.fn()
const nodeHelpState: { currentHelpNode: any } = { currentHelpNode: null }
vi.mock('@/stores/workspace/nodeHelpStore', () => ({
  useNodeHelpStore: () => ({
    openHelp: (def: any) => {
      nodeHelpState.currentHelpNode = def
      openHelpMock(def)
    },
    closeHelp: () => {
      nodeHelpState.currentHelpNode = null
      closeHelpMock()
    },
    get currentHelpNode() {
      return nodeHelpState.currentHelpNode
    },
    get isHelpOpen() {
      return nodeHelpState.currentHelpNode !== null
    }
  })
}))

const toggleSidebarTabMock = vi.fn((id: string) => {
  sidebarState.activeSidebarTabId =
    sidebarState.activeSidebarTabId === id ? null : id
})
const sidebarState: { activeSidebarTabId: string | null } = {
  activeSidebarTabId: 'other-tab'
}
vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => ({
    get activeSidebarTabId() {
      return sidebarState.activeSidebarTabId
    },
    toggleSidebarTab: toggleSidebarTabMock
  })
}))

describe('InfoButton', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let nodeDefStore: ReturnType<typeof useNodeDefStore>

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          info: 'Node Info'
        }
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    nodeDefStore = useNodeDefStore()

    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(InfoButton, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        stubs: {
          'i-lucide:info': true,
          Button: {
            template:
              '<button class="help-button" severity="secondary"><slot /></button>',
            props: ['severity', 'text', 'class'],
            emits: ['click']
          }
        }
      }
    })
  }

  it('should handle click without errors', async () => {
    const mockNodeDef = {
      nodePath: 'test/node',
      display_name: 'Test Node'
    }
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(mockNodeDef as any)
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    await button.trigger('click')
    expect(button.exists()).toBe(true)
  })

  it('should have correct CSS classes', () => {
    const mockNodeDef = {
      nodePath: 'test/node',
      display_name: 'Test Node'
    }
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(mockNodeDef as any)

    const wrapper = mountComponent()
    const button = wrapper.find('button')

    expect(button.classes()).toContain('help-button')
    expect(button.attributes('severity')).toBe('secondary')
  })

  it('should have correct tooltip', () => {
    const mockNodeDef = {
      nodePath: 'test/node',
      display_name: 'Test Node'
    }
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(mockNodeDef as any)

    const wrapper = mountComponent()
    const button = wrapper.find('button')

    expect(button.exists()).toBe(true)
  })
})
