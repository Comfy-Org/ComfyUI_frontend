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
        :class="
          cn(
            'flex min-h-0 flex-col gap-3',
            fullHeight && error.isRuntimeError && 'flex-1'
          )
        "
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
          v-if="displayedDetailsMap[idx]"
          :class="
            cn(
              'overflow-y-auto rounded-lg border border-interface-stroke/30 bg-secondary-background-hover p-2.5',
              error.isRuntimeError
                ? fullHeight
                  ? 'min-h-0 flex-1'
                  : 'max-h-[15lh]'
                : 'max-h-[6lh]'
            )
          "
        >
          <p
            class="m-0 font-mono text-xs/relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground"
          >
            {{ displayedDetailsMap[idx] }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex gap-2">
            <Button
              v-tooltip.top="t('rightSidePanel.findOnGithubTooltip')"
              variant="secondary"
              size="sm"
              class="h-8 w-2/3 justify-center gap-1 rounded-lg text-xs"
              data-testid="error-card-find-on-github"
              @click="handleCheckGithub(error)"
            >
              {{ t('g.findOnGithub') }}
              <i class="icon-[lucide--github] size-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              class="h-8 w-1/3 justify-center gap-1 rounded-lg text-xs"
              data-testid="error-card-copy"
              @click="handleCopyError(idx)"
            >
              {{ t('g.copy') }}
              <i class="icon-[lucide--copy] size-3.5" />
            </Button>
          </div>
          <Button
            v-tooltip.top="t('rightSidePanel.getHelpTooltip')"
            variant="secondary"
            size="sm"
            class="h-8 w-full justify-center gap-1 rounded-lg text-xs"
            @click="handleGetHelp"
          >
            {{ t('g.getHelpAction') }}
            <i class="icon-[lucide--external-link] size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

import type { ErrorCardData, ErrorItem } from './types'
import { useErrorActions } from './useErrorActions'
import { useErrorReport } from './useErrorReport'

const {
  card,
  showNodeIdBadge = false,
  compact = false,
  fullHeight = false
} = defineProps<{
  card: ErrorCardData
  showNodeIdBadge?: boolean
  /** Hide card header and error message (used in single-node selection mode) */
  compact?: boolean
  /** Allow runtime error details to fill available height (used in dedicated panel) */
  fullHeight?: boolean
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
  enterSubgraph: [nodeId: string]
  copyToClipboard: [text: string]
}>()

const { t } = useI18n()
const { displayedDetailsMap } = useErrorReport(() => card)
const { findOnGitHub, contactSupport: handleGetHelp } = useErrorActions()

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

function handleCopyError(idx: number) {
  const details = displayedDetailsMap.value[idx]
  const message = card.errors[idx]?.message
  emit('copyToClipboard', [message, details].filter(Boolean).join('\n\n'))
}

function handleCheckGithub(error: ErrorItem) {
  findOnGitHub(error.message)
}
</script>
