<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'

import BrandButton from '../../components/common/BrandButton.vue'
import { deployPromptFor } from '../../config/deploy-prompt'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const deployPrompt = computed(() => deployPromptFor(locale))
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })
</script>

<template>
  <section class="mx-auto max-w-3xl px-6 pt-4 pb-10 text-center lg:pb-14">
    <p class="text-sm text-smoke-700">
      {{ t('platform.serverlessDeploy.agentPromptLine', locale) }}
    </p>
    <BrandButton
      variant="outline"
      size="xs"
      class="mt-4"
      @click="void copy(deployPrompt)"
    >
      <span class="inline-flex items-center gap-2">
        <span class="grid">
          <span
            :class="cn('[grid-area:1/1]', copied && 'invisible')"
            aria-hidden="true"
          >
            {{ t('platform.serverlessDeploy.copyAgentPrompt', locale) }}
          </span>
          <span
            :class="cn('[grid-area:1/1]', !copied && 'invisible')"
            aria-hidden="true"
          >
            {{ t('platform.serverlessDeploy.agentPromptCopied', locale) }}
          </span>
          <span class="sr-only">
            {{
              t(
                copied
                  ? 'platform.serverlessDeploy.agentPromptCopied'
                  : 'platform.serverlessDeploy.copyAgentPrompt',
                locale
              )
            }}
          </span>
        </span>
        <component :is="copied ? Check : Copy" class="size-4" />
      </span>
    </BrandButton>
  </section>
</template>
