<template>
  <div class="overflow-hidden">
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
        v-if="card.nodeTitle"
        class="flex-1 truncate text-sm font-medium text-muted-foreground"
      >
        {{ card.nodeTitle }}
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
    <div class="space-y-4 divide-y divide-interface-stroke/20">
      <!-- Card Content -->
      <div
        v-for="(error, idx) in card.errors"
        :key="idx"
        class="flex flex-col gap-3"
      >
        <!-- Error Message -->
        <p
          v-if="error.message"
          class="m-0 max-h-[4lh] overflow-y-auto px-0.5 text-sm/relaxed wrap-break-word whitespace-pre-wrap"
        >
          {{ error.message }}
        </p>

        <!-- Traceback / Details -->
        <div
          v-if="error.details"
          :class="
            cn(
              'overflow-y-auto rounded-lg border border-interface-stroke/30 bg-secondary-background-hover p-2.5',
              error.isRuntimeError ? 'max-h-[10lh]' : 'max-h-[6lh]'
            )
          "
        >
          <p
            class="m-0 font-mono text-xs/relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground"
          >
            {{ error.details }}
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          class="h-8 w-full justify-center gap-2 text-xs"
          @click="handleCopyError(error)"
        >
          <i class="icon-[lucide--copy] size-3.5" />
          {{ t('g.copy') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

import type { ErrorCardData, ErrorItem } from './types'

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

function handleCopyError(error: ErrorItem) {
  emit(
    'copyToClipboard',
    [error.message, error.details].filter(Boolean).join('\n\n')
  )
}
</script>
