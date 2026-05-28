import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeMenuOptions } from '@/composables/graph/useNodeMenuOptions'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  }),
  createI18n: () => ({
    global: {
      t: vi.fn(),
      te: vi.fn(),
      d: vi.fn()
    }
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      selected_nodes: null
    }
  }
}))

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

const setSelectedNodes = (nodes: LGraphNode[]) => {
  const dict: Record<string, LGraphNode> = {}
  nodes.forEach((n, i) => {
    dict[String(i)] = n
  })
  app.canvas.selected_nodes = dict
}

const nodeWithMode = (mode: LGraphEventMode, id = 1): LGraphNode =>
  ({ id, mode }) as LGraphNode

describe('useNodeMenuOptions.getBypassOption', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // @ts-expect-error - reset for each test
    app.canvas.selected_nodes = null
  })

  it('labels as "Bypass" when no node is bypassed', () => {
    setSelectedNodes([nodeWithMode(LGraphEventMode.ALWAYS, 1)])
    const { getBypassOption } = useNodeMenuOptions()
    expect(getBypassOption(() => {}).label).toBe('contextMenu.Bypass')
  })

  it('labels as "Remove Bypass" when every selected node is bypassed', () => {
    setSelectedNodes([
      nodeWithMode(LGraphEventMode.BYPASS, 1),
      nodeWithMode(LGraphEventMode.BYPASS, 2)
    ])
    const { getBypassOption } = useNodeMenuOptions()
    expect(getBypassOption(() => {}).label).toBe('contextMenu.Remove Bypass')
  })

  it('labels as "Bypass" on mixed selection so it matches the toggle action', () => {
    setSelectedNodes([
      nodeWithMode(LGraphEventMode.BYPASS, 1),
      nodeWithMode(LGraphEventMode.ALWAYS, 2)
    ])
    const { getBypassOption } = useNodeMenuOptions()
    expect(getBypassOption(() => {}).label).toBe('contextMenu.Bypass')
  })
})
