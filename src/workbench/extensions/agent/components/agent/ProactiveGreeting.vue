<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import GreetingHeading from './GreetingHeading.vue'
import SpokenText from './SpokenText.vue'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import type { AgentGreeting } from '../../types/proactiveGreeting'
import { speechTiming } from '../../utils/speechTiming'

const { greeting, userName } = defineProps<{
  greeting: AgentGreeting
  userName?: string
}>()
const emit = defineEmits<{ insert: [text: string, fadeInAfterMs?: number] }>()

const { t } = useI18n()

const key = computed(() => `agent.proactiveGreeting.${greeting.kind}`)
const params = computed(() =>
  greeting.kind === 'unconnectedInput'
    ? { node: greeting.node, input: greeting.input }
    : {}
)
const title = computed(() => t(`${key.value}.title`))
const description = computed(() => t(`${key.value}.description`, params.value))

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

const composerStore = useAgentComposerStore()
const prompt = computed(() => t(`${key.value}.prompt`, params.value))
const asked = computed(() => composerStore.draft.includes(prompt.value))

const prefills = computed(
  () => greeting.kind === 'workflowOpen' || greeting.kind === 'firstOpen'
)

function onAsk(): void {
  if (asked.value) return
  emit('insert', prompt.value)
}

onMounted(() => {
  if (prefills.value && composerStore.draft === '')
    emit('insert', prompt.value, timing.value.followUp)
})

onBeforeUnmount(() => {
  if (prefills.value && composerStore.draft === prompt.value)
    composerStore.setText('')
})
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
      <span
        v-if="greeting.kind === 'unconnectedInput'"
        class="agent-talk-word"
        :style="{ '--talk-delay': `${timing.followUp}ms` }"
      >
        <Button
          type="button"
          variant="inverted"
          size="sm"
          :disabled="asked"
          @click="onAsk"
        >
          {{ t(`${key}.action`) }}
        </Button>
      </span>
    </div>
  </div>
</template>
