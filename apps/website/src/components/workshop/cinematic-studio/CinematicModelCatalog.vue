<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CinematicCatalogEntry } from '../../../lib/workshop/cinematic-studio/model-catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'

const {
  entries,
  selectable,
  locale = 'en'
} = defineProps<{
  entries: readonly CinematicCatalogEntry[]
  selectable: readonly string[]
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [slug: string]; returnFocus: [] }>()
const search = ref('')
const modality = ref('all')
const modalities = [
  'all',
  'image',
  'video',
  'audio',
  '3d',
  'text',
  'other'
] as const
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return entries.filter(
    (entry) =>
      (modality.value === 'all' || entry.modality === modality.value) &&
      `${entry.name} ${entry.provider} ${entry.routerId}`
        .toLowerCase()
        .includes(query)
  )
})
function select(slug: string) {
  emit('select', slug)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="flex max-h-[90dvh] flex-col gap-4 sm:max-w-3xl"
      :close-label="tc('cinematic.catalog.close', locale)"
      @close-auto-focus.prevent="emit('returnFocus')"
    >
      <DialogTitle class="pr-10">{{
        tc('cinematic.catalog.title', locale)
      }}</DialogTitle>
      <DialogDescription>{{
        tc('cinematic.catalog.description', locale)
      }}</DialogDescription>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm text-primary-warm-white">
          {{ tc('cinematic.catalog.search', locale) }}
          <input
            v-model="search"
            type="search"
            class="min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink p-2"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-primary-warm-white">
          {{ tc('cinematic.catalog.type', locale) }}
          <select
            v-model="modality"
            class="min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink p-2"
          >
            <option v-for="kind in modalities" :key="kind" :value="kind">
              {{ tc(`cinematic.catalog.${kind}`, locale) }}
            </option>
          </select>
        </label>
      </div>
      <p role="status" class="text-sm text-primary-warm-gray">
        {{ filtered.length }} / {{ entries.length }}
      </p>
      <div
        class="min-h-0 overflow-y-auto"
        data-testid="cinematic-model-catalog-results"
      >
        <p v-if="!filtered.length" class="py-6 text-primary-warm-gray">
          {{ tc('cinematic.catalog.empty', locale) }}
        </p>
        <ul class="space-y-2">
          <li
            v-for="entry in filtered"
            :key="entry.slug"
            class="flex flex-col gap-3 rounded-xl border border-transparency-white-t8 p-3 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium wrap-break-word text-primary-warm-white">
                {{ entry.name }}
              </p>
              <p class="text-xs text-primary-warm-gray">
                {{ entry.provider }} ·
                {{ tc(`cinematic.catalog.${entry.modality}`, locale) }}
              </p>
              <p class="text-xs wrap-break-word text-primary-warm-gray">
                {{ entry.routerId }}
              </p>
              <p class="mt-1 text-xs text-primary-comfy-canvas">
                {{
                  tc(
                    selectable.includes(entry.slug)
                      ? 'cinematic.catalog.studio'
                      : entry.runnable
                        ? 'cinematic.catalog.native'
                        : 'cinematic.catalog.unavailable',
                    locale
                  )
                }}
              </p>
            </div>
            <Button
              v-if="selectable.includes(entry.slug)"
              variant="outline"
              @click="select(entry.slug)"
              >{{ tc('cinematic.catalog.use', locale) }}</Button
            >
            <a
              v-else
              :href="entry.href"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 rounded-lg border border-transparency-white-t20 px-3 py-2 text-center text-sm text-primary-comfy-yellow underline-offset-4 hover:underline"
              >{{ tc('cinematic.catalog.open', locale) }} ↗</a
            >
          </li>
        </ul>
      </div>
    </DialogContent>
  </Dialog>
</template>
