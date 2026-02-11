<script setup lang="ts">
/**
 * ErrorNodeCard.vue
 *
 * Displays a single error card within the error tab.
 * Contains the node header (ID badge, title, action buttons)
 * and the list of errors (message, traceback, copy button).
 */
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

import type { ErrorCardData } from './types'

const { card, showNodeIdBadge = false } = defineProps<{
  card: ErrorCardData
  showNodeIdBadge?: boolean
}>()

/**
 * @event locateNode - Pans the canvas to center on the node with the given ID.
 * @event enterSubgraph - Opens the subgraph that contains the specified node.
 * @event copyToClipboard - Copies the provided error text to the system clipboard.
 */
const emit = defineEmits<{
  locateNode: [nodeId: string]
  enterSubgraph: [nodeId: string]
  copyToClipboard: [text: string]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="overflow-hidden">
    <!-- Card Header (Node ID & Actions) -->
    <div v-if="card.nodeId" class="flex flex-wrap items-center gap-2 py-2">
      <span
        v-if="showNodeIdBadge"
        class="shrink-0 rounded-md bg-secondary-background-selected px-2 py-0.5 text-[10px] font-mono text-muted-foreground font-bold"
      >
        #{{ card.nodeId }}
      </span>
      <span
        v-if="card.nodeTitle"
        class="flex-1 text-sm text-muted-foreground truncate font-medium"
      >
        {{ card.nodeTitle }}
      </span>
      <Button
        v-if="card.isSubgraphNode"
        variant="secondary"
        size="sm"
        class="rounded-lg text-sm shrink-0"
        @click.stop="emit('enterSubgraph', card.nodeId!)"
      >
        {{ t('rightSidePanel.enterSubgraph') }}
      </Button>
      <Button
        variant="textonly"
        size="icon-sm"
        class="size-7 text-muted-foreground hover:text-base-foreground shrink-0"
        @click.stop="emit('locateNode', card.nodeId!)"
      >
        <i class="icon-[lucide--locate] size-3.5" />
      </Button>
    </div>

    <!-- Multiple Errors within one Card -->
    <div class="divide-y divide-interface-stroke/20 space-y-4">
      <!-- Card Content -->
      <div
        v-for="(error, idx) in card.errors"
        :key="idx"
        class="flex flex-col gap-3"
      >
        <!-- Error Message -->
        <p
          v-if="error.message"
          class="m-0 text-sm break-words whitespace-pre-wrap leading-relaxed px-0.5"
        >
          {{ error.message }}
        </p>

        <!-- Traceback / Details -->
        <div
          v-if="error.details"
          :class="
            cn(
              'rounded-lg bg-secondary-background-hover p-2.5 overflow-y-auto border border-interface-stroke/30',
              error.isRuntimeError ? 'max-h-[10lh]' : 'max-h-[6lh]'
            )
          "
        >
          <p
            class="m-0 text-[11px] text-muted-foreground break-words whitespace-pre-wrap font-mono leading-relaxed"
          >
            {{ error.details }}
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          class="w-full justify-center gap-2 h-8 text-[11px]"
          @click="
            emit(
              'copyToClipboard',
              [error.message, error.details].filter(Boolean).join('\n\n')
            )
          "
        >
          <i class="icon-[lucide--copy] size-3.5" />
          {{ t('g.copy') }}
        </Button>
      </div>
    </div>
  </div>
</template>
