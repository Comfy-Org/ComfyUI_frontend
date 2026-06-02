import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeMenuOptions } from '@/composables/graph/useNodeMenuOptions'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'

const mockApp = vi.hoisted(() => ({
  canvas: {
    selected_nodes: null as Record<string, LGraphNode> | null
  }
}))

vi.mock('@/scripts/app', () => ({ app: mockApp }))

vi.mock('@/composables/graph/useNodeCustomization', () => ({
  useNodeCustomization: () => ({
    shapeOptions: [],
    applyShape: vi.fn(),
    applyColor: vi.fn(),
    colorOptions: [],
    isLightTheme: { value: false }
  })
}))

vi.mock('@/composables/graph/useSelectedNodeActions', () => ({
  useSelectedNodeActions: () => ({
    adjustNodeSize: vi.fn(),
    toggleNodeCollapse: vi.fn(),
    toggleNodePin: vi.fn(),
    toggleNodeBypass: vi.fn(),
    runBranch: vi.fn()
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const setSelectedNodes = (nodes: LGraphNode[]) => {
  const dict: Record<string, LGraphNode> = {}
  nodes.forEach((n, i) => {
    dict[String(i)] = n
  })
  mockApp.canvas.selected_nodes = dict
}

const nodeWithMode = (mode: LGraphEventMode, id = 1): LGraphNode =>
  ({ id, mode }) as LGraphNode

const getBypassLabel = (): string => {
  let label = ''
  const Wrapper = defineComponent({
    setup() {
      const { getBypassOption } = useNodeMenuOptions()
      label = getBypassOption(() => {}).label ?? ''
      return () => null
    }
  })
  render(Wrapper, { global: { plugins: [i18n] } })
  return label
}

describe('useNodeMenuOptions.getBypassOption', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockApp.canvas.selected_nodes = null
  })

  it('labels as "Bypass" when no node is bypassed', () => {
    setSelectedNodes([nodeWithMode(LGraphEventMode.ALWAYS, 1)])
    expect(getBypassLabel()).toBe('contextMenu.Bypass')
  })

  it('labels as "Remove Bypass" when every selected node is bypassed', () => {
    setSelectedNodes([
      nodeWithMode(LGraphEventMode.BYPASS, 1),
      nodeWithMode(LGraphEventMode.BYPASS, 2)
    ])
    expect(getBypassLabel()).toBe('contextMenu.Remove Bypass')
  })

  it('labels as "Bypass" on mixed selection so it matches the toggle action', () => {
    setSelectedNodes([
      nodeWithMode(LGraphEventMode.BYPASS, 1),
      nodeWithMode(LGraphEventMode.ALWAYS, 2)
    ])
    expect(getBypassLabel()).toBe('contextMenu.Bypass')
  })
})
