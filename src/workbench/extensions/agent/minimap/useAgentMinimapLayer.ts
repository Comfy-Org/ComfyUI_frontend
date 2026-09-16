import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch } from 'vue'
import type { WatchSource } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useMinimapLayerStore } from '@/stores/minimapLayerStore'
import type { MinimapLayer } from '@/stores/minimapLayerStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { useAgentGeneratedNodesStore } from '../stores/agentGeneratedNodesStore'

import {
  AGENT_MINIMAP_ANIMATION_MS,
  agentMinimapGrowth,
  drawAgentMinimapHighlight
} from './agentMinimapHighlight'
export function useAgentMinimapLayer(
  generatedNodes: Pick<
    ReturnType<typeof useAgentGeneratedNodesStore>,
    'generatedAtFor' | 'latestMarkAt'
  >,
  provenance: WatchSource
): void {
  const settingStore = useSettingStore()
  const revision = ref(0)
  const reducedMotion = usePreferredReducedMotion()
  let animationEndsAt = 0
  let lastFrameAt = 0

  const animationsEnabled = computed(
    () =>
      !settingStore.get('Comfy.Appearance.DisableAnimations') &&
      reducedMotion.value !== 'reduce'
  )

  const stopProvenanceWatch = watch(
    provenance,
    () => {
      revision.value++
    },
    { deep: true }
  )
  const stopPreferenceWatch = watch(animationsEnabled, () => {
    revision.value++
    if (!animationsEnabled.value) animationEndsAt = 0
  })

  const layer: MinimapLayer = {
    revision,
    isAnimating(now) {
      if (!animationsEnabled.value || now < lastFrameAt) {
        animationEndsAt = 0
      }
      lastFrameAt = now
      return now < animationEndsAt
    },
    draw({ ctx, graph, nodes, now }) {
      const scope = graphScopeOf(graph)
      const latestMarkAt = generatedNodes.latestMarkAt(scope)
      animationEndsAt =
        animationsEnabled.value && latestMarkAt > 0
          ? latestMarkAt + AGENT_MINIMAP_ANIMATION_MS
          : 0
      const color = getComputedStyle(document.documentElement)
        .getPropertyValue('--warning-background')
        .trim()
      ctx.fillStyle = color
      ctx.strokeStyle = color
      ctx.lineWidth = 1

      for (const { nodeId, x, y, width, height } of nodes) {
        const generatedAt = generatedNodes.generatedAtFor(scope, nodeId)
        if (generatedAt === undefined) continue

        const growth = animationsEnabled.value
          ? agentMinimapGrowth(generatedAt, now)
          : 1
        drawAgentMinimapHighlight(ctx, { x, y, width, height }, growth)
      }
    }
  }

  const unregister = useMinimapLayerStore().register(layer)
  onScopeDispose(() => {
    unregister()
    stopProvenanceWatch()
    stopPreferenceWatch()
  })
}
