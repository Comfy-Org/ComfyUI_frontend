<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'

import { COMFY_API_AGENT_PROMPT } from '../../config/comfy-api-agent-prompt'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const agentPromptPreview = [
  'pip install -U comfy-cli',
  'comfy skills show comfy-build',
  'comfy skills show comfy-deploy'
].join('\n')

const { copy, copied } = useClipboard({
  source: COMFY_API_AGENT_PROMPT,
  copiedDuring: 2000,
  legacy: true
})
</script>

<template>
  <div class="mx-auto mt-8 max-w-3xl">
    <p class="text-center text-sm text-smoke-700">
      {{ t('platform.serverlessDeploy.agentPromptLine', locale) }}
    </p>
    <div class="relative mt-4">
      <button
        type="button"
        class="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold tracking-widest text-primary-comfy-canvas uppercase hover:bg-transparency-white-t4 focus-visible:outline-2 focus-visible:outline-primary-comfy-yellow"
        @click="copy()"
      >
        {{
          t(
            copied
              ? 'platform.serverlessDeploy.agentPromptCopied'
              : 'platform.serverlessDeploy.agentPromptButton',
            locale
          )
        }}
        <component
          :is="copied ? Check : Copy"
          class="size-4"
          aria-hidden="true"
        />
      </button>
      <pre
        class="scrollbar-none overflow-auto rounded-3xl bg-[#2a2230] p-4 pt-14 font-mono text-2xs/relaxed whitespace-pre text-primary-comfy-canvas sm:p-5 sm:pt-14 sm:text-xs/relaxed lg:p-6"
      ><code>{{ agentPromptPreview }}</code></pre>
    </div>
  </div>
</template>
