<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  AskUserOption,
  AskUserResolution
} from '../../../services/agent/agentMessageParts'

const { resolution, options } = defineProps<{
  resolution: AskUserResolution
  options: AskUserOption[]
}>()

const { t } = useI18n()

// What a resolved card reads back: the settled options by label, plus any
// free text the server reported with it. An id the card never
// offered is shown as-is rather than dropped, so the record stays faithful to
// what the server settled.
const answers = computed(() => {
  const labels = new Map(options.map(({ id, label }) => [id, label]))
  const chosen = resolution.selected.map((id) => labels.get(id) ?? id)
  return resolution.otherText
    ? [
        ...chosen,
        t('agent.askUser.otherAnswer', { text: resolution.otherText })
      ]
    : chosen
})

const STATUS_TEXT: Record<AskUserResolution['status'], string> = {
  answered: 'agent.askUser.answered',
  closed: 'agent.askUser.closed',
  unknown: 'agent.askUser.unconfirmed'
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
      v-if="resolution.status === 'answered' && answers.length > 0"
      class="m-0 flex list-none flex-col gap-0.5 p-0"
    >
      <li
        v-for="(answer, index) in answers"
        :key="index"
        class="flex items-start gap-2 text-base-foreground"
      >
        <i
          class="mt-0.5 icon-[lucide--check] size-4 shrink-0 text-primary-background"
        />
        <span class="min-w-0 wrap-break-word">{{ answer }}</span>
      </li>
    </ul>
  </div>
</template>
