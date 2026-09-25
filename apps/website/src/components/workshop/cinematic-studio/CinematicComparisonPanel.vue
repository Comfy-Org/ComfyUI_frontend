<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { comparisonPanel } from './comparison-view'
import { tcComparison } from '../../../lib/workshop/cinematic-studio/comparison-copy'
import type { ComparisonCopyKey } from '../../../lib/workshop/cinematic-studio/comparison-copy'
import { comparisonDirectionLabels } from './comparison-view'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import { comparisonCanShow } from '../../../lib/workshop/cinematic-studio/comparison'
import { libraryCopy } from '../../../lib/workshop/cinematic-studio/library-copy'
import Button from '../../ui/button/Button.vue'
import CinematicComparisonMetadata from './CinematicComparisonMetadata.vue'
import CinematicComparisonMedia from './CinematicComparisonMedia.vue'
const { panel, locale, open, revealed, urls, busy } = defineProps<{
  panel: ReturnType<typeof comparisonPanel>
  locale: Locale
  open: boolean
  revealed: readonly string[]
  urls: Readonly<Record<string, string>>
  busy: boolean
}>()
const emit = defineEmits<{
  reveal: [string]
  reuse: [SavedCreation]
  animate: [SavedCreation]
}>()
const t = (key: ComparisonCopyKey) => tcComparison(key, locale)
</script>
<template>
  <section
    :aria-label="t(panel.index === 0 ? 'first' : 'second')"
    class="flex min-w-0 flex-col gap-3 rounded-xl border border-transparency-white-t20 p-3 text-primary-warm-white"
  >
    <h3 class="text-base font-semibold wrap-break-word">
      {{ panel.item.name }}
    </h3>
    <CinematicComparisonMedia
      :panel
      :locale
      :open
      :revealed
      :urls
      @reveal="emit('reveal', $event)"
    />
    <div class="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        :disabled="
          busy ||
          (!!panel.item.settings?.operation &&
            panel.item.settings.operation !== 'generate')
        "
        @click="emit('reuse', panel.item)"
        >{{ libraryCopy('reuse', locale) }}</Button
      >
      <Button
        v-if="panel.item.kind === 'image'"
        variant="outline"
        size="sm"
        :disabled="
          busy || !comparisonCanShow(panel.item, revealed, urls[panel.item.id])
        "
        @click="emit('animate', panel.item)"
        >{{ libraryCopy('animate', locale) }}</Button
      >
      <template
        v-if="comparisonCanShow(panel.item, revealed, urls[panel.item.id])"
      >
        <a
          :href="urls[panel.item.id]"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-lg border border-transparency-white-t20 px-3 py-2 text-sm"
          >{{ t('openOriginal') }}</a
        >
        <a
          :href="urls[panel.item.id]"
          :download="panel.item.fileName"
          class="rounded-lg border border-transparency-white-t20 px-3 py-2 text-sm"
          >{{ t('download') }}</a
        >
      </template>
    </div>
    <p
      v-if="
        panel.item.settings?.operation &&
        panel.item.settings.operation !== 'generate'
      "
      class="text-sm text-primary-comfy-canvas"
    >
      {{ t('editReuseUnavailable') }}
    </p>
    <CinematicComparisonMetadata :panel :locale />

    <details>
      <summary class="cursor-pointer text-sm font-semibold">
        {{ t('prompt') }}
      </summary>
      <p
        class="mt-2 max-h-52 overflow-auto text-sm/relaxed wrap-break-word whitespace-pre-wrap text-primary-comfy-canvas"
        tabindex="0"
      >
        {{ panel.item.prompt }}
      </p>
    </details>
    <details>
      <summary class="cursor-pointer text-sm font-semibold">
        {{ t('settings') }}
      </summary>
      <p
        v-if="comparisonDirectionLabels(panel.item, locale).length"
        class="mt-2 text-sm/relaxed wrap-break-word text-primary-comfy-canvas"
      >
        <span class="font-semibold">{{ t('direction') }}: </span
        >{{ comparisonDirectionLabels(panel.item, locale).join(' · ') }}
      </p>
      <p v-else class="mt-2 text-sm text-primary-comfy-canvas">
        {{ t('noSettings') }}
      </p>
    </details>
  </section>
</template>
