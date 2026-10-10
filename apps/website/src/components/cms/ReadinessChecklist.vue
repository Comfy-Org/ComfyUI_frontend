<script setup lang="ts">
import { CircleCheck, TriangleAlert } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ReadinessGap } from '@/lib/cms/readiness'

/** Every check a draft item goes through before publishing, passed or not. */
const {
  gaps,
  kind,
  locale = 'en'
} = defineProps<{
  gaps: ReadinessGap[]
  kind: 'MODEL' | 'WORKFLOW' | 'APP'
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const checks: ReadinessGap[] = [
  'page',
  'name',
  'summary',
  'cover',
  ...(kind === 'MODEL' ? (['examples'] as const) : [])
]
</script>

<template>
  <p
    v-if="!gaps.length"
    class="flex items-center gap-2 rounded-lg border border-admin-success/25 bg-admin-success/6 px-3 py-2 text-sm"
  >
    <CircleCheck
      class="size-4 shrink-0 text-admin-success"
      aria-hidden="true"
    />
    {{ t('cmsAdmin.readiness.allPass', { count: checks.length }) }}
  </p>
  <section
    v-else
    class="grid gap-2"
    :aria-label="t('cmsAdmin.readiness.title')"
  >
    <h3 class="text-xs font-medium text-admin-muted">
      {{ t('cmsAdmin.readiness.title') }}
    </h3>
    <ul class="grid gap-1.5 rounded-lg border border-admin-line p-3 text-sm">
      <li v-for="check in checks" :key="check" class="flex items-center gap-2">
        <TriangleAlert
          v-if="gaps.includes(check)"
          class="size-4 shrink-0 text-admin-warning"
          aria-hidden="true"
        />
        <CircleCheck
          v-else
          class="size-4 shrink-0 text-admin-success"
          aria-hidden="true"
        />
        {{
          gaps.includes(check)
            ? t(`cmsAdmin.readiness.missing.${check}`)
            : t(`cmsAdmin.readiness.passed.${check}`)
        }}
      </li>
    </ul>
    <p class="text-xs text-admin-muted">
      {{ t('cmsAdmin.readiness.help') }}
    </p>
  </section>
</template>
