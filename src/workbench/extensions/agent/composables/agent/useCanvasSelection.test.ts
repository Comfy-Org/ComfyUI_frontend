import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

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

  it('drops a tag on remove but keeps the rest', () => {
    const selection = ref<SelectedNode[]>([nodeA, nodeB])
    const { staged, remove } = useCanvasSelection({
      selection,
      isLive: ref(true)
    })
    remove('1')
    expect(staged.value).toEqual([nodeB])
  })
})
