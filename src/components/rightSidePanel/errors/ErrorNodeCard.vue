<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div
      v-if="card.nodeId && !compact"
      class="flex flex-wrap items-center gap-2 py-2"
    >
      <button
        v-if="hasRuntimeError && (card.nodeTitle || card.title)"
        type="button"
        class="m-0 min-w-0 flex-1 cursor-pointer appearance-none truncate border-0 bg-transparent p-0 text-left text-sm font-medium text-muted-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:underline focus-visible:ring-0 focus-visible:outline-none"
        @click="handleLocateNode"
      >
        {{ card.nodeTitle || card.title }}
      </button>
      <span
        v-else-if="card.nodeTitle || card.title"
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
          v-if="hasRuntimeError"
          variant="textonly"
          size="icon-sm"
          :class="
            cn(
              'size-8 shrink-0 text-muted-foreground hover:text-base-foreground',
              runtimeDetailsExpanded &&
                'bg-secondary-background-selected text-base-foreground hover:bg-secondary-background-selected'
            )
          "
          :aria-label="t('g.details')"
          :aria-controls="runtimeDetailsControlIds || undefined"
          :aria-expanded="runtimeDetailsExpanded"
          @click.stop="toggleRuntimeDetails"
        >
          <i class="icon-[lucide--monitor-x] size-4" />
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

    <div
      class="flex min-h-0 flex-1 flex-col space-y-4 divide-y divide-interface-stroke/20"
    >
      <div
        v-for="(error, idx) in card.errors"
        :key="idx"
        class="flex min-h-0 flex-col gap-3"
      >
        <p
          v-if="getInlineMessage(error)"
          class="m-0 max-h-[4lh] overflow-y-auto px-0.5 text-sm/relaxed wrap-break-word whitespace-pre-wrap"
        >
          {{ getInlineMessage(error) }}
        </p>

        <ul
          v-if="getInlineItemLabel(error)"
          class="m-0 list-disc space-y-1 pl-5 text-sm/relaxed text-muted-foreground marker:text-muted-foreground"
        >
          <li class="min-w-0 wrap-break-word">
            <button
              v-if="card.nodeId"
              type="button"
              class="m-0 inline max-w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-left text-sm/relaxed font-normal wrap-break-word text-muted-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:underline focus-visible:ring-0 focus-visible:outline-none"
              @click="handleLocateNode"
            >
              {{ getInlineItemLabel(error) }}
            </button>
            <span v-else>
              {{ getInlineItemLabel(error) }}
            </span>
          </li>
        </ul>

        <div
          v-if="!error.isRuntimeError && getInlineDetails(error, idx)"
          :class="
            cn(
              'overflow-y-auto rounded-lg border border-interface-stroke/30 bg-secondary-background p-2.5',
              'max-h-[6lh]'
            )
          "
        >
          <p
            class="m-0 font-mono text-xs/relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground"
          >
            {{ getInlineDetails(error, idx) }}
          </p>
        </div>

        <TransitionCollapse>
          <div
            v-if="error.isRuntimeError && isRuntimeDisclosureExpanded"
            :id="getRuntimeDetailsId(idx)"
            role="region"
            data-testid="runtime-error-panel"
            :aria-label="t('rightSidePanel.errorLog')"
            class="flex min-h-0 flex-col gap-3"
          >
            <div
              v-if="getInlineDetails(error, idx)"
              class="overflow-hidden rounded-lg border border-interface-stroke/30 bg-secondary-background"
            >
              <div
                class="flex items-center justify-between gap-2 px-3 pt-3 pb-2"
              >
                <span
                  class="text-xs font-semibold tracking-wide text-base-foreground uppercase"
                >
                  {{ t('rightSidePanel.errorLog') }}
                </span>
                <Button
                  variant="textonly"
                  size="icon-sm"
                  class="size-7 shrink-0 text-muted-foreground hover:text-base-foreground"
                  :aria-label="t('g.copy')"
                  data-testid="error-card-copy"
                  @click="handleCopyError(idx)"
                >
                  <i class="icon-[lucide--copy] size-4" />
                </Button>
              </div>
              <div class="max-h-[15lh] overflow-y-auto px-3 pb-3">
                <p
                  class="m-0 font-mono text-xs/relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground"
                >
                  {{ getInlineDetails(error, idx) }}
                </p>
              </div>

              <div class="mx-3 mt-1 h-px bg-base-foreground/20" />
              <div class="mx-3 flex items-center justify-between gap-2 py-2">
                <Button
                  v-tooltip.top="t('rightSidePanel.getHelpTooltip')"
                  variant="textonly"
                  size="sm"
                  class="h-8 justify-start gap-1 rounded-lg px-0 text-sm hover:bg-transparent hover:text-base-foreground"
                  @click="handleGetHelp"
                >
                  <i class="icon-[lucide--external-link] size-3.5" />
                  {{ t('g.getHelpAction') }}
                </Button>
                <Button
                  v-tooltip.top="t('rightSidePanel.findOnGithubTooltip')"
                  variant="textonly"
                  size="sm"
                  class="h-8 justify-end gap-1 rounded-lg px-0 text-sm hover:bg-transparent hover:text-base-foreground"
                  data-testid="error-card-find-on-github"
                  @click="handleCheckGithub(error)"
                >
                  <i class="icon-[lucide--github] size-3.5" />
                  {{ t('g.findOnGithub') }}
                </Button>
              </div>
            </div>
          </div>
        </TransitionCollapse>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'
import TransitionCollapse from '../layout/TransitionCollapse.vue'

import type { ErrorCardData, ErrorItem } from './types'
import { useErrorActions } from './useErrorActions'
import { useErrorReport } from './useErrorReport'

const { card, compact = false } = defineProps<{
  card: ErrorCardData
  compact?: boolean
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
  enterSubgraph: [nodeId: string]
  copyToClipboard: [text: string]
}>()

const { t } = useI18n()
const { displayedDetailsMap } = useErrorReport(() => card)
const { findOnGitHub, contactSupport: handleGetHelp } = useErrorActions()
const runtimeDetailsExpanded = ref(true)
const hasRuntimeError = computed(() =>
  card.errors.some((error) => error.isRuntimeError)
)
const isRuntimeDisclosureExpanded = computed(
  () => compact || runtimeDetailsExpanded.value
)
const runtimeDetailsControlIds = computed(() =>
  card.errors
    .map((error, idx) => (error.isRuntimeError ? getRuntimeDetailsId(idx) : ''))
    .filter(Boolean)
    .join(' ')
)

function toggleRuntimeDetails() {
  runtimeDetailsExpanded.value = !runtimeDetailsExpanded.value
}

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
  const message = getCopyMessage(card.errors[idx])
  emit('copyToClipboard', [message, details].filter(Boolean).join('\n\n'))
}

function handleCheckGithub(error: ErrorItem) {
  findOnGitHub(error.message)
}

function getCopyMessage(error: ErrorItem | undefined) {
  return error?.displayMessage ?? error?.message
}

function getInlineMessage(error: ErrorItem | undefined) {
  if (!error || error.displayMessage) return undefined
  return error.message
}

function getInlineItemLabel(error: ErrorItem | undefined) {
  if (!error || error.isRuntimeError) return undefined
  return error.displayItemLabel
}

function getInlineDetails(error: ErrorItem | undefined, idx: number) {
  if (getInlineItemLabel(error)) return undefined
  return displayedDetailsMap.value[idx]
}

function getRuntimeDetailsId(idx: number) {
  return `${card.id}-runtime-details-${idx}`
}
</script>
