<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import type { AgentGreeting } from '@/workbench/extensions/agent/types/proactiveGreeting'
import { proactiveGreetingCopy } from '@/workbench/extensions/agent/utils/proactiveGreetingCopy'
import { speechTiming } from '@/workbench/extensions/agent/utils/speechTiming'

import GreetingHeading from './GreetingHeading.vue'
import SpokenText from './SpokenText.vue'

const { greeting, userName } = defineProps<{
  greeting: AgentGreeting
  userName?: string
}>()
const emit = defineEmits<{ prefilled: [delayMs: number] }>()
const { t } = useI18n()
const composer = useAgentComposerStore()
const copy = computed(() => proactiveGreetingCopy(greeting))
function translateCopy(key: string): string {
  return greeting.copyLocale
    ? t(key, {}, { locale: greeting.copyLocale })
    : t(key)
}
const title = computed(() => translateCopy(copy.value.title))
const description = computed(() => translateCopy(copy.value.description))
const prefill = computed(() =>
  copy.value.prefill ? translateCopy(copy.value.prefill) : undefined
)
const timing = computed(() => {
  const { starts, next } = speechTiming([
    { text: t('agent.greeting', { name: userName ?? t('agent.friend') }) },
    { text: title.value, pauseBeforeMs: 250 },
    { text: description.value, pauseBeforeMs: 150 }
  ])
  return {
    intro: starts[0],
    title: starts[1],
    description: starts[2],
    followUp: next + 100
  }
})
watch(
  prefill,
  (text, _previous, onCleanup) => {
    if (!text) return
    const release = composer.prefillGreeting(text)
    if (!release) return
    onCleanup(release)
    emit('prefilled', timing.value.followUp)
  },
  { immediate: true, flush: 'post' }
)
</script>

<template>
  <div class="flex h-full flex-col overflow-x-hidden overflow-y-auto px-4 py-8">
    <div
      class="mx-auto my-auto flex w-full max-w-88 shrink-0 flex-col items-center gap-4 pt-12 text-center"
    >
      <div class="flex flex-col items-center gap-2">
        <GreetingHeading :user-name :title :timing />
        <p class="my-0 text-sm/5 text-muted-foreground">
          <SpokenText :text="description" :start-ms="timing.description" />
        </p>
      </div>
    </div>
  </div>
</template>
