<template>
  <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
    <div v-if="card.nodeId" class="flex min-h-8 flex-wrap items-center gap-2">
      <span class="flex min-w-0 flex-1">
        <button
          v-if="hasRuntimeError && (card.nodeTitle || card.title)"
          type="button"
          class="focus-visible:ring-ring m-0 max-w-full min-w-0 cursor-pointer appearance-none truncate rounded-sm border-0 bg-transparent p-0 text-left text-xs font-normal text-base-foreground outline-none focus:outline-none focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset"
          @click="handleLocateNode"
        >
          {{ card.nodeTitle || card.title }}
        </button>
        <span
          v-else-if="card.nodeTitle || card.title"
          class="max-w-full min-w-0 truncate text-xs font-normal text-base-foreground"
        >
          {{ card.nodeTitle || card.title }}
        </span>
      </span>
      <div class="flex shrink-0 items-center">
        <Button
          v-if="hasRuntimeError"
          variant="textonly"
          size="icon-sm"
          :class="
            cn(
              'size-8 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset',
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
          class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset"
          :aria-label="t('rightSidePanel.locateNode')"
          @click.stop="handleLocateNode"
        >
          <i class="icon-[lucide--locate] size-4" />
        </Button>
      </div>
    </div>

    <div
      class="flex min-h-0 flex-1 flex-col space-y-2 divide-y divide-interface-stroke/20"
    >
      <div
        v-for="(error, idx) in card.errors"
        :key="idx"
        class="flex min-h-0 flex-col gap-1"
      >
        <p
          v-if="getInlineMessage(error)"
          class="m-0 max-h-[4lh] overflow-y-auto px-0.5 text-xs/relaxed wrap-break-word whitespace-pre-wrap"
        >
          {{ getInlineMessage(error) }}
        </p>

        <ul
          v-if="getInlineItemLabel(error)"
          class="m-0 list-disc space-y-1 pl-5 text-xs/relaxed text-muted-foreground marker:text-muted-foreground"
        >
          <li class="min-w-0 wrap-break-word">
            <button
              v-if="card.nodeId"
              type="button"
              class="focus-visible:ring-ring m-0 inline max-w-full cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left text-sm/relaxed font-normal wrap-break-word text-muted-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset"
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
              'overflow-y-auto rounded-lg bg-base-foreground/5 p-3',
              'max-h-[6lh]'
            )
          "
        >
          <p
            class="m-0 text-xs/normal wrap-break-word whitespace-pre-wrap text-base-foreground/50"
          >
            {{ getInlineDetails(error, idx) }}
          </p>
        </div>

        <TransitionCollapse>
          <div
            v-if="error.isRuntimeError && runtimeDetailsExpanded"
            :id="getRuntimeDetailsId(idx)"
            role="region"
            data-testid="runtime-error-panel"
            :aria-label="t('rightSidePanel.errorLog')"
            class="flex min-h-0 flex-col gap-1"
          >
            <div
              v-if="getInlineDetails(error, idx)"
              class="flex flex-col gap-3 rounded-lg bg-base-foreground/5 p-3"
            >
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between gap-1 py-1">
                  <span
                    class="text-xs font-semibold text-base-foreground uppercase"
                  >
                    {{ t('rightSidePanel.errorLog') }}
                  </span>
                  <Button
                    variant="textonly"
                    size="icon-sm"
                    class="size-7 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset"
                    :aria-label="t('g.copy')"
                    data-testid="error-card-copy"
                    @click="handleCopyError(idx)"
                  >
                    <i class="icon-[lucide--copy] size-4" />
                  </Button>
                </div>
                <div class="max-h-[15lh] overflow-y-auto">
                  <p
                    class="m-0 text-xs/normal wrap-break-word whitespace-pre-wrap text-base-foreground/50"
                  >
                    {{ getInlineDetails(error, idx) }}
                  </p>
                </div>
              </div>

              <div aria-hidden="true" class="h-px w-full bg-interface-stroke" />

              <div class="flex items-center justify-between gap-2">
                <Button
                  v-tooltip.top="t('rightSidePanel.getHelpTooltip')"
                  variant="textonly"
                  size="sm"
                  class="justify-start gap-1 px-0 text-xs hover:bg-transparent hover:text-base-foreground focus-visible:ring-inset"
                  @click="handleGetHelp"
                >
                  <i class="icon-[lucide--external-link] size-4" />
                  {{ t('g.getHelpAction') }}
                </Button>
                <Button
                  v-tooltip.top="t('rightSidePanel.findOnGithubTooltip')"
                  variant="textonly"
                  size="sm"
                  class="justify-end gap-1 px-0 text-xs hover:bg-transparent hover:text-base-foreground focus-visible:ring-inset"
                  data-testid="error-card-find-on-github"
                  @click="handleCheckGithub(error)"
                >
                  <i class="icon-[lucide--github] size-4" />
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

const { card } = defineProps<{
  card: ErrorCardData
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
  copyToClipboard: [text: string]
}>()

const { t } = useI18n()
const { displayedDetailsMap } = useErrorReport(() => card)
const { findOnGitHub, contactSupport: handleGetHelp } = useErrorActions()
const runtimeDetailsExpanded = ref(true)
const hasRuntimeError = computed(() =>
  card.errors.some((error) => error.isRuntimeError)
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
