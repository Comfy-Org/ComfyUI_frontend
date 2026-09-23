<script setup lang="ts">
import { useMounted, useObjectUrl } from '@vueuse/core'
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

// An audio file says nothing as a filename. The player sits under the row so
// the reader can hear what they are about to send without leaving the form.
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
</script>

<template>
  <audio
    v-if="source"
    :key="source"
    :src="source"
    :aria-label="`${t('workshop.field.play', locale)} ${name}`"
    controls
    preload="metadata"
    class="h-9 w-full"
    data-testid="audio-source-player"
  />
</template>
