<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import Button from '@/components/ui/button/Button.vue'
import { livestream } from './livestream'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const signUpHref = 'https://luma.com/l7c5z4gp'

// Hide once the livestream window closes — both for visitors arriving after
// the event and for visitors whose tab is open when it ends.
const visible = ref(true)
let hideTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  const msUntilEnd = new Date(livestream.endDateTime).getTime() - Date.now()
  if (msUntilEnd <= 0) {
    visible.value = false
    return
  }
  hideTimer = setTimeout(() => {
    visible.value = false
  }, msUntilEnd)
})

onUnmounted(() => {
  if (hideTimer !== undefined) clearTimeout(hideTimer)
})
</script>

<template>
  <div v-if="visible" class="px-4">
    <div
      class="bg-primary-comfy-plum max-w-8xl rounded-5xl text-primary-warm-white mx-auto flex w-full flex-col items-center justify-center gap-2 px-6 py-5 text-center text-sm sm:flex-row sm:gap-4"
    >
      <p class="ppformula-text-center">{{ t('drops.banner.text', locale) }}</p>
      <Button
        :href="signUpHref"
        as="a"
        variant="link"
        size="sm"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t('drops.banner.cta', locale) }}
      </Button>
    </div>
  </div>
</template>
