<template>
  <div
    role="status"
    :class="
      cn(
        'pointer-events-auto absolute z-1000 flex max-h-96 w-96 flex-col rounded-lg border border-border-default bg-base-background shadow-interface',
        position === 'bottom-left' && 'bottom-4 left-4',
        position === 'bottom-right' && 'right-4 bottom-4'
      )
    "
  >
    <div class="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div class="flex items-center gap-4">
        <div
          v-if="icon"
          class="flex shrink-0 items-center justify-center rounded-lg bg-primary-background-hover p-3"
        >
          <i :class="cn('size-4 text-white', icon)" />
        </div>
        <div class="flex flex-1 flex-col gap-1">
          <div class="text-sm leading-[1.429] font-normal text-base-foreground">
            {{ title }}
          </div>
          <div
            v-if="subtitle"
            class="text-sm leading-[1.21] font-normal text-muted-foreground"
          >
            {{ subtitle }}
          </div>
        </div>
        <Button
          v-if="showClose"
          class="size-6 shrink-0 self-start"
          size="icon-sm"
          variant="muted-textonly"
          :aria-label="$t('g.close')"
          @click="emit('close')"
        >
          <i class="icon-[lucide--x] size-3.5" />
        </Button>
      </div>

      <div
        v-if="$slots.default"
        class="min-h-0 flex-1 overflow-y-auto text-sm text-muted-foreground"
      >
        <slot />
      </div>
    </div>

    <div
      v-if="$slots['footer-start'] || $slots['footer-end']"
      class="flex items-center justify-between px-4 pb-4"
    >
      <div>
        <slot name="footer-start" />
      </div>
      <div class="flex items-center gap-4">
        <slot name="footer-end" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

const {
  icon,
  title,
  subtitle,
  showClose = false,
  position = 'bottom-left'
} = defineProps<{
  icon?: string
  title: string
  subtitle?: string
  showClose?: boolean
  position?: 'bottom-left' | 'bottom-right'
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
