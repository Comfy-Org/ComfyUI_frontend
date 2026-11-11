<template>
  <section
    data-testid="point-at-it-tray"
    class="flex flex-col gap-2 rounded-lg border border-solid border-border bg-background p-3 text-xs shadow-md"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="font-medium">{{ messages.trayTitle }}</span>
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
    <ol
      v-if="annotations.length > 0"
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
            <span v-if="isMissing(annotation.id)" class="text-destructive">
              {{ messages.targetMissing }}
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
    <div v-if="failure" role="alert" class="flex items-center gap-2">
      <span class="flex-1 text-destructive">{{ failureText[failure] }}</span>
      <Button size="sm" @click="emit('retry')">{{ messages.retry }}</Button>
    </div>
    <div class="flex items-center gap-2">
      <Button
        size="sm"
        variant="primary"
        :disabled="!canEdit || annotations.length === 0"
        @click="emit('send')"
      >
        {{ messages.send(annotations.length) }}
      </Button>
      <Button
        size="sm"
        :disabled="!canEdit || annotations.length === 0"
        @click="emit('clear')"
      >
        {{ messages.clear }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import type { Annotation } from './annotationList'
import { failureText, messages } from './messages'
import type { PointState, RequestFailure } from './pointState'
import type { PinView } from './usePointSession'

const { annotations, pins, phase, waitingSince, failure } = defineProps<{
  annotations: readonly Annotation[]
  pins: PinView[]
  phase: PointState['phase']
  waitingSince: number | null
  failure: RequestFailure['kind'] | null
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

function isMissing(annotationId: string): boolean {
  return pins.some((pin) => pin.id === annotationId && pin.missing)
}
</script>
