<script setup lang="ts">
import { useId } from 'vue'

import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import EditorCollapsible from '@/components/workshop/app-editor/EditorCollapsible.vue'
import EditorSlider from '@/components/workshop/app-editor/EditorSlider.vue'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import RelightFormatBar from './RelightFormatBar.vue'
import RelightMood from './RelightMood.vue'
import RelightTools from './RelightTools.vue'
import { RELIGHT_SECTIONS, sectionMeta } from './sections'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { image, phase, setup } = relight
const promptId = useId()
const PANEL_SECTIONS: readonly string[] = [
  'lights',
  'shadows',
  'scene',
  'masks'
]
const sections = RELIGHT_SECTIONS.filter((section) =>
  PANEL_SECTIONS.includes(section.id)
)

function onPrompt(event: Event) {
  if (event.target instanceof HTMLTextAreaElement)
    relight.updateGeneration({ prompt: event.target.value }, 'prompt')
}
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="flex min-w-0 flex-col gap-3 pt-2"
    data-testid="relight-panel"
  >
    <EditorSourceTile
      kind="image"
      :src="image?.url"
      :name="image?.name"
      :add-label="lc('relight.empty.upload', locale)"
      :change-label="lc('relight.photo.change', locale)"
      input-test-id="relight-photo-file"
      @file="relight.useFile"
    />

    <div
      class="flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
    >
      <label :for="promptId" class="sr-only">
        {{ lc('relight.generation.prompt', locale) }}
      </label>
      <textarea
        :id="promptId"
        :value="setup.generation.prompt"
        rows="4"
        :placeholder="lc('relight.generation.promptPlaceholder', locale)"
        class="h-28 resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
        @input="onPrompt"
      />
    </div>

    <RelightMood :relight :locale />

    <div>
      <EditorCollapsible
        v-for="section in sections"
        :key="section.id"
        :title="lc(section.title, locale)"
        :meta="sectionMeta(section.id, relight, locale)"
        :initially-open="section.open"
      >
        <template v-if="section.id === 'lights'" #actions>
          <RelightTools :relight :locale compact />
        </template>
        <component :is="section.content" :relight :locale />
      </EditorCollapsible>
    </div>

    <EditorSlider
      :model-value="setup.generation.strength"
      :label="lc('relight.generation.strength', locale)"
      unit="%"
      @update:model-value="
        (strength) => relight.updateGeneration({ strength }, 'strength')
      "
    />

    <RelightFormatBar :relight :locale />
  </fieldset>
</template>
