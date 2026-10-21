<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  offersNativeJson,
  disabled,
  locale = 'en'
} = defineProps<{
  offersNativeJson: boolean
  disabled: boolean
  locale?: Locale
}>()
const nativeJson = defineModel<boolean>('nativeJson', { required: true })
const { t } = translationsFor(locale)
</script>

<template>
  <header
    class="flex items-center justify-between border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
  >
    <span>{{ t('workshop.input.title') }}</span>
    <button
      v-if="offersNativeJson"
      type="button"
      :aria-pressed="nativeJson"
      :disabled
      class="cursor-pointer rounded-sm px-2 py-1 hover:bg-transparency-white-t8 disabled:cursor-not-allowed"
      @click="nativeJson = !nativeJson"
    >
      {{ t('workshop.form.nativeJson') }}
    </button>
  </header>
</template>
