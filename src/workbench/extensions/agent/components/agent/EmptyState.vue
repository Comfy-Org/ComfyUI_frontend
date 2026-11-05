<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import type { AgentGreeting } from '@/workbench/extensions/agent/types/proactiveGreeting'
import GreetingHeading from './GreetingHeading.vue'
import ProactiveGreeting from './ProactiveGreeting.vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@comfyorg/design-system/button/Button'
import { FALLBACK_LOCALE } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import type { AgentStarterPromptAttribution } from '@/workbench/extensions/agent/utils/starterPrompts'
import { starterPromptAttribution } from '@/workbench/extensions/agent/utils/starterPrompts'

const {
  userName,
  hasSelection = false,
  greeting
} = defineProps<{
  userName?: string
  hasSelection?: boolean
  greeting?: AgentGreeting
}>()
const emit = defineEmits<{
  insert: [text: string, prompt: AgentStarterPromptAttribution]
  prefilled: [delayMs: number]
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
  greeting?.variant === 'A'
    ? (
        tm('agent.proactiveGreeting.controlPrompts') as {
          label: string
          prompt: string
        }[]
      ).map((item, index) => ({
        text: item.label,
        prompt: item.prompt,
        index,
        icon: promptIcons[index],
        requiresSelection: false
      }))
    : prompts.value
        .map((text, index) => ({
          text,
          prompt: text,
          index,
          icon: promptIcons[index] ?? 'icon-[lucide--sparkles]',
          requiresSelection:
            selectedPromptKey.value !== treatmentPromptKey &&
            index === SELECTED_NODE_PROMPT_INDEX
        }))
        .filter(({ requiresSelection }) => !requiresSelection || hasSelection)
)
const promptLocale = computed(() => {
  if (greeting?.variant === 'A')
    return te('agent.proactiveGreeting.controlPrompts.0.label', locale.value)
      ? locale.value
      : FALLBACK_LOCALE
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

function onPromptClick(prompt: string, label: string, index: number): void {
  emit(
    'insert',
    prompt,
    starterPromptAttribution(
      label,
      index,
      suggestions.value.length,
      promptLocale.value,
      visiblePromptCount()
    )
  )
}
</script>

<template>
  <ProactiveGreeting
    v-if="greeting && greeting.variant !== 'A'"
    :greeting
    :user-name
    @prefilled="emit('prefilled', $event)"
  />
  <div
    v-else
    class="flex h-full flex-col overflow-x-hidden overflow-y-auto px-4 py-8"
  >
    <div class="my-auto flex shrink-0 flex-col items-center gap-8 text-center">
      <GreetingHeading
        class="pt-12"
        :user-name
        :title="t('agent.greetingQuestion')"
      />
      <div
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
          @click="
            onPromptClick(suggestion.prompt, suggestion.text, suggestion.index)
          "
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
