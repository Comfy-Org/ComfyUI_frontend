<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { externalLinks } from '../../config/routes'
import type { FormValues } from '../../config/workshop-playground'
import type { SnippetLanguage } from '../../config/workshop-snippets'
import { SNIPPET_LANGUAGES, buildSnippet } from '../../config/workshop-snippets'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  routerId,
  values,
  locale = 'en'
} = defineProps<{
  routerId: string
  values: FormValues
  locale?: Locale
}>()

const language = ref<SnippetLanguage>('python')
const snippet = computed(() => buildSnippet(language.value, routerId, values))

const languageLabel: Record<SnippetLanguage, string> = {
  python: 'Python',
  typescript: 'TypeScript',
  http: 'HTTP'
}
</script>

<template>
  <section class="flex flex-col gap-6" data-testid="api-tab">
    <div class="flex flex-col gap-2">
      <h2 class="text-2xl font-bold text-primary-comfy-canvas">
        {{ t('workshop.api.heading', locale) }}
      </h2>
      <p class="text-sm text-primary-warm-gray">
        {{ t('workshop.api.body', locale) }}
      </p>
    </div>

    <div
      class="bg-transparency-white-t4 overflow-hidden rounded-2xl border border-transparency-white-t20"
    >
      <div
        class="flex items-center justify-between border-b border-transparency-white-t8 px-3 py-2"
      >
        <div role="tablist" class="flex gap-1">
          <button
            v-for="option in SNIPPET_LANGUAGES"
            :key="option"
            type="button"
            role="tab"
            :aria-selected="language === option"
            :data-testid="`snippet-${option}`"
            :class="
              cn(
                'cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold tracking-wider uppercase transition-colors',
                language === option
                  ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                  : 'text-primary-comfy-canvas hover:bg-transparency-white-t8 hover:text-primary-warm-white'
              )
            "
            @click="language = option"
          >
            {{ languageLabel[option] }}
          </button>
        </div>
        <CopyTextButton
          :value="snippet"
          :label="t('workshop.api.copy', locale)"
          :copied-label="t('workshop.api.copied', locale)"
        />
      </div>
      <pre
        class="overflow-x-auto bg-primary-comfy-ink p-6 font-mono text-sm/relaxed text-primary-warm-white"
        data-testid="snippet"
      ><code>{{ snippet }}</code></pre>
    </div>

    <p class="text-xs text-primary-warm-gray">
      {{ t('workshop.api.illustrative', locale) }}
    </p>

    <div class="flex flex-wrap gap-3">
      <Button
        as="a"
        :href="externalLinks.apiKeys"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="api-get-key"
      >
        {{ t('workshop.api.getKey', locale) }}
      </Button>
      <Button
        as="a"
        variant="outline"
        :href="externalLinks.docsComfyRouter"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t('workshop.api.docs', locale) }}
      </Button>
    </div>
  </section>
</template>
