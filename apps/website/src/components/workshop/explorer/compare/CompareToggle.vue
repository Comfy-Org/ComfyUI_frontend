<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  name,
  disabled = false,
  revealed = false,
  locale = 'en'
} = defineProps<{
  name: string
  disabled?: boolean
  revealed?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const checked = defineModel<boolean>({ required: true })
</script>

<template>
  <label
    :class="
      cn(
        'inline-flex items-center gap-1.5 rounded-lg bg-primary-comfy-ink/60 px-2 py-1 text-2xs font-semibold text-primary-warm-white backdrop-blur-md transition select-none has-focus-visible:ring-3 has-focus-visible:ring-primary-comfy-yellow/50',
        disabled
          ? 'cursor-not-allowed'
          : 'cursor-pointer hover:bg-primary-comfy-ink/80',
        !revealed && !checked
          ? 'opacity-0 group-focus-within/compare:opacity-100 group-hover/compare:opacity-100 [@media(hover:none)]:opacity-100'
          : disabled && 'opacity-50'
      )
    "
    :title="disabled ? t('workshop.explorer.compare.full') : undefined"
    :data-revealed="revealed || checked"
    data-testid="compare-toggle"
  >
    <input
      v-model="checked"
      type="checkbox"
      class="size-3.5 cursor-[inherit] accent-primary-comfy-yellow outline-none"
      :disabled
      :aria-label="t('workshop.explorer.compare.toggle', { name })"
    />
    <span aria-hidden="true">{{ t('workshop.explorer.compare.label') }}</span>
  </label>
</template>
