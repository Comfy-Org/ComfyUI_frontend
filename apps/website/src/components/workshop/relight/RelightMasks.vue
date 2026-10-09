<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import EditorSelect from '@/components/workshop/app-editor/EditorSelect.vue'
import RelightMaskRow from './RelightMaskRow.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup, lights, selected } = relight
const subject = ref('')
const subjectId = useId()
const target = computed(() =>
  lights.value.find((light) => light.id === selected.value)
)
const lightOptions = computed(() =>
  lights.value.map((light) => ({ id: light.id, label: light.name }))
)

function create() {
  relight.addMask(subject.value)
  subject.value = ''
}

function applyMask(mask?: string) {
  if (target.value) relight.updateLight(target.value.id, { mask })
}
</script>

<template>
  <EditorSelect
    v-if="target"
    :model-value="target.id"
    :label="lc('relight.masks.applyTo', locale)"
    :options="lightOptions"
    @update:model-value="(id) => (selected = id)"
  />
  <p v-else class="px-1 text-xs text-primary-warm-gray">
    {{ lc('relight.masks.noLights', locale) }}
  </p>
  <div
    v-if="target"
    role="radiogroup"
    :aria-label="lc('relight.masks.area', locale, { name: target.name })"
    class="flex flex-col gap-0.5"
  >
    <RelightMaskRow
      :label="lc('relight.masks.whole', locale)"
      :checked="!target.mask"
      @pick="applyMask(undefined)"
    />
    <RelightMaskRow
      v-for="mask in setup.masks"
      :key="mask.id"
      :label="mask.name"
      :checked="target.mask === mask.id"
      :shown="mask.visible"
      :labels="{
        show: lc('relight.mask.show', locale, { name: mask.name }),
        hide: lc('relight.mask.hide', locale, { name: mask.name }),
        remove: lc('relight.mask.remove', locale, { name: mask.name })
      }"
      @pick="applyMask(mask.id)"
      @toggle="relight.updateMask(mask.id, { visible: !mask.visible })"
      @remove="relight.removeMask(mask.id)"
    />
  </div>
  <form class="flex flex-col gap-1.5 px-1" @submit.prevent="create">
    <label :for="subjectId" class="text-xs text-primary-warm-gray">{{
      lc('relight.masks.subject', locale)
    }}</label>
    <div class="flex gap-1.5">
      <input
        :id="subjectId"
        v-model="subject"
        type="text"
        :placeholder="lc('relight.masks.subjectPlaceholder', locale)"
        class="h-8 min-w-0 flex-1 rounded-lg bg-transparency-white-t4 px-2.5 text-xs text-primary-warm-white placeholder:text-primary-warm-gray/60 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      />
      <button
        type="submit"
        :disabled="!subject.trim()"
        class="h-8 shrink-0 rounded-lg bg-transparency-white-t8 px-3 text-xs text-primary-warm-white transition hover:bg-transparency-white-t20 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      >
        {{ lc('relight.masks.create', locale) }}
      </button>
    </div>
  </form>
</template>
