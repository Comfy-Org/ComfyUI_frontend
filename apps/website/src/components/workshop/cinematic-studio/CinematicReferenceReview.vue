<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import { loadReferenceBundle } from '../../../lib/workshop/cinematic-studio/reference-bundles'
import { libraryCopy as copy } from '../../../lib/workshop/cinematic-studio/library-copy'

const {
  item,
  namespace,
  locale = 'en'
} = defineProps<{
  item: SavedCreation
  namespace?: string
  locale?: Locale
}>()
const references = ref<{ url: string; name: string; role: string }[]>([])
const failed = ref(false)
const loading = ref(false)
let epoch = 0
function clear() {
  references.value.forEach((reference) => URL.revokeObjectURL(reference.url))
  references.value = []
}
watch(
  () => [namespace, item.id, item.settings?.referenceBundleId] as const,
  async ([scope, , bundle]) => {
    const current = ++epoch
    clear()
    failed.value = false
    loading.value = false
    if (!scope || !bundle) return
    loading.value = true
    try {
      const files = await loadReferenceBundle(scope, bundle)
      if (current !== epoch) return
      references.value = files.map(({ role, file }) => ({
        role,
        name: file.name,
        url: URL.createObjectURL(file)
      }))
      failed.value = !files.length
    } catch {
      if (current === epoch) failed.value = true
    } finally {
      if (current === epoch) loading.value = false
    }
  },
  { immediate: true }
)
onScopeDispose(() => {
  ++epoch
  clear()
})
const roleLabel = (role: string) => {
  switch (role) {
    case 'first':
      return copy('firstBoundary', locale)
    case 'last':
      return copy('lastBoundary', locale)
    case 'cast':
      return copy('castReference', locale)
    case 'palette':
      return copy('paletteReference', locale)
    case 'edit':
      return copy('editReference', locale)
    default:
      return copy('assetReference', locale)
  }
}
</script>
<template>
  <section
    class="mt-4 space-y-3 border-t border-transparency-white-t20 pt-4"
    :aria-label="copy('reviewReferences', locale)"
  >
    <p class="text-sm text-primary-comfy-canvas">
      {{ copy('actualReferences', locale) }}
    </p>
    <p v-if="loading" role="status" class="text-sm text-primary-comfy-canvas">
      {{ copy('loading', locale) }}
    </p>
    <p
      v-else-if="failed"
      role="alert"
      class="text-sm text-primary-comfy-canvas"
    >
      {{ copy('restoreError', locale) }}
    </p>
    <p v-else-if="!references.length" class="text-sm text-primary-comfy-canvas">
      {{ copy('noReferenceRecord', locale) }}
    </p>
    <div class="grid grid-cols-2 gap-3">
      <figure
        v-for="reference in references"
        :key="reference.url"
        class="min-w-0"
      >
        <img
          :src="reference.url"
          :alt="`${roleLabel(reference.role)}: ${reference.name}`"
          class="aspect-video w-full rounded-lg object-contain"
        />
        <figcaption
          class="mt-1 text-xs wrap-break-word text-primary-comfy-canvas"
        >
          {{ roleLabel(reference.role) }} · {{ reference.name }}
        </figcaption>
      </figure>
    </div>
    <fieldset class="space-y-2 text-sm text-primary-warm-white">
      <legend class="mb-2 font-semibold">
        {{ copy('continuityChecklist', locale) }}
      </legend>
      <label
        v-for="key in [
          'checkIdentity',
          'checkScene',
          'checkFraming',
          'checkBoundaries'
        ] as const"
        :key="key"
        class="flex items-start gap-2"
      >
        <input type="checkbox" class="mt-1" />{{ copy(key, locale) }}
      </label>
    </fieldset>
  </section>
</template>
