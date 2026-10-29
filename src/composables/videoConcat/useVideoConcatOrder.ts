import { isEqual } from 'es-toolkit'
import { computed } from 'vue'
import type { Ref } from 'vue'

import {
  arrangeClips,
  moveItem
} from '@/composables/videoConcat/videoConcatOrder'
import type { ConcatClipSlot } from '@/composables/videoConcat/videoConcatOrder'
import type { VideoConcatValue } from '@comfyorg/graph-model/widgets'

export function useVideoConcatOrder<T extends ConcatClipSlot>(
  modelValue: Ref<VideoConcatValue>,
  clips: Ref<T[]>
) {
  const savedOrder = computed(() => modelValue.value.order ?? [])

  const orderedClips = computed(() =>
    arrangeClips(savedOrder.value, clips.value)
  )

  function writeOrder(order: string[]) {
    if (isEqual(order, savedOrder.value)) return
    modelValue.value = { ...modelValue.value, order }
  }

  function reorder(from: number, to: number) {
    const names = orderedClips.value.map((clip) => clip.name)
    writeOrder(moveItem(names, from, to))
  }

  return { orderedClips, reorder }
}
