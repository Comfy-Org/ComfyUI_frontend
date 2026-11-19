<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useTemplateRef, watchEffect } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { useCompositedTransform } from '@/renderer/core/layout/transform/useCompositedTransform'
import type { AgentCanvasPinStatus } from '@/workbench/extensions/agent/stores/agent/agentCanvasPinStore'

const { status, label, left, top } = defineProps<{
  status: AgentCanvasPinStatus
  label: string
  left: number
  top: number
}>()
const emit = defineEmits<{ open: [] }>()

const root = useTemplateRef<HTMLElement>('root')
const { setTransform } = useCompositedTransform(root)
watchEffect(() => setTransform(`translate(${left}px, ${top}px)`), {
  flush: 'post'
})

const DOT: Partial<Record<AgentCanvasPinStatus, string>> = {
  waiting: 'bg-warning',
  done: 'bg-success',
  failed: 'bg-destructive'
}
</script>

<template>
  <div ref="root" class="absolute top-0 left-0">
    <Button
      variant="secondary"
      size="unset"
      data-testid="agent-canvas-pin"
      :data-status="status"
      :aria-label="label"
      class="pointer-events-auto size-7 rounded-full rounded-bl-none border border-border shadow-md"
      @click="emit('open')"
    >
      <i
        v-if="status === 'working'"
        aria-hidden="true"
        class="icon-[lucide--loader-circle] text-muted-foreground motion-safe:animate-spin"
      />
      <i v-else aria-hidden="true" class="icon-[lucide--sparkle]" />
      <span
        v-if="DOT[status]"
        aria-hidden="true"
        data-testid="agent-canvas-pin-dot"
        :class="
          cn(
            'absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background',
            DOT[status]
          )
        "
      />
    </Button>
  </div>
</template>
