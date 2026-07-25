import { createTestingPinia } from '@pinia/testing'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@/types/nodeId'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import enMessages from '@/locales/en/main.json'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'

import NodeHeader from './NodeHeader.vue'

const { toggleNodeSelectionAfterPointerUp } = vi.hoisted(() => ({
  toggleNodeSelectionAfterPointerUp: vi.fn()
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers',
  () => ({
    useNodeEventHandlers: () => ({ toggleNodeSelectionAfterPointerUp })
  })
)

const makeNodeData = (overrides: Partial<VueNodeData> = {}): VueNodeData => ({
  id: toNodeId('1'),
  title: 'KSampler',
  type: 'KSampler',
  mode: 0,
  selected: false,
  executing: false,
  widgets: [],
  inputs: [],
  outputs: [],
  flags: { collapsed: false },
  ...overrides
})

const setupMockStores = () => {
  const pinia = createTestingPinia({ stubActions: false })
  setActivePinia(pinia)

  const settingStore = useSettingStore()
  const nodeDefStore = useNodeDefStore()

  // Mock tooltip delay setting
  vi.spyOn(settingStore, 'get').mockImplementation(
    <K extends keyof Settings>(key: K): Settings[K] => {
      switch (key) {
        case 'Comfy.EnableTooltips':
          return true as Settings[K]
        case 'LiteGraph.Node.TooltipDelay':
          return 500 as Settings[K]
        default:
          return undefined as Settings[K]
      }
    }
  )

  // Mock node definition store
  const baseMockNodeDef: ComfyNodeDef = {
    name: 'KSampler',
    display_name: 'KSampler',
    category: 'sampling',
    python_module: 'test_module',
    description: 'Advanced sampling node for diffusion models',
    input: {
      required: {
        model: ['MODEL', {}],
        positive: ['CONDITIONING', {}],
        negative: ['CONDITIONING', {}]
      },
      optional: {},
      hidden: {}
    },
    output: ['LATENT'],
    output_is_list: [false],
    output_name: ['samples'],
    output_node: false,
    deprecated: false,
    experimental: false
  }

  const mockNodeDef = new ComfyNodeDefImpl(baseMockNodeDef)

  vi.spyOn(nodeDefStore, 'nodeDefsByName', 'get').mockReturnValue({
    KSampler: mockNodeDef
  })

  return { settingStore, nodeDefStore, pinia }
}

const createGlobalConfig = () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  const { pinia } = setupMockStores()

  const tooltipDirective = {
    mounted: vi.fn(),
    updated: vi.fn(),
    unmounted: vi.fn()
  }

  return {
    tooltipDirective,
    global: {
      plugins: [PrimeVue, i18n, pinia],
      components: { InputText },
      directives: {
        tooltip: tooltipDirective
      }
    }
  }
}

const renderHeader = (
  props?: Partial<ComponentProps<typeof NodeHeader>>,
  { selectionModeActive = false }: { selectionModeActive?: boolean } = {}
) => {
  const { global, tooltipDirective } = createGlobalConfig()
  const onCollapse = vi.fn()
  const onUpdateTitle = vi.fn()
  const user = userEvent.setup()

  if (selectionModeActive) {
    useAgentNodeSelectionStore().isActive = true
  }

  const result = render(NodeHeader, {
    global,
    props: {
      nodeData: makeNodeData(),
      collapsed: false,
      onCollapse,
      'onUpdate:title': onUpdateTitle,
      ...props
    }
  })

  return { ...result, user, onCollapse, onUpdateTitle, tooltipDirective }
}

describe('NodeHeader.vue', () => {
  it('emits collapse when collapse button is clicked', async () => {
    const { user, onCollapse } = renderHeader()
    await user.click(screen.getByTestId('node-collapse-button'))
    expect(onCollapse).toHaveBeenCalled()
  })

  it('shows the current node title and updates when prop changes', async () => {
    const { rerender } = renderHeader({
      nodeData: makeNodeData({ title: 'Original' })
    })
    expect(screen.getByTestId('node-title').textContent).toContain('Original')

    await rerender({
      nodeData: makeNodeData({ title: 'Updated' }),
      collapsed: false
    })
    expect(screen.getByTestId('node-title').textContent).toContain('Updated')
  })

  it('allows renaming via double click and emits update:title on confirm', async () => {
    const { user, onUpdateTitle } = renderHeader({
      nodeData: makeNodeData({ title: 'Start' })
    })

    // Enter edit mode
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.dblClick(screen.getByTestId('node-header-1'))

    // Edit and confirm
    const input = screen.getByTestId('node-title-input')
    await user.clear(input)
    await user.type(input, 'My Custom Sampler')
    await user.keyboard('{Enter}')

    expect(onUpdateTitle).toHaveBeenCalledWith('My Custom Sampler')
  })

  it('cancels rename on escape and keeps previous title', async () => {
    const { user, onUpdateTitle } = renderHeader({
      nodeData: makeNodeData({ title: 'KeepMe' })
    })

    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.dblClick(screen.getByTestId('node-header-1'))
    const input = screen.getByTestId('node-title-input')
    await user.clear(input)
    await user.type(input, 'Should Not Save')
    await user.keyboard('{Escape}')

    expect(onUpdateTitle).not.toHaveBeenCalled()

    expect(screen.getByTestId('node-title').textContent).toContain('KeepMe')
  })

  it('renders correct chevron icon based on collapsed prop', async () => {
    const { rerender } = renderHeader({ collapsed: false })
    const collapseButton = screen.getByTestId('node-collapse-button')
    // eslint-disable-next-line testing-library/no-node-access
    const expandedIcon = collapseButton.querySelector('i')!
    expect(expandedIcon.classList).not.toContain('-rotate-90')

    await rerender({
      nodeData: makeNodeData(),
      collapsed: true
    })
    // eslint-disable-next-line testing-library/no-node-access
    const collapsedIcon = collapseButton.querySelector('i')!
    expect(collapsedIcon.classList).toContain('-rotate-90')
  })

  describe('Tooltips', () => {
    it('applies tooltip directive to node title with correct configuration', () => {
      const { tooltipDirective } = renderHeader({
        nodeData: makeNodeData({ type: 'KSampler' })
      })

      expect(screen.getByTestId('node-title')).toBeInTheDocument()
      expect(tooltipDirective.mounted).toHaveBeenCalled()
    })

    it('disables tooltip when editing is active', async () => {
      const { tooltipDirective } = renderHeader({
        nodeData: makeNodeData({ type: 'KSampler' })
      })

      tooltipDirective.updated.mockClear()

      // eslint-disable-next-line testing-library/prefer-user-event
      await fireEvent.dblClick(screen.getByTestId('node-header-1'))

      expect(tooltipDirective.updated).toHaveBeenCalled()
    })

    it('creates tooltip configuration when component mounts', () => {
      const { tooltipDirective } = renderHeader({
        nodeData: makeNodeData({ type: 'KSampler' })
      })

      expect(tooltipDirective.mounted).toHaveBeenCalled()
      const mountedCall = tooltipDirective.mounted.mock.calls[0]
      const binding = mountedCall[1]
      expect(binding.value).toBeDefined()
    })

    it('uses tooltip container from provide/inject', () => {
      const { tooltipDirective } = renderHeader({
        nodeData: makeNodeData({ type: 'KSampler' })
      })

      expect(tooltipDirective.mounted).toHaveBeenCalled()
      const mountedEl = tooltipDirective.mounted.mock.calls[0][0]
      expect(mountedEl).toBe(screen.getByTestId('node-title'))
    })
  })

  describe('node selection mode', () => {
    beforeEach(() => {
      toggleNodeSelectionAfterPointerUp.mockClear()
    })

    it('shows the collapse chevron and no checkbox when inactive', () => {
      renderHeader()

      expect(screen.getByTestId('node-collapse-button')).toBeInTheDocument()
      expect(
        screen.queryByTestId('node-selection-checkbox')
      ).not.toBeInTheDocument()
    })

    it('shows a selection checkbox instead of the chevron when active', () => {
      renderHeader(undefined, { selectionModeActive: true })

      expect(screen.getByTestId('node-selection-checkbox')).toBeInTheDocument()
      expect(
        screen.queryByTestId('node-collapse-button')
      ).not.toBeInTheDocument()
    })

    it('toggles node selection when the checkbox is clicked', async () => {
      const { user } = renderHeader(undefined, { selectionModeActive: true })

      await user.click(screen.getByTestId('node-selection-checkbox'))

      expect(toggleNodeSelectionAfterPointerUp).toHaveBeenCalledWith(
        toNodeId('1'),
        true
      )
    })

    it('disables double-click title editing while active', async () => {
      renderHeader(undefined, { selectionModeActive: true })

      // eslint-disable-next-line testing-library/prefer-user-event
      await fireEvent.dblClick(screen.getByTestId('node-header-1'))

      expect(screen.queryByTestId('node-title-input')).not.toBeInTheDocument()
    })

    it('stops pointerdown/pointerup from bubbling past the checkbox', async () => {
      renderHeader(undefined, { selectionModeActive: true })
      const onPointerDown = vi.fn()
      const onPointerUp = vi.fn()
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('pointerup', onPointerUp)

      const checkbox = screen.getByTestId('node-selection-checkbox')
      // eslint-disable-next-line testing-library/prefer-user-event
      await fireEvent.pointerDown(checkbox)
      // eslint-disable-next-line testing-library/prefer-user-event
      await fireEvent.pointerUp(checkbox)

      expect(onPointerDown).not.toHaveBeenCalled()
      expect(onPointerUp).not.toHaveBeenCalled()

      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointerup', onPointerUp)
    })
  })
})
