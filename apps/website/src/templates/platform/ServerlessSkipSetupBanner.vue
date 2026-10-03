<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'

import { deployPromptFor } from '../../config/deploy-prompt'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

// Shares the exact prompt the "Ship in minutes" terminal above already
// copies, so the two CTAs on this page can never drift apart.
const skipSetupPrompt = computed(() => deployPromptFor(locale))
const { copy, copied } = useClipboard({
  source: skipSetupPrompt,
  copiedDuring: 2000,
  legacy: true
})
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 lg:px-16">
    <div
      class="flex flex-col gap-4 rounded-3xl bg-primary-comfy-ink-light px-8 py-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-lg font-bold text-primary-warm-white">
          {{ t('platform.serverlessSkipSetup.heading') }}
        </p>
        <p class="mt-1 text-sm text-primary-warm-white/60">
          {{ t('platform.serverlessSkipSetup.subtitle') }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-full border border-primary-comfy-yellow px-5 py-2.5 text-xs font-bold tracking-wider text-primary-comfy-yellow transition-colors hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-comfy-yellow sm:self-auto"
        @click="void copy()"
      >
        <span class="grid">
          <span
            :class="cn('[grid-area:1/1]', copied && 'invisible')"
            aria-hidden="true"
          >
            {{ t('platform.serverlessSkipSetup.copyPrompt') }}
          </span>
          <span
            :class="cn('[grid-area:1/1]', !copied && 'invisible')"
            aria-hidden="true"
          >
            {{ t('platform.serverlessSkipSetup.copied') }}
          </span>
          <span class="sr-only">
            {{
              t(
                copied
                  ? 'platform.serverlessSkipSetup.copied'
                  : 'platform.serverlessSkipSetup.copyPrompt'
              )
            }}
          </span>
        </span>
        <component
          :is="copied ? Check : Copy"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </div>
  </section>
</template>
