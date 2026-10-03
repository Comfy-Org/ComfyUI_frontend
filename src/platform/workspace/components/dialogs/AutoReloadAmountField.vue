<template>
  <div
    :class="
      cn(
        'flex items-center gap-2 rounded-lg bg-secondary-background px-3 py-2.5',
        disabled && 'opacity-50',
        error && 'ring-1 ring-red-500',
        warningId && 'ring-1 ring-warning-background'
      )
    "
  >
    <span
      v-if="currency === 'usd'"
      class="shrink-0 text-sm text-muted-foreground"
    >
      {{ usdSymbol }}
    </span>
    <i v-else class="icon-[lucide--coins] size-4 shrink-0 text-credit" />
    <input
      :id="inputId"
      :value="value"
      :disabled="disabled"
      :aria-labelledby="labelledby"
      inputmode="numeric"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? errorId : warningId"
      :placeholder="placeholder"
      class="w-full min-w-0 border-none bg-transparent text-sm text-base-foreground tabular-nums outline-none disabled:cursor-not-allowed"
      @input="emit('input', $event)"
      @blur="emit('blur')"
    />
    <span
      v-if="approxLabel"
      class="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums"
    >
      ≈
      <i
        v-if="currency === 'usd'"
        class="icon-[lucide--coins] size-3.5 text-muted-foreground"
      />
      {{ approxLabel }}
    </span>
  </div>
  <p v-if="error" :id="errorId" class="m-0 text-xs text-red-500">
    {{ error }}
  </p>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const {
  value,
  currency,
  usdSymbol,
  errorId,
  inputId,
  labelledby,
  error = '',
  warningId,
  approxLabel,
  placeholder,
  disabled = false
} = defineProps<{
  value: string
  currency: 'credits' | 'usd'
  usdSymbol: string
  errorId: string
  inputId?: string
  labelledby?: string
  error?: string
  warningId?: string
  approxLabel?: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  input: [event: Event]
  blur: []
}>()
</script>
