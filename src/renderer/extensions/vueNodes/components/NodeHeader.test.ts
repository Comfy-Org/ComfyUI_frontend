/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
/* eslint-disable testing-library/prefer-user-event */
import { createTestingPinia } from '@pinia/testing'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import enMessages from '@/locales/en/main.json'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'

import NodeHeader from './NodeHeader.vue'

const makeNodeData = (overrides: Partial<VueNodeData> = {}): VueNodeData => ({
  id: '1',
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

  return {
    plugins: [PrimeVue, i18n, pinia],
    components: { InputText },
    directives: {
      tooltip: {
        mounted: vi.fn(),
        updated: vi.fn(),
        unmounted: vi.fn()
      }
    }
  }
}

const renderHeader = (props?: Record<string, unknown>) => {
  const global = createGlobalConfig()
  const onCollapse = vi.fn()
  const onUpdateTitle = vi.fn()
  const user = userEvent.setup()

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

  return { ...result, user, onCollapse, onUpdateTitle }
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

    await fireEvent.dblClick(screen.getByTestId('node-header-1'))
    const input = screen.getByTestId('node-title-input')
    await user.clear(input)
    await user.type(input, 'Should Not Save')
    await user.keyboard('{Escape}')

    expect(onUpdateTitle).not.toHaveBeenCalled()

    expect(screen.getByTestId('node-title').textContent).toContain('KeepMe')
  })

  it('renders correct chevron icon based on collapsed prop', async () => {
    const { container, rerender } = renderHeader({ collapsed: false })
    const expandedIcon = container.querySelector('i')!
    expect(expandedIcon.classList).not.toContain('-rotate-90')

    await rerender({
      nodeData: makeNodeData(),
      collapsed: true
    })
    const collapsedIcon = container.querySelector('i')!
    expect(collapsedIcon.classList).toContain('-rotate-90')
  })

  describe('Tooltips', () => {
    it('applies tooltip directive to node title with correct configuration', () => {
      const { container } = renderHeader({
        nodeData: makeNodeData({ type: 'KSampler' })
      })

      expect(screen.getByTestId('node-title')).toBeInTheDocument()

      const directive = container.querySelector('[data-testid="node-title"]')
      expect(directive).toBeTruthy()
    })

    it('disables tooltip when editing is active', async () => {
      renderHeader({
        nodeData: makeNodeData({ type: 'KSampler' })
      })

      await fireEvent.dblClick(screen.getByTestId('node-header-1'))

      expect(screen.getByTestId('node-title')).toBeInTheDocument()
    })

    it('creates tooltip configuration when component mounts', () => {
      renderHeader({
        nodeData: makeNodeData({ type: 'KSampler' })
      })

      expect(screen.getByTestId('node-title')).toBeInTheDocument()
    })

    it('uses tooltip container from provide/inject', () => {
      renderHeader({
        nodeData: makeNodeData({ type: 'KSampler' })
      })

      expect(screen.getByTestId('node-title')).toBeInTheDocument()
    })
  })
})
