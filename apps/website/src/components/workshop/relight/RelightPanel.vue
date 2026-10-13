<script setup lang="ts">
import { computed } from 'vue'

import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import EditorCollapsible from '@/components/workshop/app-editor/EditorCollapsible.vue'
import EditorPromptBox from '@/components/workshop/app-editor/EditorPromptBox.vue'
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
const PANEL_SECTIONS: readonly string[] = [
  'lights',
  'shadows',
  'scene',
  'masks'
]
const sections = RELIGHT_SECTIONS.filter((section) =>
  PANEL_SECTIONS.includes(section.id)
)

const prompt = computed({
  get: () => setup.value.generation.prompt,
  set: (value: string) => relight.updateGeneration({ prompt: value }, 'prompt')
})
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
      :caption="image?.name"
      :add-label="lc('relight.empty.upload', locale)"
      :hint="lc('relight.photo.hint', locale)"
      :remove-label="lc('relight.photo.remove', locale)"
      input-test-id="relight-photo-file"
      @file="relight.useFile"
      @remove="relight.removeImage"
    />

    <EditorPromptBox
      v-model="prompt"
      :label="lc('relight.generation.prompt', locale)"
      :placeholder="lc('relight.generation.promptPlaceholder', locale)"
    />

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
