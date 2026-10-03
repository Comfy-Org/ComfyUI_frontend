<script setup lang="ts">
import type { ModelStatus } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

const {
  variant,
  status: shown,
  successor,
  locale = 'en'
} = defineProps<{
  variant: 'pill' | 'banner'
  status?: ModelStatus
  successor?: { name: string; href?: string }
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <template v-if="shown">
    <span
      v-if="variant === 'pill'"
      class="inline-flex h-6 items-center rounded-2xl border border-primary-comfy-orange/50 px-3 text-[11px] leading-none font-bold tracking-wider text-primary-comfy-orange uppercase"
      data-testid="model-status"
    >
      {{
        shown === 'deprecated'
          ? t('workshop.model.deprecated')
          : t('workshop.model.degraded')
      }}
    </span>
    <p
      v-else
      class="rounded-2xl border border-primary-comfy-orange/40 bg-primary-comfy-orange/10 px-4 py-3 text-sm text-primary-warm-white"
      data-testid="model-status-banner"
    >
      <template v-if="shown === 'deprecated'">
        {{ t('workshop.model.deprecatedBody') }}
        <a
          v-if="successor?.href"
          :href="successor.href"
          class="ml-2 font-bold text-primary-comfy-yellow hover:underline"
        >
          {{
            t('workshop.model.deprecatedSuccessor', {
              successor: successor.name
            })
          }}
          →
        </a>
      </template>
      <template v-else>
        {{ t('workshop.model.degradedBody') }}
      </template>
    </p>
  </template>
</template>
