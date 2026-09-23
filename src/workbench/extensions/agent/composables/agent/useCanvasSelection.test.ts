import { effectScope, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

import type { SelectedNode } from './useCanvasSelection'
import { useCanvasSelection } from './useCanvasSelection'

const nodeA: SelectedNode = { id: '1', title: 'Load Checkpoint' }
const nodeB: SelectedNode = { id: '2', title: 'KSampler' }

describe('useCanvasSelection', () => {
  it('stages the current selection only while live', () => {
    const selection = ref<SelectedNode[]>([nodeA])
    const isLive = ref(false)
    const { staged } = useCanvasSelection({ selection, isLive })
    expect(staged.value).toEqual([])

    isLive.value = true
    expect(staged.value).toEqual([nodeA])
  })

  it('does not track selection while the agent flag is disabled', () => {
    const selection = ref<SelectedNode[]>([nodeA])
    const enabled = ref(false)
    const { staged } = useCanvasSelection({
      selection,
      isLive: ref(true),
      enabled
    })

    expect(staged.value).toEqual([])
    selection.value = [nodeB]
    expect(staged.value).toEqual([])

    enabled.value = true
    expect(staged.value).toEqual([nodeB])
  })

  it('accepts an unchanged dismissed selection after the feature is re-enabled', () => {
    const selection = ref<SelectedNode[]>([nodeA])
    const enabled = ref(true)
    const { staged, remove } = useCanvasSelection({
      selection,
      isLive: ref(true),
      enabled
    })

    remove('1')
    enabled.value = false
    enabled.value = true

    expect(staged.value).toEqual([nodeA])
  })

  it('stops a selection watcher created after enabling when its scope stops', () => {
    const scope = effectScope()
    const selection = ref<SelectedNode[]>([nodeA])
    const enabled = ref(false)
    const staged = scope.run(
      () =>
        useCanvasSelection({
          selection,
          isLive: ref(true),
          enabled
        }).staged
    )
    if (!staged) throw new Error('selection scope did not run')

    enabled.value = true
    expect(staged.value).toEqual([nodeA])
    scope.stop()
    selection.value = [nodeB]

    expect(staged.value).toEqual([nodeA])
  })

  it('clears on submit and does not re-stage the same selection', async () => {
    const selection = ref<SelectedNode[]>([nodeA])
    const { staged, consume } = useCanvasSelection({
      selection,
      isLive: ref(true)
    })
    expect(staged.value).toEqual([nodeA])

    expect(consume()).toEqual([nodeA])
    expect(staged.value).toEqual([])

    selection.value = [nodeA]
    await Promise.resolve()
    expect(staged.value).toEqual([])
  })

  it('re-stages when the selection changes', () => {
    const selection = ref<SelectedNode[]>([nodeA])
    const { staged, consume } = useCanvasSelection({
      selection,
      isLive: ref(true)
    })
    consume()
    selection.value = [nodeA, nodeB]
    expect(staged.value).toEqual([nodeA, nodeB])
  })

  it('keeps staged references unchanged while canvas tracking is inactive', () => {
    const selection = ref<SelectedNode[]>([nodeA])
    const isTracking = ref(false)
    const { staged, add } = useCanvasSelection({
      selection,
      isLive: ref(true),
      isTracking
    })
    add(nodeB)

    selection.value = [nodeA]
    expect(staged.value).toEqual([nodeB])

    isTracking.value = true
    expect(staged.value).toEqual([nodeA])
  })

  it('replaces staged references during an explicit restore', () => {
    const { staged, replace } = useCanvasSelection({
      selection: ref<SelectedNode[]>([nodeA]),
      isLive: ref(true)
    })

    replace([nodeB])

    expect(staged.value).toEqual([nodeB])
  })

  it('deduplicates locators while retaining same-id nodes from other graphs', () => {
    const rootNode: SelectedNode = {
      id: 'shared',
      locatorId: createNodeLocatorId(null, toNodeId('shared')),
      title: 'Root twin'
    }
    const subgraphNode: SelectedNode = {
      id: 'shared',
      locatorId: createNodeLocatorId(
        '00000000-0000-0000-0000-000000000001',
        toNodeId('shared')
      ),
      title: 'Subgraph twin'
    }
    const { staged, add } = useCanvasSelection({
      selection: ref<SelectedNode[]>([]),
      isLive: ref(true)
    })

    add(rootNode)
    add(rootNode)
    add(subgraphNode)

    expect(staged.value).toEqual([rootNode, subgraphNode])
  })

  it('drops a tag on remove but keeps the rest', () => {
    const selection = ref<SelectedNode[]>([nodeA, nodeB])
    const { staged, remove } = useCanvasSelection({
      selection,
      isLive: ref(true)
    })
    remove('1')
    expect(staged.value).toEqual([nodeB])
  })

  it('keeps a cleared selection dismissed until the selection changes', () => {
    const selection = ref<SelectedNode[]>([nodeA])
    const { staged, dismissed, remove } = useCanvasSelection({
      selection,
      isLive: ref(true)
    })

    remove('1')
    expect(dismissed()).toBe(true)

    selection.value = [{ ...nodeA }]
    expect(dismissed()).toBe(true)

    selection.value = [nodeB]
    expect(dismissed()).toBe(false)
    expect(staged.value).toEqual([nodeB])
  })

  it('preserves dismissal through hydration only in the same workflow', () => {
    const selection = ref<SelectedNode[]>([nodeA])
    const isLive = ref(true)
    const scope = ref<string | null>('workflows/Unsaved Workflow.json')
    const dismissedSignature = ref<string | null>(null)
    const { staged, remove } = useCanvasSelection({
      selection,
      isLive,
      scope,
      dismissedSignature
    })

    remove('1')
    isLive.value = false
    selection.value = []
    selection.value = [nodeA]
    isLive.value = true
    expect(staged.value).toEqual([])

    scope.value = 'workflows/Unsaved Workflow (2).json'
    expect(staged.value).toEqual([nodeA])
    expect(dismissedSignature.value).toBeNull()
  })
})
