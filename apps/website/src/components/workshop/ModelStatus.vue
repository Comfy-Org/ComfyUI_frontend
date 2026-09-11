<script setup lang="ts">
import type { ModelStatus } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  variant,
  status: shown,
  successor,
  locale = 'en'
} = defineProps<{
  variant: 'pill' | 'banner'
  status?: ModelStatus
  successor?: { name: string; href: string }
  locale?: Locale
}>()
</script>

<template>
  <template v-if="shown">
    <span
      v-if="variant === 'pill'"
      class="border-primary-comfy-orange/50 text-primary-comfy-orange inline-flex h-6 items-center rounded-2xl border px-3 text-[11px] leading-none font-bold tracking-wider uppercase"
      data-testid="model-status"
    >
      {{
        shown === 'deprecated'
          ? t('workshop.model.deprecated', locale)
          : t('workshop.model.degraded', locale)
      }}
    </span>
    <p
      v-else
      class="border-primary-comfy-orange/40 bg-primary-comfy-orange/10 rounded-2xl border px-4 py-3 text-sm text-primary-warm-white"
      data-testid="model-status-banner"
    >
      <template v-if="shown === 'deprecated'">
        {{ t('workshop.model.deprecatedBody', locale) }}
        <a
          v-if="successor"
          :href="successor.href"
          class="text-primary-comfy-yellow ml-2 font-bold hover:underline"
        >
          {{
            t('workshop.model.deprecatedSuccessor', locale).replace(
              '{successor}',
              successor.name
            )
          }}
          →
        </a>
      </template>
      <template v-else>
        {{ t('workshop.model.degradedBody', locale) }}
      </template>
    </p>
  </template>
</template>
