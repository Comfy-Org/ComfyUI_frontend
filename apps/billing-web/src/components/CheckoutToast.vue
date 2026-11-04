<template>
  <div
    data-checkout-toast
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
    :class="
      cn(
        'w-100 max-w-full rounded-md border border-current/36 bg-current/16 [box-shadow:0px_4px_8px_0px_color-mix(in_srgb,currentColor,transparent_96%)] backdrop-blur-[10px]',
        SEVERITY[severity].shell,
        variant === 'message' && 'min-h-18.25'
      )
    "
  >
    <div data-toast-content class="flex items-start gap-2 p-3">
      <div
        v-if="variant === 'operation'"
        class="flex flex-1 items-center gap-2"
      >
        <i
          :class="
            severity === 'warn'
              ? 'icon-[lucide--circle-alert] text-warning'
              : 'icon-[lucide--loader-circle] animate-spin text-primary motion-reduce:animate-none'
          "
          aria-hidden="true"
        />
        <span data-toast-summary class="leading-[normal]">{{ summary }}</span>
      </div>
      <template v-else>
        <i
          :class="
            cn(
              'inline-flex size-4.5 shrink-0 items-center justify-center text-lg',
              SEVERITY[severity].icon
            )
          "
          aria-hidden="true"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-2 font-medium">
          <p data-toast-summary class="m-0 text-base/6">
            {{ summary }}
          </p>
          <p data-toast-detail class="m-0 text-sm/5 text-foreground">
            {{ detail }}
          </p>
        </div>
      </template>
      <button
        type="button"
        :aria-label="closeLabel"
        class="relative -top-1.75 left-1.75 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-inherit hover:bg-white/5"
        @click="emit('close')"
      >
        <i class="icon-[lucide--x]" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * A severity-tinted checkout toast. `operation` is the payment-progress toast
 * (spinner or prompt beside one line); `message` the error and success toast
 * (severity icon, summary, detail).
 */
import { cn } from '@comfyorg/tailwind-utils'

const SEVERITY = {
  info: { shell: 'text-primary', icon: 'icon-[lucide--info]' },
  success: { shell: 'text-success', icon: 'icon-[lucide--check]' },
  warn: { shell: 'text-warning', icon: 'icon-[lucide--triangle-alert]' },
  error: { shell: 'text-[#ef4444]', icon: 'icon-[lucide--circle-x]' }
} as const

const {
  severity,
  summary,
  detail = '',
  variant = 'message',
  closeLabel
} = defineProps<{
  severity: keyof typeof SEVERITY
  summary: string
  detail?: string
  variant?: 'operation' | 'message'
  closeLabel: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
