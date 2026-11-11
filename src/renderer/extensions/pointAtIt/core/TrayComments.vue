<template>
  <ol v-if="comments.length > 0" class="m-0 flex list-none flex-col gap-1 p-0">
    <li v-for="comment in comments" :key="comment.annotation.id">
      <Button
        variant="textonly"
        size="unset"
        class="w-full items-start justify-start gap-2 rounded-md p-1 text-left whitespace-normal"
        :disabled
        @click="emit('open', comment.annotation.id)"
      >
        <span
          :class="
            cn(
              'flex size-5 shrink-0 items-center justify-center rounded-full',
              locked
                ? 'border border-solid border-border bg-secondary'
                : 'bg-primary'
            )
          "
        >
          {{ comment.number }}
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-muted-foreground">
            {{ comment.annotation.label }}
          </span>
          <span class="wrap-break-word">{{ comment.annotation.comment }}</span>
          <span v-if="comment.followUps > 0" class="text-muted-foreground">
            {{ messages.followUpCount(comment.followUps) }}
          </span>
          <span
            v-if="placeNote(comment.annotation.id)"
            class="text-destructive"
          >
            {{ placeNote(comment.annotation.id) }}
          </span>
        </span>
      </Button>
    </li>
  </ol>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { messages } from './messages'
import type { NumberedComment } from './turns'
import type { PinView } from './usePointSession'

const {
  comments,
  pins,
  disabled,
  locked = false
} = defineProps<{
  comments: NumberedComment[]
  pins: PinView[]
  disabled: boolean
  /** True for the comments of an answered turn. */
  locked?: boolean
}>()

const emit = defineEmits<{ open: [annotationId: string] }>()

function placeNote(annotationId: string): string {
  const pin = pins.find((candidate) => candidate.id === annotationId)
  if (!pin || pin.rect) return ''
  return pin.missing ? messages.targetMissing : messages.notOnScreen
}
</script>
