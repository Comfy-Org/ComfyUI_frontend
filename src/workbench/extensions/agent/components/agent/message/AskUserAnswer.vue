<script setup lang="ts">
import type { AgentAskOption } from '@comfyorg/ingest-types'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AskUserResolution } from '@/workbench/extensions/agent/services/agent/agentMessageParts'

const { resolution, options } = defineProps<{
  resolution: AskUserResolution
  options: AgentAskOption[]
}>()

const { t } = useI18n()

const answers = computed(() => {
  if (resolution.status !== 'answered') return []
  const labels = new Map(options.map(({ id, label }) => [id, label]))
  const chosen = resolution.selected.map((id) => labels.get(id) ?? id)
  return resolution.otherText
    ? [
        ...chosen,
        t(
          'agent.askUser.otherAnswer',
          { text: resolution.otherText },
          { escapeParameter: false }
        )
      ]
    : chosen
})

const STATUS_TEXT: Record<AskUserResolution['status'], string> = {
  answered: 'agent.askUser.answered',
  closed: 'agent.askUser.closed',
  retired: 'agent.askUser.retired',
  unconfirmed: 'agent.askUser.unconfirmed'
}
</script>

<template>
  <div role="status" class="flex min-w-0 flex-col gap-1 text-sm/5">
    <p
      :class="
        cn('m-0 text-muted-foreground', answers.length > 0 && 'text-xs/5')
      "
    >
      {{ t(STATUS_TEXT[resolution.status]) }}
    </p>
    <ul
      v-if="answers.length > 0"
      class="m-0 flex list-none flex-col gap-0.5 p-0"
    >
      <li
        v-for="(answer, index) in answers"
        :key="index"
        class="flex items-start gap-2 text-foreground"
      >
        <i class="mt-0.5 icon-[lucide--check] shrink-0 text-primary" />
        <span class="min-w-0 wrap-break-word">{{ answer }}</span>
      </li>
    </ul>
  </div>
</template>
