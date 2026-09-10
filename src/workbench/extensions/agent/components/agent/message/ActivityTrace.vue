<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { ActivityRow } from '../../../services/agent/agentActivityRows'
import { foldActivity } from '../../../services/agent/agentActivityRows'
import type {
  ActivityPart,
  PartState
} from '../../../services/agent/agentMessageParts'
import { toolGlyph, toolLabel } from '../../../services/agent/agentToolGlyph'
import { formatDurationCompact } from '../../../utils/formatDuration'

const { parts } = defineProps<{
  parts: readonly ActivityPart[]
}>()

const { t } = useI18n()

const rows = computed(() => foldActivity(parts))

const LABEL = 'text-agent-fg-muted min-w-0 text-sm/5'
const LABEL_STREAMING = `${LABEL} agent-shimmer-text`

function labelClass(state: PartState): string {
  return state === 'streaming' ? LABEL_STREAMING : LABEL
}

function glyphOf(row: ActivityRow): string {
  return row.kind === 'thinking'
    ? 'icon-[lucide--brain]'
    : toolGlyph(row.name, row.state, row.ok)
}

// Every part object is rebuilt on each token, so a settled row is only
// recognisable as unchanged by its contents.
function rowSignature(row: ActivityRow): string {
  return row.kind === 'tool'
    ? `tool:${row.name}:${row.state}:${row.ok}:${row.count}:${row.durationMs}`
    : `think:${row.state}:${row.durationMs}:${row.text}`
}
</script>

<template>
  <div role="list" class="flex flex-col">
    <div
      v-for="(row, index) in rows"
      :key="index"
      v-memo="[rowSignature(row), index === rows.length - 1]"
      role="listitem"
      class="flex gap-2 px-2"
    >
      <div class="flex w-4 shrink-0 flex-col items-center">
        <span
          :class="
            cn('text-agent-fg-subtle mt-0.5 size-4 shrink-0', glyphOf(row))
          "
        />
        <span
          v-if="index < rows.length - 1"
          class="bg-agent-border mt-1 w-px flex-1"
        />
      </div>
      <div class="flex min-w-0 flex-1 items-start gap-2 pb-3">
        <span
          v-if="row.kind === 'thinking'"
          :class="
            cn(labelClass(row.state), 'wrap-break-word whitespace-pre-wrap')
          "
          >{{ row.text || t('agent.thinking') }}</span
        >
        <template v-else>
          <span :class="labelClass(row.state)">{{
            toolLabel(row.name, row.state, t)
          }}</span>
          <span
            v-if="row.count > 1"
            class="text-agent-fg-subtle mt-0.5 shrink-0 text-xs"
            >×{{ row.count }}</span
          >
        </template>
        <span
          v-if="row.durationMs !== undefined"
          class="text-agent-fg-subtle mt-0.5 ml-auto shrink-0 font-mono text-xs/4"
          >{{ formatDurationCompact(row.durationMs) }}</span
        >
      </div>
    </div>
  </div>
</template>
