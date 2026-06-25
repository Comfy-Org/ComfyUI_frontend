import { cleanup, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  afterEach,
  afterAll
} from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import { createTestingPinia } from '@pinia/testing'

import { RenderShape } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import NodeFooter from '@/renderer/extensions/vueNodes/components/NodeFooter.vue'

vi.hoisted(() => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString()
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      }
    }
  })()
  vi.stubGlobal('localStorage', localStorageMock)
})

const mockSettingsDialogShow = vi.fn()
vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({
    show: mockSettingsDialogShow
  })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => {
  const isDraggingVueNodes = ref(false)
  return { layoutStore: { isDraggingVueNodes } }
})

const { layoutStore } = await import('@/renderer/core/layout/store/layoutStore')

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        enter: 'Enter',
        enterSubgraph: 'Enter Subgraph',
        error: 'Error'
      },
      rightSidePanel: {
        showAdvancedShort: 'Show Advanced',
        hideAdvancedShort: 'Hide Advanced',
        showAdvancedInputsButton: 'Show Advanced Inputs',
        hideAdvancedInputsButton: 'Hide Advanced Inputs'
      }
    }
  }
})

type Props = {
  isSubgraph: boolean
  hasAnyError: boolean
  showErrorsTabEnabled: boolean
  showAdvancedInputsButton?: boolean
  showAdvancedState?: boolean
  headerColor?: string
  shape?: RenderShape
}

const baseProps: Props = {
  isSubgraph: false,
  hasAnyError: false,
  showErrorsTabEnabled: false
}

function renderFooter(overrides: Partial<Props> = {}) {
  const pinia = createTestingPinia({ stubActions: false })
  return render(NodeFooter, {
    global: { plugins: [i18n, pinia, PrimeVue] },
    props: { ...baseProps, ...overrides }
  })
}

function allButtonClasses(container: Element): string {
  return within(container as HTMLElement)
    .queryAllByRole('button')
    .map((b) => b.className)
    .join(' ')
}

