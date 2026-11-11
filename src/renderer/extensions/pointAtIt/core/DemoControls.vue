<template>
  <aside
    data-testid="point-at-it-controls"
    class="flex flex-col gap-2 rounded-lg border border-solid border-border bg-background p-3 text-xs shadow-md"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="font-medium">{{ messages.controlsTitle }}</span>
      <Button
        variant="textonly"
        size="icon-sm"
        :aria-label="open ? messages.controlsHide : messages.controlsShow"
        :aria-expanded="open"
        @click="open = !open"
      >
        <i
          :class="
            cn(
              'size-3',
              open ? 'icon-[lucide--chevron-down]' : 'icon-[lucide--chevron-up]'
            )
          "
          aria-hidden="true"
        />
      </Button>
    </div>
    <template v-if="open">
      <div
        role="group"
        :aria-label="messages.replyDelay"
        class="flex items-center gap-1"
      >
        <span class="flex-1">{{ messages.replyDelay }}</span>
        <Button
          v-for="delay in REPLY_DELAYS_MS"
          :key="delay"
          size="sm"
          :variant="delay === replyDelayMs ? 'primary' : 'secondary'"
          :aria-pressed="delay === replyDelayMs"
          @click="replyDelayMs = delay"
        >
          {{ messages.seconds(delay / 1000) }}
        </Button>
      </div>
      <label class="flex items-center gap-2">
        <input v-model="wrongTarget" type="checkbox" />
        {{ messages.wrongTarget }}
      </label>
      <p class="m-0 whitespace-pre-line text-muted-foreground">
        {{ messages.scriptedNote }} {{ answers.canAnswer }}
      </p>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { answers, messages } from './messages'
import { REPLY_DELAYS_MS } from './usePointSession'

const replyDelayMs = defineModel<number>('replyDelayMs', { required: true })
const wrongTarget = defineModel<boolean>('wrongTarget', { required: true })

const open = ref(true)
</script>
