<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
import { FALLBACK_LOCALE } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'

import type { AgentStarterPromptAttribution } from '../../utils/starterPrompts'
import { starterPromptAttribution } from '../../utils/starterPrompts'
import type { StarterPromptAssignment } from '../../experiments/starterPromptSet'

const {
  userName,
  assignment = 'control',
  attributeExperiment = true,
  onRendered = (_assignment: StarterPromptAssignment) => undefined,
  onUnmounted: onSurfaceUnmounted = () => undefined
} = defineProps<{
  userName?: string
  assignment?: StarterPromptAssignment
  attributeExperiment?: boolean
  onRendered?: (assignment: StarterPromptAssignment) => void
  onUnmounted?: () => void
}>()
const emit = defineEmits<{
  insert: [text: string, prompt: AgentStarterPromptAttribution]
}>()

const { t, te, tm, locale } = useI18n()

const promptKey = isCloud
  ? 'agent.suggestedPrompts.cloud'
  : 'agent.suggestedPrompts.local'
const treatmentPromptKey = isCloud
  ? 'agent.suggestedPrompts.treatment.cloud'
  : 'agent.suggestedPrompts.treatment.local'
const hasTreatmentCopy = computed(() =>
  te(`${treatmentPromptKey}.0`, locale.value)
)
const selectedPromptKey = computed(() => {
  if (assignment !== 'test' || !hasTreatmentCopy.value) return promptKey
  return treatmentPromptKey
})
const prompts = computed(() => {
  return tm(selectedPromptKey.value) as string[]
})
const effectiveAssignment = computed<StarterPromptAssignment>(() =>
  selectedPromptKey.value === promptKey ? 'control' : assignment
)
const promptLocale = computed(() => {
  return te(`${selectedPromptKey.value}.0`, locale.value)
    ? locale.value
    : FALLBACK_LOCALE
})

const eligibleAtMount = ref(false)
const shouldAttributeExperiment = computed(
  () => eligibleAtMount.value && hasTreatmentCopy.value
)
const reportRenderedAssignment = () => {
  if (shouldAttributeExperiment.value) onRendered(effectiveAssignment.value)
}

onMounted(() => {
  eligibleAtMount.value = attributeExperiment && hasTreatmentCopy.value
  reportRenderedAssignment()
})
watch([effectiveAssignment, hasTreatmentCopy], reportRenderedAssignment)
onUnmounted(onSurfaceUnmounted)

/**
 * One emit per click, carrying the slot's stable id rather than its text. Fires
 * on click only — not on render or focus — so the count is a count of choices.
 */
function onPromptClick(prompt: string, index: number): void {
  emit(
    'insert',
    prompt,
    starterPromptAttribution(
      prompt,
      index,
      prompts.value.length,
      promptLocale.value,
      shouldAttributeExperiment.value ? effectiveAssignment.value : undefined
    )
  )
}

const promptIcons = [
  'icon-[lucide--image]',
  'icon-[lucide--video]',
  'icon-[lucide--message-circle-question-mark]',
  isCloud ? 'icon-[lucide--scan-search]' : 'icon-[lucide--puzzle]',
  'icon-[lucide--message-circle-warning]'
]
</script>

<template>
  <div class="flex h-full flex-col overflow-x-hidden overflow-y-auto px-4 py-8">
    <div class="my-auto flex shrink-0 flex-col items-center gap-8 text-center">
      <div
        class="flex max-w-sm flex-col items-center pt-12 text-base/snug font-semibold tracking-tight text-base-foreground @min-[570px]:text-2xl/snug"
      >
        <p class="my-0">
          {{ t('agent.greeting', { name: userName ?? t('agent.friend') }) }}
        </p>
        <p class="my-0">
          {{ t('agent.greetingQuestion') }}
        </p>
      </div>
      <div
        data-testid="suggested-prompts"
        class="mx-auto flex w-full max-w-[608px] shrink-0 flex-wrap gap-2 @min-[460px]:justify-center"
      >
        <Button
          v-for="(prompt, index) in prompts"
          :key="index"
          type="button"
          variant="secondary"
          size="md"
          class="w-full max-w-full min-w-0 justify-start rounded-full px-3 text-sm @min-[460px]:w-auto"
          @click="onPromptClick(prompt, index)"
        >
          <span
            :class="
              cn(
                'size-3 shrink-0 text-muted-foreground',
                promptIcons[index] ?? 'icon-[lucide--sparkles]'
              )
            "
            aria-hidden="true"
          />
          <span class="truncate">{{ prompt }}</span>
        </Button>
      </div>
    </div>
  </div>
</template>