describe('NodeFooter', () => {
  afterEach(() => {
    cleanup()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  describe('rendering branches', () => {
    it('renders nothing when no relevant flags are set', () => {
      const { container } = renderFooter()
      expect(
        within(container as HTMLElement).queryAllByRole('button')
      ).toHaveLength(0)
    })

    it('renders error + enter tabs for subgraph with error (Case 1)', () => {
      renderFooter({
        isSubgraph: true,
        hasAnyError: true,
        showErrorsTabEnabled: true
      })
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.getByText('Enter')).toBeTruthy()
      expect(screen.getByTestId('subgraph-enter-button')).toBeTruthy()
    })

    it('renders error + advanced tabs for regular node with error (Case 1b)', () => {
      renderFooter({
        hasAnyError: true,
        showErrorsTabEnabled: true,
        showAdvancedInputsButton: true
      })
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.getByText('Show Advanced')).toBeTruthy()
    })

    it('swaps advanced label based on showAdvancedState (Case 1b)', () => {
      renderFooter({
        hasAnyError: true,
        showErrorsTabEnabled: true,
        showAdvancedState: true
      })
      expect(screen.getByText('Hide Advanced')).toBeTruthy()
    })

    it('renders error-only footer when no subgraph/advanced (Case 2)', () => {
      renderFooter({ hasAnyError: true, showErrorsTabEnabled: true })
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.queryByTestId('subgraph-enter-button')).toBeNull()
    })

    it('renders subgraph-only footer without errors (Case 3)', () => {
      renderFooter({ isSubgraph: true })
      expect(screen.getByText('Enter Subgraph')).toBeTruthy()
      expect(screen.queryByText('Error')).toBeNull()
    })

    it('renders advanced-only footer for regular node (Case 4, collapsed label)', () => {
      renderFooter({ showAdvancedInputsButton: true })
      expect(screen.getByText('Show Advanced Inputs')).toBeTruthy()
    })

    it('renders advanced-only footer for regular node (Case 4, expanded label)', () => {
      renderFooter({ showAdvancedState: true })
      expect(screen.getByText('Hide Advanced Inputs')).toBeTruthy()
    })
  })

  describe('emits', () => {
    let user: ReturnType<typeof userEvent.setup>

    beforeEach(() => {
      user = userEvent.setup()
    })

    it('emits openErrors when the error tab is clicked', async () => {
      const { emitted } = renderFooter({
        hasAnyError: true,
        showErrorsTabEnabled: true
      })
      await user.click(screen.getByText('Error'))
      expect(emitted()).toHaveProperty('openErrors')
    })

    it('emits enterSubgraph when the enter tab is clicked', async () => {
      const { emitted } = renderFooter({ isSubgraph: true })
      await user.click(screen.getByTestId('subgraph-enter-button'))
      expect(emitted()).toHaveProperty('enterSubgraph')
    })

    it('emits toggleAdvanced when the advanced tab is clicked', async () => {
      const { emitted } = renderFooter({ showAdvancedInputsButton: true })
      await user.click(screen.getByText('Show Advanced Inputs'))
      expect(emitted()).toHaveProperty('toggleAdvanced')
    })

    describe('drag-then-click suppression', () => {
      beforeEach(() => {
        layoutStore.isDraggingVueNodes.value = false
      })

      it('does not emit enterSubgraph when a node drag is in progress at pointerup', async () => {
        const { emitted } = renderFooter({ isSubgraph: true })
        layoutStore.isDraggingVueNodes.value = true
        await user.click(screen.getByTestId('subgraph-enter-button'))

        expect(emitted().enterSubgraph).toBeUndefined()
      })

      it('only suppresses the immediately following click, not later ones', async () => {
        const { emitted } = renderFooter({ isSubgraph: true })
        const button = screen.getByTestId('subgraph-enter-button')

        layoutStore.isDraggingVueNodes.value = true
        await user.click(button)
        expect(emitted().enterSubgraph).toBeUndefined()

        layoutStore.isDraggingVueNodes.value = false
        await user.click(button)
        expect(emitted()).toHaveProperty('enterSubgraph')
      })
    })
  })

  describe('shape-based radius classes (getBottomRadius)', () => {
    it('BOX shape renders no rounded-b* class on the single-tab footer', () => {
      const { container } = renderFooter({
        isSubgraph: true,
        shape: RenderShape.BOX
      })
      expect(allButtonClasses(container)).not.toMatch(/rounded-b/)
    })

    it('CARD shape emits rounded-br variant on the single-tab footer', () => {
      const { container } = renderFooter({
        isSubgraph: true,
        shape: RenderShape.CARD
      })
      const classes = allButtonClasses(container)
      expect(classes).toMatch(/rounded-br-\[17px\]/)
      expect(classes).not.toMatch(/rounded-b-\[/)
    })

    it('default shape emits rounded-b variant on the single-tab footer', () => {
      const { container } = renderFooter({ isSubgraph: true })
      expect(allButtonClasses(container)).toMatch(/rounded-b-\[17px\]/)
    })

    it('upgrades to 20px radius when the error tab is present', () => {
      const { container } = renderFooter({
        hasAnyError: true,
        showErrorsTabEnabled: true
      })
      expect(allButtonClasses(container)).toMatch(/rounded-b-\[20px\]/)
    })

    it('enter tab uses right-only rounding in dual-tab mode (Case 1)', () => {
      renderFooter({
        isSubgraph: true,
        hasAnyError: true,
        showErrorsTabEnabled: true
      })
      const enterBtn = screen.getByTestId('subgraph-enter-button')
      expect(enterBtn.className).toMatch(/rounded-br-\[20px\]/)
    })
  })

  describe('headerColor style', () => {
    it('applies backgroundColor to the enter button when headerColor is set', () => {
      renderFooter({ isSubgraph: true, headerColor: 'rgb(10, 20, 30)' })
      const enterBtn = screen.getByTestId('subgraph-enter-button')
      expect(enterBtn.getAttribute('style')).toMatch(
        /background-color:\s*rgb\(10,\s*20,\s*30\)/
      )
    })

    it('omits backgroundColor style when headerColor is missing', () => {
      renderFooter({ isSubgraph: true })
      const enterBtn = screen.getByTestId('subgraph-enter-button')
      expect(enterBtn.getAttribute('style') ?? '').not.toMatch(
        /background-color/
      )
    })
  })

  describe('advanced settings button', () => {
    let user: ReturnType<typeof userEvent.setup>

    beforeEach(() => {
      user = userEvent.setup()
      vi.clearAllMocks()
    })

    it('renders the gear settings button next to advanced inputs button when expanded', () => {
      renderFooter({ showAdvancedInputsButton: true, showAdvancedState: true })
      expect(screen.getByTestId('advanced-settings-button')).toBeTruthy()
    })

    it('opens settings dialog when clicked in legacy menu mode', async () => {
      renderFooter({ showAdvancedInputsButton: true, showAdvancedState: true })
      const settingStore = (
        await import('@/platform/settings/settingStore')
      ).useSettingStore()
      vi.mocked(settingStore.get).mockImplementation((key) => {
        if (key === 'Comfy.UseNewMenu') return 'Disabled'
        return false
      })

      const settingsBtn = screen.getByTestId('advanced-settings-button')
      await user.click(settingsBtn)

      expect(mockSettingsDialogShow).toHaveBeenCalledWith(
        undefined,
        'Comfy.Node.AlwaysShowAdvancedWidgets'
      )
    })

    it('opens right side settings panel when clicked in new menu mode', async () => {
      const deselectAllSpy = vi.fn()
      const originalCanvas = app.canvas
      app.canvas = {
        deselectAll: deselectAllSpy
      } as unknown as typeof app.canvas

      try {
        renderFooter({
          showAdvancedInputsButton: true,
          showAdvancedState: true
        })
        const settingStore = (
          await import('@/platform/settings/settingStore')
        ).useSettingStore()
        vi.mocked(settingStore.get).mockImplementation((key) => {
          if (key === 'Comfy.UseNewMenu') return 'Top'
          return false
        })

        const rightSidePanelStore = (
          await import('@/stores/workspace/rightSidePanelStore')
        ).useRightSidePanelStore()
        const openPanelSpy = vi.spyOn(rightSidePanelStore, 'openPanel')

        const settingsBtn = screen.getByTestId('advanced-settings-button')
        await user.click(settingsBtn)

        expect(deselectAllSpy).toHaveBeenCalledOnce()
        expect(openPanelSpy).toHaveBeenCalledWith('settings')
      } finally {
        app.canvas = originalCanvas
      }
    })
  })
})
