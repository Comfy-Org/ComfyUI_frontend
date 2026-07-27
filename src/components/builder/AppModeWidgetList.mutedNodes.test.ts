import { render, screen } from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { WidgetId } from '@/types/widgetId'

/**
 * Regression coverage for silent widget loss in app mode.
 *
 * `AppModeWidgetList.vue:63-66` flat-maps away entries whose status is not
 * `resolved` AND entries whose node mode is not `ALWAYS` (muted / bypassed).
 * A published app therefore loses a control with no signal to the end user.
 */

const graphId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const seedWidgetId = `${graphId}:1:seed` as WidgetId
const cfgWidgetId = `${graphId}:2:cfg` as WidgetId

const resolvedEntries = vi.hoisted(() => ({ value: [] as unknown[] }))

vi.mock('@/components/builder/useResolvedSelectedInputs', () => ({
  useResolvedSelectedInputs: () => computed(() => resolvedEntries.value)
}))

vi.mock('@/components/builder/useAppModeWidgetResizing', () => ({
  useAppModeWidgetResizing: () => ({ onPointerDown: vi.fn() })
}))

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({
    updateInputConfig: vi.fn(),
    removeSelectedInput: vi.fn()
  })
}))

vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => ({ surfacedNodeErrors: {} })
}))

vi.mock('@/composables/maskeditor/useMaskEditor', () => ({
  useMaskEditor: () => ({ openMaskEditor: vi.fn() })
}))

vi.mock('@/composables/graph/useGraphNodeManager', () => ({
  extractVueNodeData: (node: LGraphNode) => ({
    id: node.id,
    title: node.title,
    widgets: node.widgets?.map((w) => ({
      name: w.name,
      widgetId: w.widgetId,
      slotMetadata: undefined,
      nodeId: node.id
    }))
  })
}))

vi.mock('@/scripts/api', () => ({
  api: { apiURL: (route: string) => route }
}))

vi.mock('@/scripts/app', () => ({
  app: { getPreviewFormatParam: () => '', dragOverNode: undefined }
}))

const AppModeWidgetList = (
  await import('@/components/builder/AppModeWidgetList.vue')
).default

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { rename: 'Rename', remove: 'Remove' },
      linearMode: {
        dragAndDropImage: 'Drop image',
        widgetUnavailable: 'Widget unavailable'
      }
    }
  }
})

function makeEntry(
  widgetId: WidgetId,
  nodeId: number,
  widgetName: string,
  mode: LGraphEventMode
) {
  const widget = fromAny<IBaseWidget, unknown>({
    name: widgetName,
    label: widgetName,
    widgetId
  })
  const node = fromAny<LGraphNode, unknown>({
    id: nodeId,
    title: `Node ${nodeId}`,
    type: 'KSampler',
    mode,
    widgets: [widget]
  })
  return {
    status: 'resolved' as const,
    widgetId,
    node,
    widget,
    displayName: widgetName
  }
}

function renderList() {
  return render(AppModeWidgetList, {
    global: {
      plugins: [i18n],
      stubs: {
        NodeWidgets: true,
        DropZone: { template: '<div><slot /></div>' },
        Popover: { template: '<div><slot name="button" /></div>' },
        Button: { template: '<button><slot /></button>' }
      }
    }
  })
}

describe('AppModeWidgetList — muted / bypassed nodes', () => {
  beforeEach(() => {
    resolvedEntries.value = []
  })

  it('renders every selected widget when all nodes are active (baseline)', () => {
    resolvedEntries.value = [
      makeEntry(seedWidgetId, 1, 'seed', LGraphEventMode.ALWAYS),
      makeEntry(cfgWidgetId, 2, 'cfg', LGraphEventMode.ALWAYS)
    ]

    renderList()

    expect(screen.getAllByTestId('app-mode-widget-item')).toHaveLength(2)
  })

  it('does not silently drop a widget whose node is muted', () => {
    resolvedEntries.value = [
      makeEntry(seedWidgetId, 1, 'seed', LGraphEventMode.ALWAYS),
      makeEntry(cfgWidgetId, 2, 'cfg', LGraphEventMode.NEVER)
    ]

    renderList()

    // The muted widget must still be accounted for in the app — either
    // rendered, or rendered in an explicit unavailable state. Vanishing with
    // no signal is the bug.
    expect(screen.getAllByTestId('app-mode-widget-item')).toHaveLength(2)
    expect(screen.getAllByTestId('widget-unavailable')).toHaveLength(1)
    expect(screen.getByText('Widget unavailable')).toBeTruthy()
  })

  it('does not silently drop a widget whose node is bypassed', () => {
    resolvedEntries.value = [
      makeEntry(seedWidgetId, 1, 'seed', LGraphEventMode.ALWAYS),
      makeEntry(cfgWidgetId, 2, 'cfg', LGraphEventMode.BYPASS)
    ]

    renderList()

    expect(screen.getAllByTestId('app-mode-widget-item')).toHaveLength(2)
  })

  it('does not silently drop an unresolved widget', () => {
    resolvedEntries.value = [
      makeEntry(seedWidgetId, 1, 'seed', LGraphEventMode.ALWAYS),
      {
        status: 'unknown' as const,
        widgetId: cfgWidgetId,
        displayName: 'cfg'
      }
    ]

    renderList()

    expect(screen.getAllByTestId('app-mode-widget-item')).toHaveLength(2)
  })
})
