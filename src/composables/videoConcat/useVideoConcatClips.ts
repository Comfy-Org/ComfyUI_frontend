import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import { useVideoSourceResolver } from '@/composables/video/useVideoSourceUrl'
import {
  parseSegmentPreviews,
  segmentPreviewUrl
} from '@/composables/videoConcat/concatSegmentPreviews'
import { linkedConcatSlots } from '@/composables/videoConcat/linkedConcatSlots'
import type { ConcatClipSlot } from '@/composables/videoConcat/videoConcatOrder'
import type { LGraphNode } from '@comfyorg/litegraph/litegraph'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

export interface ConcatClip extends ConcatClipSlot {
  url: string | undefined
}

export interface ClipMetadata {
  duration: number
  width: number
  height: number
  thumbnail: string
}

export function useVideoConcatClips(
  node: ComputedRef<LGraphNode | null | undefined>,
  source: MaybeRefOrGetter<string>
) {
  const { resolveVideoUrl, resolveSourceOutput } = useVideoSourceResolver()
  const nodeOutputStore = useNodeOutputStore()

  return computed((): ConcatClip[] => {
    const current = node.value
    if (!current) return []
    const previews = parseSegmentPreviews(
      nodeOutputStore.getNodeOutputs(current)?.segments
    )
    return linkedConcatSlots(current, toValue(source)).map(
      ({ name, linkId, inputName }) => ({
        name,
        linkId,
        url:
          resolveVideoUrl(current, inputName) ??
          segmentPreviewUrl(previews, resolveSourceOutput(current, inputName))
      })
    )
  })
}
