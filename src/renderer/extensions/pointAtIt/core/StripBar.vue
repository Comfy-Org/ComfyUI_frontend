<template>
  <li ref="item" class="relative flex">
    <Button
      variant="textonly"
      size="unset"
      class="flex size-4 items-center justify-center rounded-full"
      :aria-label="bar.label"
      :aria-current="current ? 'true' : undefined"
    >
      <span
        :class="
          cn(
            'h-3.5 w-1 rounded-full bg-muted-foreground',
            current ? 'bg-primary' : 'opacity-60'
          )
        "
      />
    </Button>
    <div
      v-if="open"
      data-testid="point-at-it-bar-card"
      class="absolute top-1/2 right-full z-10 -translate-y-1/2 pr-2"
    >
      <section
        role="group"
        :aria-label="bar.label"
        class="flex w-72 flex-col gap-1 rounded-lg border border-border bg-background p-2 text-xs shadow-md"
      >
        <p class="m-0 line-clamp-2 px-1 font-semibold wrap-break-word">
          {{ bar.title }}
        </p>
        <p class="m-0 px-1 text-muted-foreground">
          {{ bar.range }} · {{ bar.count }}
        </p>
        <ol
          :aria-label="messages.turnsOfBar"
          class="m-0 flex max-h-64 list-none flex-col gap-0.5 overflow-y-auto p-0"
        >
          <li v-for="turn in bar.turns" :key="turn.turnId">
            <Button
              variant="textonly"
              size="unset"
              class="w-full justify-start gap-2 rounded-sm px-1 text-left"
              :aria-label="turn.label"
              :disabled
              @click="openTurn(turn)"
            >
              <time class="shrink-0 text-muted-foreground">{{
                turn.time
              }}</time>
              <span class="truncate">{{ turn.questions.at(0)?.text }}</span>
            </Button>
          </li>
        </ol>
      </section>
    </div>
  </li>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { messages } from './messages'
import type { BarItem, TurnCard } from './turnGrouping'
import { useCardOpen } from './useCardOpen'

const { disabled } = defineProps<{
  bar: BarItem
  current: boolean
  disabled: boolean
}>()

const emit = defineEmits<{ open: [commentId: string] }>()

const item = useTemplateRef('item')
const open = useCardOpen(item)

function openTurn(turn: TurnCard) {
  const first = turn.questions.at(0)
  if (first && !disabled) emit('open', first.commentId)
}
</script>
