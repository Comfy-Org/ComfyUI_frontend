<script setup lang="ts">
import { useMounted, useObjectUrl } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  file,
  src,
  name,
  locale = 'en'
} = defineProps<{
  file?: File
  src?: string
  name: string
  locale?: Locale
}>()
const mounted = useMounted()
const objectUrl = useObjectUrl(() => (mounted.value ? file : undefined))
const source = computed(() => objectUrl.value ?? src)
const failedSource = ref<string>()
</script>

<template>
  <img
    v-if="source && failedSource !== source"
    :key="source"
    :src="source"
    :alt="name"
    referrerpolicy="no-referrer"
    class="bg-transparency-white-t4 h-32 w-full rounded-xl object-contain"
    @error="failedSource = source"
  />
  <p v-else-if="source" role="status" class="text-xs text-primary-warm-gray">
    {{ t('workshop.field.imagePreviewUnavailable', locale) }}
  </p>
</template>
