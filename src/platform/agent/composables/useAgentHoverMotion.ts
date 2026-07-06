import { computed } from 'vue'
import type { Ref } from 'vue'

import type {
  AgentHoverParams,
  AgentIdleParams
} from '@/platform/agent/composables/agentPersonalityState'

/**
 * Builds reactive `motion-v` props for a hover "pop" plus a subtle infinite
 * idle breathing animation, both driven by tunable params. Spread the result
 * onto a `<motion.div>`/`<motion.button>` in the template.
 */
export function useAgentHoverMotion(
  hover: AgentHoverParams,
  idle: AgentIdleParams,
  reducedMotion: Ref<boolean>
) {
  const transition = computed(() => ({
    type: 'spring' as const,
    stiffness: hover.stiffness,
    damping: hover.damping
  }))

  const whileHover = computed(() =>
    reducedMotion.value ? {} : { scale: hover.scale }
  )

  const animate = computed(() =>
    reducedMotion.value
      ? { scale: 1 }
      : {
          scale: [1, 1 + idle.amplitude, 1],
          transition: {
            duration: idle.period,
            repeat: Infinity,
            ease: 'easeInOut' as const
          }
        }
  )

  return { transition, whileHover, animate }
}
