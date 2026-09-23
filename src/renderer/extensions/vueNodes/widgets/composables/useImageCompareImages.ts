import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { z } from 'zod'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { zResultItem } from '@/platform/remote/comfyui/execution/types'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { resolveInputSourceNode } from '@/utils/graphTraversalUtil'

const BEFORE_INPUT = 'image_a'
const AFTER_INPUT = 'image_b'

const BEFORE_OUTPUT = 'a_images'
const AFTER_OUTPUT = 'b_images'

const NO_IMAGES: readonly string[] = []

const zSavedImages = z.array(zResultItem)

function savedImageUrls(saved: unknown): readonly string[] {
  const parsed = zSavedImages.safeParse(saved)
  if (!parsed.success) return NO_IMAGES

  const rand = app.getRandParam()
  const previewParam = app.getPreviewFormatParam()

  return parsed.data.map((item) => {
    const params = new URLSearchParams(item)
    return api.apiURL(`/view?${params}${previewParam}${rand}`)
  })
}

export function useImageCompareImages(
  node: ComputedRef<LGraphNode | null | undefined>
): {
  beforeImages: ComputedRef<readonly string[]>
  afterImages: ComputedRef<readonly string[]>
} {
  const nodeOutputStore = useNodeOutputStore()

  function upstreamImages(inputName: string): readonly string[] {
    const target = node.value
    if (!target) return NO_IMAGES

    const slot = target.inputs.findIndex((input) => input.name === inputName)
    if (slot < 0) return NO_IMAGES

    const source = resolveInputSourceNode(target, slot)
    if (!source) return NO_IMAGES

    return nodeOutputStore.getNodeImageUrls(source) ?? NO_IMAGES
  }

  function savedImages(outputKey: string): readonly string[] {
    const target = node.value
    if (!target) return NO_IMAGES

    return savedImageUrls(nodeOutputStore.getNodeOutputs(target)?.[outputKey])
  }

  const sideImages = (inputName: string, outputKey: string) =>
    computed<readonly string[]>(() => {
      const upstream = upstreamImages(inputName)
      return upstream.length ? upstream : savedImages(outputKey)
    })

  return {
    beforeImages: sideImages(BEFORE_INPUT, BEFORE_OUTPUT),
    afterImages: sideImages(AFTER_INPUT, AFTER_OUTPUT)
  }
}
