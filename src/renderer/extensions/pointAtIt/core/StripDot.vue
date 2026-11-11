<template>
  <li ref="item" class="relative flex">
    <Button
      variant="textonly"
      size="unset"
      class="flex size-4 items-center justify-center rounded-full"
      :aria-label="card.label"
      :aria-current="current ? 'true' : undefined"
      :aria-disabled="disabled"
      @click="openFirst"
    >
      <span
        :class="
          cn(
            'rounded-full bg-muted-foreground',
            current ? 'size-2 bg-primary' : 'size-1.5 opacity-60'
          )
        "
      />
    </Button>
    <div
      v-if="open"
      data-testid="point-at-it-turn-card"
      class="absolute top-1/2 right-full z-10 -translate-y-1/2 pr-2"
    >
      <section
        role="group"
        :aria-label="card.position"
        class="flex w-64 flex-col gap-1 rounded-lg border border-border bg-background p-2 text-xs shadow-md"
      >
        <ul
          :aria-label="messages.turnQuestions"
          class="m-0 flex list-none flex-col gap-0.5 p-0"
        >
          <template
            v-for="(question, index) in card.questions"
            :key="question.commentId"
          >
            <li v-if="index === 1" class="px-1 text-muted-foreground">
              {{ card.more }}
            </li>
            <li>
              <Button
                variant="textonly"
                size="unset"
                class="w-full justify-start rounded-sm px-1 text-left whitespace-normal"
                :disabled
                @click="emit('open', question.commentId)"
              >
                <span
                  :class="
                    cn(
                      'line-clamp-2 wrap-break-word',
                      index === 0 ? 'font-semibold' : 'text-muted-foreground'
                    )
                  "
                >
                  {{ question.text }}
                </span>
              </Button>
            </li>
          </template>
        </ul>
        <p
          v-if="card.answer"
          class="m-0 line-clamp-2 px-1 wrap-break-word text-muted-foreground"
        >
          {{ card.answer }}
        </p>
        <details v-if="card.thinking" class="px-1 text-muted-foreground">
          <summary class="cursor-pointer">{{ messages.thinking }}</summary>
          <p
            class="m-0 max-h-32 overflow-y-auto rounded-md bg-secondary p-2 whitespace-pre-wrap"
          >
            {{ card.thinking }}
          </p>
        </details>
        <p class="m-0 flex justify-between gap-2 px-1 text-muted-foreground">
          <span>{{ card.position }}</span>
          <time>{{ card.time }}</time>
        </p>
      </section>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { messages } from './messages'
import type { TurnCard } from './turnGrouping'
import { useCardOpen } from './useCardOpen'

const { card, disabled } = defineProps<{
  card: TurnCard
  current: boolean
  disabled: boolean
}>()

const emit = defineEmits<{ open: [commentId: string] }>()

const item = useTemplateRef('item')
const open = useCardOpen(item)
const first = computed(() => card.questions.at(0))

function openFirst() {
  if (first.value && !disabled) emit('open', first.value.commentId)
}
</script>
