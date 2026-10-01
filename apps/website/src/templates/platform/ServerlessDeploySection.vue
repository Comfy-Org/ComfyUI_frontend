<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import { deployPromptFor } from '../../config/deploy-prompt'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import LiveTerminal from './LiveTerminal.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// The full prompt to paste into a coding agent, shown in the terminal and
// put on the clipboard verbatim by the "Copy prompt" button below. It
// renders in full right away — `typewriter="false"` below — since it's
// meant to be read and copied, not watched land keystroke by keystroke.
const deployPrompt = computed(() => deployPromptFor(locale))
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

    <div class="mx-auto mt-8 max-w-3xl">
      <LiveTerminal
        :lines="deployTranscript"
        :label="t('platform.serverlessDeploy.heading', locale)"
        :typewriter="false"
      />
      <button
        type="button"
        class="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-comfy-ink hover:bg-transparency-white-t4 focus-visible:outline-2 focus-visible:outline-primary-comfy-yellow"
        @click="copy()"
      >
        <component
          :is="copied ? Check : Copy"
          class="size-4"
          aria-hidden="true"
        />
        {{
          t(
            copied
              ? 'platform.serverlessDeploy.copied'
              : 'platform.serverlessDeploy.copy',
            locale
          )
        }}
      </button>
    </div>
  </section>
</template>
