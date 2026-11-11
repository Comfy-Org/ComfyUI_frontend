<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@comfyorg/design-system/button/Button'
import { FALLBACK_LOCALE } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import type { AgentStarterPromptAttribution } from '@/workbench/extensions/agent/utils/starterPrompts'
import { starterPromptAttribution } from '@/workbench/extensions/agent/utils/starterPrompts'

const {
  userName,
  section = 'all',
  hasSelection = false
} = defineProps<{
  userName?: string
  section?: 'all' | 'greeting' | 'prompts'
  hasSelection?: boolean
}>()
const emit = defineEmits<{
  insert: [text: string, prompt: AgentStarterPromptAttribution]
}>()

const { t, te, tm, locale } = useI18n()

const promptKey = isCloud
  ? 'agent.suggestedPrompts.cloud'
  : 'agent.suggestedPrompts.local'
const treatmentPromptKey = 'agent.suggestedPrompts.treatment.cloud'
const hasTreatmentCopy = computed(
  () => isCloud && te(`${treatmentPromptKey}.0`, locale.value)
)
const selectedPromptKey = computed(() =>
  hasTreatmentCopy.value ? treatmentPromptKey : promptKey
)
const SELECTED_NODE_PROMPT_INDEX = 2
const COMPACT_PROMPT_COUNT = 3
const promptIcons = [
  'icon-[lucide--image]',
  'icon-[lucide--video]',
  'icon-[lucide--message-circle-question-mark]',
  isCloud ? 'icon-[lucide--scan-search]' : 'icon-[lucide--puzzle]',
  'icon-[lucide--message-circle-warning]'
]
const prompts = computed(() => tm(selectedPromptKey.value) as string[])
const suggestions = computed(() =>
  prompts.value
    .map((text, index) => ({
      text,
      index,
      icon: promptIcons[index] ?? 'icon-[lucide--sparkles]',
      requiresSelection:
        selectedPromptKey.value !== treatmentPromptKey &&
        index === SELECTED_NODE_PROMPT_INDEX
    }))
    .filter(({ requiresSelection }) => !requiresSelection || hasSelection)
)
const promptLocale = computed(() => {
  return te(`${selectedPromptKey.value}.0`, locale.value)
    ? locale.value
    : FALLBACK_LOCALE
})

const promptList = useTemplateRef<HTMLElement>('promptList')

function visiblePromptCount(): number {
  const buttons = promptList.value?.querySelectorAll('button')
  if (!buttons) return suggestions.value.length
  return Array.from(buttons).filter(
    (button) => getComputedStyle(button).display !== 'none'
  ).length
}

function onPromptClick(text: string, index: number): void {
  emit(
    'insert',
    text,
    starterPromptAttribution(
      text,
      index,
      suggestions.value.length,
      promptLocale.value,
      visiblePromptCount()
    )
  )
}
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col overflow-x-hidden px-4',
        section === 'all' && 'h-full overflow-y-auto py-8',
        section === 'greeting' && 'pb-3',
        section === 'prompts' && 'pt-1 pb-4'
      )
    "
  >
    <div
      :class="
        cn(
          'flex shrink-0 flex-col items-center gap-8 text-center',
          section === 'all' && 'my-auto'
        )
      "
    >
      <div
        v-if="section !== 'prompts'"
        :class="
          cn(
            'flex max-w-sm flex-col items-center text-base/snug font-semibold tracking-tight @min-[570px]:text-2xl/snug',
            section === 'all'
              ? 'pt-12'
              : '@min-[1024px]:max-w-2xl @min-[1024px]:text-4xl/tight'
          )
        "
      >
        <p class="my-0">
          {{ t('agent.greeting', { name: userName ?? t('agent.friend') }) }}
        </p>
        <p class="my-0">
          {{ t('agent.greetingQuestion') }}
        </p>
      </div>
      <div
        v-if="section !== 'greeting'"
        ref="promptList"
        data-testid="suggested-prompts"
        class="mx-auto flex w-full max-w-[608px] shrink-0 flex-wrap gap-2 @min-[460px]:justify-center"
      >
        <Button
          v-for="(suggestion, displayIndex) in suggestions"
          :key="suggestion.index"
          type="button"
          variant="secondary"
          size="md"
          :class="
            cn(
              'w-full max-w-full min-w-0 justify-start rounded-full px-3 text-sm @min-[460px]:w-auto',
              displayIndex >= COMPACT_PROMPT_COUNT && '@max-[460px]:hidden'
            )
          "
          @click="onPromptClick(suggestion.text, suggestion.index)"
        >
          <i
            :class="cn('size-3 text-muted-foreground', suggestion.icon)"
            aria-hidden="true"
          />
          <span class="truncate">{{ suggestion.text }}</span>
        </Button>
      </div>
    </div>
  </div>
</template>
