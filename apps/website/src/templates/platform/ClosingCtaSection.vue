<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue'

import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { platformCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
const isMounted = ref(false)
const TerminalAsciiShader = defineAsyncComponent(
  () => import('./TerminalAsciiShader.vue')
)

onMounted(() => {
  isMounted.value = true
})
</script>

<template>
  <div class="relative isolate overflow-hidden bg-primary-comfy-ink">
    <div
      class="mask-platform-terminal-feather pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <TerminalAsciiShader v-if="isMounted" />
    </div>
    <CtaCenter01
      compact
      class="relative z-10 min-h-96 justify-center"
      :heading="t('platform.closing.heading', locale)"
      :primary-cta="ctas.getStarted"
      :secondary-cta="ctas.docs"
    />
  </div>
</template>
