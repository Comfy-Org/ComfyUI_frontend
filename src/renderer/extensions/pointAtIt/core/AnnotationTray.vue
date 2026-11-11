<template>
  <section
    data-testid="point-at-it-tray"
    class="flex flex-col gap-2 rounded-lg border border-solid border-border bg-background p-3 text-xs shadow-md"
  >
    <div class="flex items-center gap-2">
      <span class="flex-1 font-medium">{{ messages.trayTitle }}</span>
      <Button
        v-if="annotations.length > 0"
        variant="textonly"
        size="icon-sm"
        :aria-label="listOpen ? messages.hideComments : messages.showComments"
        :aria-expanded="listOpen"
        @click="listOpen = !listOpen"
      >
        <i
          :class="
            cn(
              'size-3',
              listOpen
                ? 'icon-[lucide--chevron-down]'
                : 'icon-[lucide--chevron-up]'
            )
          "
          aria-hidden="true"
        />
      </Button>
      <Button
        size="sm"
        :variant="phase === 'annotating' ? 'primary' : 'secondary'"
        :aria-pressed="phase === 'annotating'"
        :disabled="!canToggle"
        @click="emit('toggle')"
      >
        {{ messages.annotate }}
        <kbd class="rounded-sm border border-solid border-border px-1">
          {{ messages.annotateKey }}
        </kbd>
      </Button>
    </div>
    <p v-if="hint" class="m-0 text-muted-foreground">{{ hint }}</p>
    <p
      v-if="annotations.length > 0 && !listOpen"
      class="m-0 text-muted-foreground"
    >
      {{ messages.commentCount(annotations.length) }}
    </p>
    <ol
      v-if="annotations.length > 0 && listOpen"
      class="m-0 flex max-h-48 list-none flex-col gap-1 overflow-y-auto p-0"
    >
      <li v-for="(annotation, index) in annotations" :key="annotation.id">
        <Button
          variant="textonly"
          size="unset"
          class="w-full items-start justify-start gap-2 rounded-md p-1 text-left whitespace-normal"
          :disabled="!canEdit"
          @click="emit('open', annotation.id)"
        >
          <span
            class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary"
          >
            {{ index + 1 }}
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-muted-foreground">
              {{ annotation.label }}
            </span>
            <span class="wrap-break-word">{{ annotation.comment }}</span>
            <span v-if="placeNote(annotation.id)" class="text-destructive">
              {{ placeNote(annotation.id) }}
            </span>
          </span>
        </Button>
      </li>
    </ol>
    <div
      v-if="phase === 'waiting'"
      role="status"
      class="flex items-center gap-2 text-muted-foreground"
    >
      <i
        class="icon-[lucide--loader-circle] motion-safe:animate-spin"
        aria-hidden="true"
      />
      <span class="flex-1">{{ messages.waiting(elapsedSeconds) }}</span>
      <Button size="sm" @click="emit('cancel')">{{ messages.cancel }}</Button>
    </div>
    <div v-if="thinking" class="flex flex-col gap-1">
      <p
        v-if="thinking.done && !thinking.text"
        class="m-0 text-muted-foreground"
      >
        {{ messages.noThinking }}
      </p>
      <template v-else>
        <Button
          variant="textonly"
          size="unset"
          class="justify-start gap-1 self-start rounded-sm px-1 text-muted-foreground"
          :aria-label="
            thinkingOpen ? messages.hideThinking : messages.showThinking
          "
          :aria-expanded="thinkingOpen"
          @click="thinkingOpen = !thinkingOpen"
        >
          <i
            :class="
              cn(
                'size-3',
                thinkingOpen
                  ? 'icon-[lucide--chevron-down]'
                  : 'icon-[lucide--chevron-right]'
              )
            "
            aria-hidden="true"
          />
          {{ messages.thinking }}
        </Button>
        <p
          v-if="thinkingOpen"
          role="log"
          tabindex="0"
          :aria-label="messages.thinking"
          class="m-0 max-h-40 overflow-y-auto rounded-md bg-secondary p-2 whitespace-pre-wrap text-muted-foreground"
        >
          {{ thinking.text }}
        </p>
        <p
          v-else-if="phase === 'waiting' && thinking.text"
          role="log"
          :aria-label="messages.thinking"
          class="m-0 line-clamp-2 text-muted-foreground"
        >
          {{ thinkingTail }}
        </p>
      </template>
    </div>
    <div v-if="failure" role="alert" class="flex items-start gap-2">
      <span class="flex-1 wrap-break-word text-destructive">
        {{ describeFailure(failure) }}
      </span>
      <Button size="sm" @click="emit('retry')">{{ messages.retry }}</Button>
    </div>
    <div class="flex items-center justify-end gap-2">
      <Button
        size="sm"
        :disabled="!canEdit || annotations.length === 0"
        @click="emit('clear')"
      >
        {{ messages.clear }}
      </Button>
      <Button
        size="sm"
        variant="primary"
        :disabled="!canEdit || annotations.length === 0"
        @click="emit('send')"
      >
        {{ messages.send(annotations.length) }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { computed, ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import type { Annotation } from './annotationList'
import { describeFailure, messages } from './messages'
import type { PointState, RequestFailure } from './pointState'
import type { ThinkingLog } from './thinkingLog'
import type { PinView } from './usePointSession'

const TAIL_CHARS = 160

const { annotations, pins, phase, waitingSince, failure, thinking } =
  defineProps<{
    annotations: readonly Annotation[]
    pins: PinView[]
    phase: PointState['phase']
    waitingSince: number | null
    failure: RequestFailure | null
    thinking: ThinkingLog | null
  }>()

const emit = defineEmits<{
  toggle: []
  open: [annotationId: string]
  send: []
  clear: []
  cancel: []
  retry: []
}>()

const now = useTimestamp({ interval: 500 })
const listOpen = ref(true)
const thinkingOpen = ref(false)

const canEdit = computed(
  () => phase === 'idle' || phase === 'annotating' || phase === 'failed'
)
const canToggle = computed(() => canEdit.value || phase === 'guiding')
const elapsedSeconds = computed(() =>
  waitingSince === null
    ? 0
    : Math.max(0, Math.floor((now.value - waitingSince) / 1000))
)
const hint = computed(() => {
  if (phase === 'annotating') return messages.annotateHint
  return phase === 'idle' && annotations.length === 0
    ? messages.annotateIdle
    : ''
})
const thinkingTail = computed(() => {
  const text = thinking?.text.trim() ?? ''
  return text.length > TAIL_CHARS ? `…${text.slice(-TAIL_CHARS)}` : text
})

function placeNote(annotationId: string): string {
  const pin = pins.find((candidate) => candidate.id === annotationId)
  if (!pin || pin.rect) return ''
  return pin.missing ? messages.targetMissing : messages.notOnScreen
}
</script>
