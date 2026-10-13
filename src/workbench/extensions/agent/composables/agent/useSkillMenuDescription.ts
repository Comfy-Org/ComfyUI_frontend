import { computed, onScopeDispose, ref, watch } from 'vue'

import type { SkillReferenceMetadata } from '../../types/skillReference'

const SHOW_DELAY_MS = 250
const HOVER_CLOSE_DELAY_MS = 150

type DescriptionTrigger = 'hover' | 'input'

export function useSkillMenuDescription(
  activeSkill: () => SkillReferenceMetadata | undefined
) {
  const trigger = ref<DescriptionTrigger>()
  const ready = ref(false)
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  watch(
    () => (trigger.value ? activeSkill()?.name : undefined),
    (name, _previous, onCleanup) => {
      ready.value = false
      if (!name) return
      const timer = setTimeout(() => {
        ready.value = true
      }, SHOW_DELAY_MS)
      onCleanup(() => clearTimeout(timer))
    }
  )

  function keepOpen(): void {
    clearTimeout(closeTimer)
  }
  onScopeDispose(keepOpen)

  return {
    describedSkill: computed(() =>
      ready.value && trigger.value ? activeSkill() : undefined
    ),
    requestDescription(source: DescriptionTrigger): void {
      keepOpen()
      trigger.value = source
    },
    dismissDescription(): void {
      keepOpen()
      trigger.value = undefined
    },
    leaveDescription(): void {
      if (trigger.value !== 'hover') return
      keepOpen()
      closeTimer = setTimeout(() => {
        trigger.value = undefined
      }, HOVER_CLOSE_DELAY_MS)
    },
    keepDescriptionOpen: keepOpen
  }
}
