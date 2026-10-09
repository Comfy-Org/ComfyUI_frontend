<script setup lang="ts">
import { computed } from 'vue'

import type { ShotBlock } from '@/composables/useCinematicShot'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ShotEstimate } from '@/lib/workshop/cinematic-studio/estimate'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import CinematicGenerateAction from './CinematicGenerateAction.vue'

const {
  scene,
  blocked,
  gate,
  workspaceName,
  rendering,
  estimate,
  credits,
  showCredits = true,
  locale = 'en'
} = defineProps<{
  scene: string
  blocked?: ShotBlock
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  estimate?: ShotEstimate
  credits?: number
  showCredits?: boolean
  locale?: Locale
}>()
const { t: tc } = translationsFor(locale)

const emit = defineEmits<{ generate: []; cancel: [] }>()

const takes = defineModel<number>('takes', { required: true })

const blockedNote = computed(() =>
  blocked ? tc(blocked.key, { model: blocked.model }) : undefined
)
const canGenerate = computed(
  () => gate === 'ready' && scene.trim().length > 0 && !blockedNote.value
)
</script>

<template>
  <CinematicGenerateAction
    :gate
    :workspace-name="workspaceName"
    :rendering
    :can-generate="canGenerate"
    :blocked-note="blockedNote"
    :estimate
    :credits
    wide
    :show-credits="showCredits"
    :locale
    @generate="emit('generate')"
    @cancel="emit('cancel')"
    @reduce-takes="takes = $event"
  />
</template>
