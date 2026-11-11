<template>
  <ol
    data-testid="point-at-it-turn-strip"
    :aria-label="messages.turnStripLabel"
    class="m-0 flex list-none flex-col items-center gap-0.5 rounded-full border border-solid border-border bg-background p-0.5 shadow-md"
  >
    <template v-for="item in items" :key="keyOf(item)">
      <StripBar
        v-if="item.kind === 'bar'"
        :bar="item"
        :current="shownTurnId !== null && item.turnIds.includes(shownTurnId)"
        :disabled
        @open="(commentId) => emit('open', commentId)"
      />
      <StripDot
        v-else-if="item.kind === 'dot'"
        :card="item.card"
        :current="item.card.turnId === shownTurnId"
        :disabled
        @open="(commentId) => emit('open', commentId)"
      />
      <li v-else class="flex">
        <Button
          variant="textonly"
          size="unset"
          class="flex size-4 items-center justify-center rounded-full"
          :aria-label="item.label"
          @click="emit('openPanel')"
        >
          <span class="size-2 rounded-full bg-foreground" />
        </Button>
      </li>
    </template>
  </ol>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

import { messages } from './messages'
import StripBar from './StripBar.vue'
import StripDot from './StripDot.vue'
import type { StripItem } from './turnGrouping'

defineProps<{
  items: StripItem[]
  shownTurnId: string | null
  disabled: boolean
}>()

const emit = defineEmits<{
  open: [commentId: string]
  openPanel: []
}>()

function keyOf(item: StripItem): string {
  if (item.kind === 'bar') return `bar:${item.id}`
  return item.kind === 'dot' ? `dot:${item.card.turnId}` : 'current'
}
</script>
