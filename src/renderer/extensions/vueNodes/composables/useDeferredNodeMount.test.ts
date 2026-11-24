import { describe, expect, it, onTestFinished } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useDeferredNodeMount } from '@/renderer/extensions/vueNodes/composables/useDeferredNodeMount'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

const ids = (...values: string[]) => values.map(toNodeId)

function setup({
  lowQuality,
  inView
}: {
  lowQuality: boolean
  inView: NodeId[]
}) {
  const nodeIds = ref(ids('a', 'b', 'c'))
  const isLowQuality = ref(lowQuality)
  const view = ref(inView)
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const { isNodeMounted } = scope.run(() =>
    useDeferredNodeMount({
      nodeIds,
      isLowQuality,
      keptNodeIds: ref(new Set(ids('c'))),
      isNodeInView: (id) => view.value.includes(id),
      viewVersion: () => view.value
    })
  )!
  const mounted = () => nodeIds.value.filter(isNodeMounted)
  return { nodeIds, isLowQuality, view, mounted }
}

describe('useDeferredNodeMount', () => {
  it('mounts every node of a graph loaded above the threshold', () => {
    const { mounted } = setup({ lowQuality: false, inView: [] })

    expect(mounted()).toEqual(ids('a', 'b', 'c'))
  })

  it('mounts only visible and kept nodes on the first zoom-in, then the rest as they scroll into view', async () => {
    const { isLowQuality, view, mounted } = setup({
      lowQuality: true,
      inView: ids('a')
    })
    expect(mounted()).toEqual(ids('c'))

    isLowQuality.value = false
    expect(mounted()).toEqual(ids('a', 'c'))

    view.value = ids('b')
    await nextTick()
    expect(mounted()).toEqual(ids('a', 'b', 'c'))
  })

  it('restores every previously mounted node on later zoom-ins', async () => {
    const { isLowQuality, view, mounted } = setup({
      lowQuality: true,
      inView: ids('a')
    })
    isLowQuality.value = false
    await nextTick()
    isLowQuality.value = true
    await nextTick()
    view.value = []

    isLowQuality.value = false
    expect(mounted()).toEqual(ids('a', 'c'))
  })

  it('mounts nodes added above the threshold immediately', async () => {
    const { nodeIds, mounted } = setup({ lowQuality: false, inView: [] })

    nodeIds.value = [...nodeIds.value, toNodeId('d')]
    await nextTick()

    expect(mounted()).toEqual(ids('a', 'b', 'c', 'd'))
  })
})
