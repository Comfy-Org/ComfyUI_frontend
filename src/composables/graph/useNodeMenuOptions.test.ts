import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeMenuOptions } from '@/composables/graph/useNodeMenuOptions'
import type { Positionable } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'

// canvasStore transitively imports the app singleton; stub it so the real
// ComfyApp module never loads during these unit tests.
vi.mock('@/scripts/app', () => ({
  app: { canvas: { selected_nodes: null } }
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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const nodeWithMode = (mode: LGraphEventMode, id = 1): LGraphNode => {
  const node = new LGraphNode('Test')
  node.id = toNodeId(id)
  node.mode = mode
  return node
}

const getBypassLabel = (selected: LGraphNode[]): string => {
  const canvasStore = useCanvasStore()
  vi.spyOn(canvasStore, 'canvas', 'get').mockReturnValue({
    selectedItems: new Set<Positionable>(selected)
  } as ReturnType<typeof canvasStore.getCanvas>)

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
  })

  it('labels as "Bypass" when no node is bypassed', () => {
    expect(getBypassLabel([nodeWithMode(LGraphEventMode.ALWAYS, 1)])).toBe(
      'contextMenu.Bypass'
    )
  })

  it('labels as "Remove Bypass" when every selected node is bypassed', () => {
    expect(
      getBypassLabel([
        nodeWithMode(LGraphEventMode.BYPASS, 1),
        nodeWithMode(LGraphEventMode.BYPASS, 2)
      ])
    ).toBe('contextMenu.Remove Bypass')
  })

  it('labels as "Bypass" on mixed selection so it matches the toggle action', () => {
    expect(
      getBypassLabel([
        nodeWithMode(LGraphEventMode.BYPASS, 1),
        nodeWithMode(LGraphEventMode.ALWAYS, 2)
      ])
    ).toBe('contextMenu.Bypass')
  })
})
