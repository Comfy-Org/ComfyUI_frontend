<template>
  <form
    ref="box"
    data-testid="point-at-it-ask-box"
    class="pointer-events-auto absolute flex w-80 flex-col gap-2 rounded-lg border border-solid border-border bg-background p-3 shadow-md"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @submit.prevent="emit('ask', text)"
  >
    <ul v-if="chips.length > 0" class="m-0 flex list-none flex-wrap gap-1 p-0">
      <li
        v-for="chip in chips"
        :key="chip.id"
        class="flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2 text-xs"
      >
        {{ chip.label }}
        <Button
          v-if="sentQuestion === undefined"
          type="button"
          variant="textonly"
          size="icon-sm"
          :aria-label="messages.removeChip(chip.label)"
          @click="emit('removeChip', chip.id)"
        >
          <i class="icon-[lucide--x] size-3" aria-hidden="true" />
        </Button>
      </li>
    </ul>
    <p v-else class="m-0 text-xs text-muted-foreground">
      {{ messages.nothingMarked }}
    </p>
    <template v-if="sentQuestion === undefined">
      <input
        ref="input"
        v-model="text"
        type="text"
        autocomplete="off"
        class="h-8 rounded-md border border-border bg-transparent px-2 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
        :aria-label="messages.askInputLabel"
        :placeholder="messages.askPlaceholder"
      />
      <p class="m-0 text-xs text-muted-foreground">{{ messages.askHint }}</p>
    </template>
    <template v-else>
      <p class="m-0">{{ sentQuestion }}</p>
      <p
        role="status"
        class="m-0 flex items-center gap-2 text-xs text-muted-foreground"
      >
        <i
          class="icon-[lucide--loader-circle] motion-safe:animate-spin"
          aria-hidden="true"
        />
        {{ messages.thinking }} · {{ messages.thinkingHint }}
      </p>
    </template>
  </form>
</template>

<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { computed, onMounted, ref, useTemplateRef } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { placeBeside } from './geometry'
import type { Rect } from './geometry'
import { messages } from './messages'
import type { Chip } from './pointState'

const { anchor, chips, sentQuestion } = defineProps<{
  anchor: Rect
  chips: Chip[]
  sentQuestion?: string
}>()

const emit = defineEmits<{
  ask: [text: string]
  removeChip: [chipId: string]
}>()

const text = ref('')
const box = useTemplateRef('box')
const input = useTemplateRef('input')
const boxSize = useElementSize(box, undefined, { box: 'border-box' })
const windowSize = useWindowSize()

const position = computed(() =>
  placeBeside(
    anchor,
    { width: boxSize.width.value, height: boxSize.height.value },
    { width: windowSize.width.value, height: windowSize.height.value },
    ['below', 'above', 'right', 'left']
  )
)

onMounted(() => input.value?.focus())
</script>
