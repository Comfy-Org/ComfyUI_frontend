<template>
  <div
    data-point-at-it-layer
    data-testid="point-at-it-trigger"
    class="pointer-events-auto flex shrink-0 items-center gap-px"
  >
    <Button
      variant="secondary"
      size="md"
      :class="
        cn(
          'no-drag h-9 shrink-0 gap-1.5 rounded-l-lg rounded-r-none px-3',
          pressed && 'bg-accent'
        )
      "
      :aria-label="askName(role)"
      :aria-pressed="pressed"
      :aria-busy="waitingSince !== null"
      :disabled
      :title="title"
      @click="emit('toggle')"
    >
      <i
        v-if="waitingSince !== null"
        data-testid="point-at-it-loading"
        class="icon-[lucide--loader-circle] motion-safe:animate-spin"
        aria-hidden="true"
      />
      <i v-else class="icon-[lucide--message-square-plus]" aria-hidden="true" />
      <span>{{ messages.annotate }}</span>
    </Button>
    <Button
      variant="secondary"
      size="md"
      :class="
        cn(
          'no-drag h-9 shrink-0 gap-1 rounded-l-none rounded-r-lg px-2',
          panelOpen && 'bg-accent'
        )
      "
      :aria-label="panelOpen ? messages.hidePanel : messages.showPanel"
      :aria-expanded="panelOpen"
      :disabled="waitingSince !== null"
      @click="emit('caret')"
    >
      <span
        v-if="waitingSince === null && unsent > 0"
        :aria-label="messages.unsentCount(unsent)"
        class="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-foreground"
      >
        {{ unsent }}
      </span>
      <i
        :class="
          panelOpen
            ? 'icon-[lucide--chevron-down]'
            : 'icon-[lucide--chevron-up]'
        "
        aria-hidden="true"
      />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { messages } from './messages'
import { askName, askPressed, askTitle } from './slotView'
import type { AskRole } from './slotView'

const { active, disabled, panelOpen, role, unsent, waitingSince } =
  defineProps<{
    /** Annotation mode is on. */
    active: boolean
    /** The mode cannot be changed right now. */
    disabled: boolean
    panelOpen: boolean
    /** What the main part does now: toggle the mode, or the thinking dock. */
    role: AskRole
    /** Comments of the current turn that are not sent yet. */
    unsent: number
    waitingSince: number | null
  }>()

const emit = defineEmits<{ toggle: []; caret: [] }>()

const pressed = computed(() => askPressed(role, { annotating: active }))
const title = computed(() => askTitle(role))
</script>
