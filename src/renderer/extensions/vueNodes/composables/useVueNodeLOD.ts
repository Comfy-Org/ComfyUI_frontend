import { useRafFn } from '@vueuse/core'
import { onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

const VUE_NODE_LOW_DETAIL_CLASS = 'vue-nodes-low-detail'

interface VueNodeLODOptions {
  canvas: MaybeRefOrGetter<LGraphCanvas | null | undefined>
  enabled: MaybeRefOrGetter<boolean>
  fullDetailZoom: MaybeRefOrGetter<number>
  vueNodesEnabled: MaybeRefOrGetter<boolean>
}

export function shouldUseVueNodeLowDetail(
  scale: number,
  enabled: boolean,
  fullDetailZoom: number,
  vueNodesEnabled: boolean
): boolean {
  return (
    enabled &&
    vueNodesEnabled &&
    Number.isFinite(scale) &&
    scale < Math.min(100, Math.max(10, fullDetailZoom)) / 100
  )
}

export function useVueNodeLOD({
  canvas,
  enabled,
  fullDetailZoom,
  vueNodesEnabled
}: VueNodeLODOptions): void {
  let lastLowDetail: boolean | undefined
  let lastScale: number | undefined

  function update(scale = toValue(canvas)?.ds.scale): void {
    const lowDetail = shouldUseVueNodeLowDetail(
      Number(scale),
      toValue(enabled),
      toValue(fullDetailZoom),
      toValue(vueNodesEnabled)
    )
    if (lowDetail === lastLowDetail) return
    lastLowDetail = lowDetail
    document.documentElement.classList.toggle(
      VUE_NODE_LOW_DETAIL_CLASS,
      lowDetail
    )
  }

  watch(
    [
      () => toValue(enabled),
      () => toValue(fullDetailZoom),
      () => toValue(vueNodesEnabled)
    ],
    () => update(),
    {
      immediate: true
    }
  )

  useRafFn(() => {
    const scale = toValue(canvas)?.ds.scale
    if (scale == null || Object.is(scale, lastScale)) return
    lastScale = scale
    update(scale)
  })

  onScopeDispose(() => {
    document.documentElement.classList.remove(VUE_NODE_LOW_DETAIL_CLASS)
  })
}
