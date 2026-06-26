<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import Button from '@/components/ui/button/Button.vue'
import { resolveRel } from '../../utils/cta'
import { livestream } from './livestream'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const signUpHref = `https://www.youtube.com/watch?v=${livestream.youtubeVideoId}`
const signUpRel = resolveRel({ target: '_blank' })

// Hide once the livestream window closes — both for visitors arriving after
// the event and for visitors whose tab is open when it ends.
const endMs = new Date(livestream.endDateTime).getTime()
const visible = ref(true)

// useTimeoutFn auto-clears on unmount. Arm it client-side only so SSR never
// schedules a long-lived server timer.
const { start } = useTimeoutFn(
  () => {
    visible.value = false
  },
  () => Math.max(0, endMs - Date.now()),
  { immediate: false }
)

onMounted(() => {
  if (endMs - Date.now() <= 0) {
    visible.value = false
  } else {
    start()
  }
})
</script>

<template>
  <div v-if="visible" class="px-4">
    <div
      class="bg-primary-comfy-plum max-w-8xl rounded-5xl text-primary-warm-white mx-auto flex w-full flex-col items-center justify-center gap-2 px-6 py-5 text-center text-sm sm:flex-row sm:gap-4"
    >
      <p class="ppformula-text-center">
        {{ t('launches.banner.text', locale) }}
      </p>
      <Button
        :href="signUpHref"
        as="a"
        variant="underlineLink"
        size="sm"
        target="_blank"
        :rel="signUpRel"
      >
        {{ t('launches.banner.cta', locale) }}
      </Button>
    </div>
  </div>
</template>
