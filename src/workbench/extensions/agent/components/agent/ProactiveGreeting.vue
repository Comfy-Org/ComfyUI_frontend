<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import type { AgentGreeting } from '../../types/proactiveGreeting'

const { greeting, userName } = defineProps<{
  greeting: AgentGreeting
  userName?: string
}>()
const emit = defineEmits<{ insert: [text: string] }>()

const { t } = useI18n()

const key = computed(() => `agent.proactiveGreeting.${greeting.kind}`)
const params = computed(() =>
  greeting.kind === 'unconnectedInput'
    ? { node: greeting.node, input: greeting.input }
    : {}
)

const asked = ref(false)

function onAsk(): void {
  asked.value = true
  emit('insert', t(`${key.value}.prompt`, params.value))
}

onMounted(() => {
  if (greeting.kind === 'workflowOpen' || greeting.kind === 'firstOpen')
    emit('insert', t(`${key.value}.prompt`))
})
</script>

<template>
  <div class="flex h-full flex-col overflow-x-hidden overflow-y-auto px-4 py-8">
    <div
      class="mx-auto my-auto flex w-full max-w-88 shrink-0 flex-col items-center gap-4 pt-12 text-center"
    >
      <div class="flex flex-col items-center gap-2">
        <p class="my-0 text-base font-semibold text-base-foreground">
          {{ t('agent.greeting', { name: userName ?? t('agent.friend') }) }}
          <br />
          {{ t(`${key}.title`) }}
        </p>
        <p class="my-0 text-sm/5 text-muted-foreground">
          {{ t(`${key}.description`, params) }}
        </p>
      </div>
      <Button
        v-if="greeting.kind === 'unconnectedInput'"
        type="button"
        variant="inverted"
        size="sm"
        :disabled="asked"
        @click="onAsk"
      >
        <i
          class="icon-[lucide--circle-question-mark] size-3 shrink-0"
          aria-hidden="true"
        />
        {{ t(`${key}.action`) }}
      </Button>
    </div>
  </div>
</template>
