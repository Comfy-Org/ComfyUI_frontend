<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { useClipboard } from '@vueuse/core'

import BrandButton from '../../components/common/BrandButton.vue'
import SectionHeader from '../../components/common/SectionHeader.vue'
import { COMFY_API_AGENT_PROMPT } from '../../config/comfy-api-agent-prompt'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import LiveTerminal from './LiveTerminal.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })

// Command surface from comfy-cli's build + deploy stack (PRs #801-805):
// `comfy build init`, `build push --release`, whose `--target` decides
// whether `deploy up` finds a deployable artifact, and `deploy up`. All
// three default to the current directory.
const deployTranscript = [
  '$ comfy build init',
  '✔ Scanned this ComfyUI install — custom nodes, models, pinned deps',
  '$ comfy build push --release --target linux/nvidia',
  '✔ Build released',
  '$ comfy deploy up',
  '✔ Endpoint live → https://your-build.run.comfy.app'
]
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
      />
    </div>

    <div class="mt-6 flex flex-col items-center gap-4 text-center">
      <p class="text-sm text-smoke-700">
        {{ t('platform.serverlessDeploy.agentPromptLine', locale) }}
      </p>
      <BrandButton
        variant="outline"
        size="xs"
        @click="void copy(COMFY_API_AGENT_PROMPT)"
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
    </div>
  </section>
</template>
