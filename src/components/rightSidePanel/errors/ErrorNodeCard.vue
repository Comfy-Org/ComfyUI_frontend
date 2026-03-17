<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <!-- Card Header -->
    <div
      v-if="card.nodeId && !compact"
      class="flex flex-wrap items-center gap-2 py-2"
    >
      <span
        v-if="showNodeIdBadge"
        class="shrink-0 rounded-md bg-secondary-background-selected px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground"
      >
        #{{ card.nodeId }}
      </span>
      <span
        v-if="card.nodeTitle || card.title"
        class="flex-1 truncate text-sm font-medium text-muted-foreground"
      >
        {{ card.nodeTitle || card.title }}
      </span>
      <div class="flex shrink-0 items-center">
        <Button
          v-if="card.isSubgraphNode"
          variant="secondary"
          size="sm"
          class="h-8 shrink-0 rounded-lg text-sm"
          @click.stop="handleEnterSubgraph"
        >
          {{ t('rightSidePanel.enterSubgraph') }}
        </Button>
        <Button
          variant="textonly"
          size="icon-sm"
          class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
          :aria-label="t('rightSidePanel.locateNode')"
          @click.stop="handleLocateNode"
        >
          <i class="icon-[lucide--locate] size-4" />
        </Button>
      </div>
    </div>

    <!-- Multiple Errors within one Card -->
    <div
      class="flex min-h-0 flex-1 flex-col space-y-4 divide-y divide-interface-stroke/20"
    >
      <!-- Card Content -->
      <div
        v-for="(error, idx) in card.errors"
        :key="idx"
        class="flex min-h-0 flex-1 flex-col gap-3"
      >
        <!-- Error Message -->
        <p
          v-if="error.message"
          class="m-0 max-h-[4lh] overflow-y-auto px-0.5 text-sm/relaxed wrap-break-word whitespace-pre-wrap"
        >
          {{ error.message }}
        </p>

        <!-- Traceback / Details (enriched with full report for runtime errors) -->
        <div
          v-if="getDisplayedDetails(error, idx)"
          :class="
            cn(
              'overflow-y-auto rounded-lg border border-interface-stroke/30 bg-secondary-background-hover p-2.5',
              error.isRuntimeError ? 'min-h-0 flex-1' : 'max-h-[6lh]'
            )
          "
        >
          <p
            class="m-0 font-mono text-xs/relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground"
          >
            {{ getDisplayedDetails(error, idx) }}
          </p>
        </div>

        <div class="flex gap-2">
          <Button
            v-tooltip.top="t('g.findIssueOnGithub')"
            variant="secondary"
            size="sm"
            class="h-8 flex-1 justify-center gap-2 text-xs"
            :aria-label="t('g.findIssueOnGithub')"
            @click="handleCheckGithub(error)"
          >
            <i class="icon-[lucide--github] size-3.5" />
            {{ t('g.findIssueOnGithub') }}
          </Button>
          <Button
            v-tooltip.top="t('g.copy')"
            variant="secondary"
            size="icon"
            class="size-8 shrink-0"
            :aria-label="t('g.copy')"
            @click="handleCopyError(error, idx)"
          >
            <i class="icon-[lucide--copy] size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useTelemetry } from '@/platform/telemetry'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { generateErrorReport } from '@/utils/errorReportUtil'
import { cn } from '@/utils/tailwindUtil'

import type { ErrorCardData, ErrorItem } from './types'

/** Module-level cache: persists across tab switches to avoid repeated async calls. */
const reportCache = new Map<string, string>()

const {
  card,
  showNodeIdBadge = false,
  compact = false
} = defineProps<{
  card: ErrorCardData
  showNodeIdBadge?: boolean
  /** Hide card header and error message (used in single-node selection mode) */
  compact?: boolean
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
  enterSubgraph: [nodeId: string]
  copyToClipboard: [text: string]
}>()

const { t } = useI18n()
const systemStatsStore = useSystemStatsStore()

const enrichedDetails = reactive<Record<number, string>>({})

function getDisplayedDetails(
  error: ErrorItem,
  idx: number
): string | undefined {
  return enrichedDetails[idx] ?? error.details
}

onMounted(async () => {
  const runtimeErrors = card.errors
    .map((error, idx) => ({ error, idx }))
    .filter(({ error }) => error.isRuntimeError)

  if (runtimeErrors.length === 0) return

  // Resolve cached entries first; collect uncached ones
  const uncached: typeof runtimeErrors = []
  for (const entry of runtimeErrors) {
    const cacheKey = `${card.id}-${entry.idx}`
    if (reportCache.has(cacheKey)) {
      enrichedDetails[entry.idx] = reportCache.get(cacheKey)!
    } else {
      uncached.push(entry)
    }
  }

  if (uncached.length === 0) return

  if (!systemStatsStore.systemStats) {
    await systemStatsStore.refetchSystemStats()
  }

  let logs: string
  try {
    logs = await api.getLogs()
  } catch {
    return
  }

  for (const { error, idx } of uncached) {
    try {
      const report = generateErrorReport({
        exceptionType: card.title,
        exceptionMessage: error.message,
        traceback: error.details,
        nodeId: card.nodeId,
        nodeType: card.title,
        systemStats: systemStatsStore.systemStats!,
        serverLogs: logs,
        workflow: app.rootGraph.serialize()
      })
      enrichedDetails[idx] = report
      reportCache.set(`${card.id}-${idx}`, report)
    } catch {
      // Fallback: keep original error.details
    }
  }
})

function handleLocateNode() {
  if (card.nodeId) {
    emit('locateNode', card.nodeId)
  }
}

function handleEnterSubgraph() {
  if (card.nodeId) {
    emit('enterSubgraph', card.nodeId)
  }
}

function handleCopyError(error: ErrorItem, idx: number) {
  const details = getDisplayedDetails(error, idx)
  emit('copyToClipboard', [error.message, details].filter(Boolean).join('\n\n'))
}

function handleCheckGithub(error: ErrorItem) {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'error_tab_find_existing_issues_clicked'
  })
  const query = encodeURIComponent(error.message + ' is:issue')
  window.open(
    `https://github.com/comfyanonymous/ComfyUI/issues?q=${query}`,
    '_blank',
    'noopener,noreferrer'
  )
}
</script>
