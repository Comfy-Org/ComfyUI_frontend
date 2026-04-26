<template>
  <div class="relative">
    <code
      class="block rounded-md bg-neutral-800 p-3 pr-10 text-xs whitespace-pre-wrap text-neutral-200 select-all"
      >{{ text }}</code
    >
    <button
      :title="copied ? t('clipboard.successMessage') : t('g.copyToClipboard')"
      :aria-label="
        copied ? t('clipboard.successMessage') : t('g.copyToClipboard')
      "
      class="absolute top-2 right-2 rounded-sm p-1 text-neutral-500 transition-colors hover:text-neutral-100"
      @click="copy(text)"
    >
      <span
        :class="
          copied ? 'icon-[lucide--check] text-green-400' : 'icon-[lucide--copy]'
        "
        class="block size-3.5"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const { text } = defineProps<{ text: string }>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })
</script>
