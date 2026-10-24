import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  authenticatedRemoteConfigState,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useSettingStore } from '@/platform/settings/settingStore'
import { usePromptPanelStore } from '@/stores/workspace/promptPanelStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

const telemetry = vi.hoisted(() => ({
  trackPromptEditorOpened: vi.fn(),
  trackPromptEditorClosed: vi.fn(),
  trackNamedValuesShadowDiffSummary: vi.fn()
}))

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => telemetry
}))

function addTextNode(graph = createTestRootGraph()) {
  const node = new LGraphNode('CLIP Text Encode')
  graph.add(node)
  const widget = node.addWidget('text', 'text', 'a portrait', () => {})
  return { graph, target: { node, widget } }
}

beforeEach(() => {
  remoteConfig.value = { 'prompt-editor-surface': 'panel' }
  authenticatedRemoteConfigState.value = 'authenticated'
})

describe('usePromptPanelStore', () => {
  it('opens the prompt view in the right side panel and reports the open', () => {
    const store = usePromptPanelStore()
    const { target } = addTextNode()

    expect(store.open(target)).toBe(true)

    expect(store.target).toEqual(target)
    expect(store.isPromptViewShown).toBe(true)
    expect(useRightSidePanelStore().isOpen).toBe(true)
    expect(telemetry.trackPromptEditorOpened).toHaveBeenCalledWith({
      surface: 'panel',
      trigger: 'expand_button',
      '$feature/prompt-editor-surface': 'panel'
    })
  })

  it('does not open when the legacy menu has no right side panel', () => {
    const settingStore = useSettingStore()
    const get = settingStore.get
    vi.spyOn(settingStore, 'get').mockImplementation((key) =>
      key === 'Comfy.UseNewMenu' ? 'Disabled' : get(key)
    )
    const store = usePromptPanelStore()

    expect(store.open(addTextNode().target)).toBe(false)
    expect(store.isActive).toBe(false)
    expect(telemetry.trackPromptEditorOpened).not.toHaveBeenCalled()
  })

  it('reports edits and node switches when the session ends', () => {
    const store = usePromptPanelStore()
    const { graph, target } = addTextNode()
    const other = addTextNode(graph).target

    store.open(target)
    store.recordInput()
    store.follow(other)
    store.follow(other)
    store.recordInput()
    store.close()

    expect(telemetry.trackPromptEditorClosed).toHaveBeenCalledExactlyOnceWith({
      surface: 'panel',
      trigger: 'expand_button',
      '$feature/prompt-editor-surface': 'panel',
      duration_ms: expect.any(Number),
      input_count: 2,
      node_switch_count: 1
    })
  })

  it('ignores selection changes when no session is open', () => {
    const store = usePromptPanelStore()

    store.follow(addTextNode().target)

    expect(store.target).toBeNull()
  })

  it.for([
    {
      event: 'the right side panel closes',
      act: (_graph: ReturnType<typeof createTestRootGraph>) =>
        useRightSidePanelStore().closePanel()
    },
    {
      event: 'the workflow is cleared',
      act: (graph: ReturnType<typeof createTestRootGraph>) => graph.clear()
    },
    {
      event: 'a reload drops its widget',
      act: (graph: ReturnType<typeof createTestRootGraph>) =>
        graph.configure(graph.serialize())
    }
  ])('ends the session when $event', async ({ act }) => {
    const store = usePromptPanelStore()
    const { graph, target } = addTextNode()
    store.open(target)

    act(graph)

    await vi.waitFor(() => expect(store.target).toBeNull())
    expect(telemetry.trackPromptEditorClosed).toHaveBeenCalledOnce()
  })

  it('follows its node through an undo that reloads the graph', () => {
    class PromptNode extends LGraphNode {
      constructor() {
        super('test/prompt-node')
        this.serialize_widgets = true
        this.addWidget('textarea', 'text', 'a portrait', () => {})
      }
    }
    LiteGraph.registerNodeType('test/prompt-node', PromptNode)
    const graph = createTestRootGraph()
    const node = LiteGraph.createNode('test/prompt-node')
    if (!node) throw new Error('The prompt node type is not registered')
    graph.add(node)
    const [widget] = node.widgets ?? []
    const store = usePromptPanelStore()
    store.open({ node, widget })

    graph.configure(graph.serialize())

    expect(store.target?.node).not.toBe(node)
    expect(store.target?.node.id).toBe(node.id)
    expect(store.target?.widget.name).toBe('text')
    expect(telemetry.trackPromptEditorClosed).not.toHaveBeenCalled()
  })

  it('does not open while the workspace hides its panels', () => {
    const store = usePromptPanelStore()
    store.isPanelHidden = true

    expect(store.open(addTextNode().target)).toBe(false)
    expect(store.isActive).toBe(false)
  })

  it.for([
    { removed: 'the edited node', closes: true },
    { removed: 'another node', closes: false }
  ])(
    'closes when $removed is removed: $closes',
    async ({ removed, closes }) => {
      const store = usePromptPanelStore()
      const { graph, target } = addTextNode()
      const bystander = addTextNode(graph).target
      store.open(target)

      graph.remove(removed === 'the edited node' ? target.node : bystander.node)
      await Promise.resolve()

      expect(store.target === null).toBe(closes)
    }
  )

  it('stops watching a node once the panel follows another one', async () => {
    const store = usePromptPanelStore()
    const { graph, target: first } = addTextNode()
    const second = addTextNode(graph).target
    store.open(first)
    store.follow(second)

    graph.remove(first.node)
    await Promise.resolve()

    expect(store.target).toEqual(second)
  })
})
