<script setup lang="ts">
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

// What a resolved card reads back: the settled options by label, plus this
// client's own free text when it was part of the answer. An id the card never
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
</script>

<template>
  <div role="status" class="flex min-w-0 flex-col gap-1 text-sm/5">
    <template v-if="resolution.answered">
      <p class="m-0 text-xs/5 text-muted-foreground">
        {{ t('agent.askUser.answered') }}
      </p>
      <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
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
    </template>
    <p v-else class="m-0 text-muted-foreground">
      {{ t('agent.askUser.closed') }}
    </p>
  </div>
</template>
