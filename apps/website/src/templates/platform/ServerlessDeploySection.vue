<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import LiveTerminal from './LiveTerminal.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// The prompt to paste into a coding agent; the copy button puts it on the
// clipboard verbatim.
const deployPrompt = computed(() =>
  t('platform.serverlessDeploy.prompt', locale)
)
const deployTranscript = computed(() => deployPrompt.value.split('\n'))
const { copy, copied } = useClipboard({ source: deployPrompt, legacy: true })
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 pt-10 pb-4 lg:pt-14 lg:pb-6">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.serverlessDeploy.shipHeading', locale) }}
      <template #subtitle>
        <p
          class="mx-auto mt-4 max-w-2xl text-sm whitespace-pre-line text-smoke-700"
        >
          {{ t('platform.serverlessDeploy.shipSubtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="relative mx-auto mt-8 max-w-3xl">
      <button
        type="button"
        class="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-comfy-canvas hover:bg-transparency-white-t4 focus-visible:outline-2 focus-visible:outline-primary-comfy-yellow"
        :aria-label="
          t(
            copied
              ? 'platform.serverlessDeploy.copied'
              : 'platform.serverlessDeploy.copy',
            locale
          )
        "
        @click="copy()"
      >
        <component
          :is="copied ? Check : Copy"
          class="size-4"
          aria-hidden="true"
        />
      </button>
      <LiveTerminal
        class="[&_pre]:pt-14"
        :lines="deployTranscript"
        :label="t('platform.serverlessDeploy.heading', locale)"
      />
    </div>
  </section>
</template>
