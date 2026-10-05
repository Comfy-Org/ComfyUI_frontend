<template>
  <div
    data-checkout-toast
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
    :class="
      cn(
        'w-100 max-w-full rounded-md border backdrop-blur-[10px]',
        SEVERITY[severity].shell,
        variant === 'message' && 'min-h-[73px]'
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
              ? 'pi pi-exclamation-circle text-warning-background'
              : 'pi pi-spin pi-spinner text-[#60a5fa]'
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
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <p data-toast-summary class="m-0 text-base/6 font-medium">
            {{ summary }}
          </p>
          <p
            data-toast-detail
            class="m-0 text-sm/5 font-medium text-base-foreground"
          >
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
        <i class="pi pi-times text-base" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The cloud app's toast, as billing-web renders it: PrimeVue's dark Aura
 * toast (severity tint, border, blur, 28px close button) sized as the app
 * sizes its two toast hosts. `operation` is the app's payment-progress
 * toast (spinner or prompt beside one line); `message` its error and
 * success toast (severity icon, summary, detail).
 */
import { cn } from '@comfyorg/tailwind-utils'

const SEVERITY = {
  info: {
    shell:
      'border-[color-mix(in_srgb,#1d4ed8,transparent_64%)] bg-[color-mix(in_srgb,#3b82f6,transparent_84%)] text-[#3b82f6] [box-shadow:0px_4px_8px_0px_color-mix(in_srgb,#3b82f6,transparent_96%)]',
    icon: 'pi pi-info-circle'
  },
  success: {
    shell:
      'border-[color-mix(in_srgb,#15803d,transparent_64%)] bg-[color-mix(in_srgb,#22c55e,transparent_84%)] text-[#22c55e] [box-shadow:0px_4px_8px_0px_color-mix(in_srgb,#22c55e,transparent_96%)]',
    icon: 'pi pi-check'
  },
  warn: {
    shell:
      'border-[color-mix(in_srgb,#a16207,transparent_64%)] bg-[color-mix(in_srgb,#eab308,transparent_84%)] text-[#eab308] [box-shadow:0px_4px_8px_0px_color-mix(in_srgb,#eab308,transparent_96%)]',
    icon: 'pi pi-exclamation-triangle'
  },
  error: {
    shell:
      'border-[color-mix(in_srgb,#b91c1c,transparent_64%)] bg-[color-mix(in_srgb,#ef4444,transparent_84%)] text-[#ef4444] [box-shadow:0px_4px_8px_0px_color-mix(in_srgb,#ef4444,transparent_96%)]',
    icon: 'pi pi-times-circle'
  }
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
