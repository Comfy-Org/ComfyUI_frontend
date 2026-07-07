<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const { class: cls, showClose = true } = defineProps<{
  class?: string
  showClose?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="fixed inset-0 z-50 bg-black/60" />
    <DialogContent
      :class="
        cn(
          'agent-scope rounded-agent border-agent-border bg-agent-surface-raised text-agent-fg fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-1/2 border p-5 shadow-xl focus:outline-none',
          cls
        )
      "
    >
      <slot />
      <DialogClose
        v-if="showClose"
        class="rounded-agent text-agent-fg-subtle hover:bg-agent-surface-hover hover:text-agent-fg focus-visible:ring-agent-accent absolute top-3 right-3 flex size-7 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
        :aria-label="t('agent.close')"
      >
        <span class="icon-[lucide--x] size-4" />
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
