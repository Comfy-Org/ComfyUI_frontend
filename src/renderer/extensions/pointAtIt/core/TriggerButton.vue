<template>
  <div
    data-point-at-it-layer
    data-testid="point-at-it-trigger"
    class="pointer-events-auto flex shrink-0 items-center"
  >
    <Button
      variant="outline"
      size="sm"
      :class="
        cn(
          'no-drag shrink-0 gap-1 rounded-l-lg rounded-r-none',
          active && 'bg-accent'
        )
      "
      :aria-pressed="active"
      :disabled
      :title="messages.annotateTooltip"
      @click="emit('toggle')"
    >
      <i class="icon-[lucide--message-square-plus] size-3" aria-hidden="true" />
      <span>{{ messages.annotate }}</span>
    </Button>
    <Button
      variant="outline"
      size="sm"
      :class="
        cn(
          'no-drag -ml-px shrink-0 gap-1 rounded-l-none rounded-r-lg px-1.5',
          panelOpen && 'bg-accent'
        )
      "
      :aria-label="panelOpen ? messages.hidePanel : messages.showPanel"
      :aria-expanded="panelOpen"
      @click="emit('caret')"
    >
      <span
        v-if="waitingSince !== null"
        role="status"
        class="flex items-center gap-1 text-muted-foreground"
      >
        <i
          class="icon-[lucide--loader-circle] size-3 motion-safe:animate-spin"
          aria-hidden="true"
        />
        {{ messages.waitingShort(elapsedSeconds) }}
      </span>
      <span
        v-else-if="unsent > 0"
        :aria-label="messages.unsentCount(unsent)"
        class="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-foreground"
      >
        {{ unsent }}
      </span>
      <i
        :class="
          cn(
            'size-3',
            panelOpen
              ? 'icon-[lucide--chevron-up]'
              : 'icon-[lucide--chevron-down]'
          )
        "
        aria-hidden="true"
      />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { messages } from './messages'

const { active, disabled, panelOpen, unsent, waitingSince } = defineProps<{
  /** Annotation mode is on. */
  active: boolean
  /** The mode cannot be changed right now. */
  disabled: boolean
  panelOpen: boolean
  /** Comments of the current turn that are not sent yet. */
  unsent: number
  waitingSince: number | null
}>()

const emit = defineEmits<{ toggle: []; caret: [] }>()

const now = useTimestamp({ interval: 500 })
const elapsedSeconds = computed(() =>
  waitingSince === null
    ? 0
    : Math.max(0, Math.floor((now.value - waitingSince) / 1000))
)
</script>
