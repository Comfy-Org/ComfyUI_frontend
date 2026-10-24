import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import type { VideoConcatValue } from '@/lib/litegraph/src/types/widgets'
import { toLinkId } from '@/types/linkId'

import { useVideoConcatOrder } from './useVideoConcatOrder'
import type { ConcatClipSlot } from './videoConcatOrder'

function slots(...entries: [string, number][]): ConcatClipSlot[] {
  return entries.map(([name, linkId]) => ({ name, linkId: toLinkId(linkId) }))
}

function setup(initial: VideoConcatValue, clips: ConcatClipSlot[]) {
  const modelValue = ref(initial)
  const clipsRef = ref(clips)
  const order = useVideoConcatOrder(modelValue, clipsRef)
  const names = () => order.orderedClips.value.map((clip) => clip.name)
  return { modelValue, clips: clipsRef, names, ...order }
}

describe('useVideoConcatOrder', () => {
  it('shows saved order first and unlisted clips after it', () => {
    const { names } = setup(
      { order: ['video2'] },
      slots(['video0', 1], ['video1', 2], ['video2', 3])
    )

    expect(names()).toEqual(['video2', 'video0', 'video1'])
  })

  it('writes the full arranged order when a clip is moved', () => {
    const { modelValue, reorder, names } = setup(
      {},
      slots(['video0', 1], ['video1', 2], ['video2', 3])
    )

    reorder(2, 0)

    expect(modelValue.value.order).toEqual(['video2', 'video0', 'video1'])
    expect(names()).toEqual(['video2', 'video0', 'video1'])
  })
})
