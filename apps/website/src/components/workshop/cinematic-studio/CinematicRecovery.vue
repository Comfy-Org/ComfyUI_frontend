<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { CinematicJournalEntry } from '../../../lib/workshop/cinematic-studio/journal'
import { tcRecovery } from '../../../lib/workshop/cinematic-studio/recovery-copy'
import Button from '../../ui/button/Button.vue'

const {
  entries,
  busy,
  error,
  models = [],
  locale = 'en'
} = defineProps<{
  entries: readonly CinematicJournalEntry[]
  busy: boolean
  error: boolean
  models?: readonly { slug: string; name: string }[]
  locale?: Locale
}>()
const emit = defineEmits<{ recover: [id: string]; dismiss: [id: string] }>()
const t = (key: Parameters<typeof tcRecovery>[0]) => tcRecovery(key, locale)
</script>

<template>
  <section
    v-if="entries.length || error"
    class="min-w-0 rounded-2xl border border-transparency-white-t20 p-4"
    :aria-label="t('title')"
  >
    <h2 class="text-sm font-semibold text-primary-warm-white">
      {{ t('title') }}
    </h2>
    <p class="mt-2 text-sm text-primary-comfy-canvas">{{ t('description') }}</p>
    <p v-if="error" role="alert" class="mt-2 text-sm text-primary-warm-white">
      {{ t('error') }}
    </p>
    <ul class="mt-3 flex max-h-80 flex-col gap-3 overflow-y-auto">
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="min-w-0 border-t border-transparency-white-t8 pt-3"
      >
        <p class="truncate text-sm text-primary-warm-white">
          {{ entry.prompt }}
        </p>
        <p class="mt-1 text-xs text-primary-comfy-canvas">
          {{
            models.find((model) => model.slug === entry.modelSlug)?.name ??
            t('modelUnavailable')
          }}
        </p>
        <p class="mt-2 text-sm text-primary-comfy-canvas">
          {{ t(entry.status) }}
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <Button
            v-if="entry.requestId && entry.status !== 'terminal'"
            size="sm"
            variant="outline"
            :disabled="busy"
            @click="emit('recover', entry.id)"
            >{{ t('recover') }}</Button
          >
          <Button
            v-if="entry.status === 'unknown' || entry.status === 'terminal'"
            size="sm"
            variant="outline"
            :disabled="busy"
            @click="emit('dismiss', entry.id)"
            >{{ t('dismiss') }}</Button
          >
        </div>
      </li>
    </ul>
  </section>
</template>
