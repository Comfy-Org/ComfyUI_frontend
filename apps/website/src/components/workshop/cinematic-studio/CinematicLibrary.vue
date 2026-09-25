<script setup lang="ts">
import CinematicLibraryCard from './CinematicLibraryCard.vue'
import { computed, onMounted, ref, watch } from 'vue'
import CinematicModelResults from './CinematicModelResults.vue'
import { tcModelResults } from '../../../lib/workshop/cinematic-studio/model-results-copy'

import type { Locale } from '../../../i18n/translations'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import { libraryCopy as copy } from '../../../lib/workshop/cinematic-studio/library-copy'
import { serializeCinematicRecipe } from '../../../lib/workshop/cinematic-studio/recipes'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'

const {
  models,
  items,
  urls,
  loading,
  error,
  namespace,
  locale = 'en'
} = defineProps<{
  models: readonly { slug: string; name: string }[]
  items: readonly SavedCreation[]
  urls: Readonly<Record<string, string>>
  loading: boolean
  error: boolean
  namespace?: string
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  reuse: [item: SavedCreation]
  nextShot: [item: SavedCreation]
  animate: [url: string, name: string]
  edit: [url: string, name: string]
  remove: [id: string]
  rename: [id: string, name: string]
  favorite: [id: string, value: boolean]
  retry: []
}>()
const query = ref('')
const source = ref<'studio' | 'models'>('studio')
const requestedModelLibrary = ref(false)
onMounted(() => {
  requestedModelLibrary.value =
    new URLSearchParams(window.location.search).get('library') ===
    'model-results'
})
watch(
  [() => namespace, requestedModelLibrary],
  () => {
    if (!namespace || !requestedModelLibrary.value) return
    requestedModelLibrary.value = false
    source.value = 'models'
    open.value = true
  },
  { flush: 'post' }
)
const kind = ref('all')
const onlyFavorites = ref(false)
const removing = ref<string>()
const renaming = ref<string>()
const newName = ref('')
const revealed = ref<readonly string[]>([])
const reviewing = ref<string>()
watch(
  () => namespace,
  () => {
    revealed.value = []
    removing.value = undefined
    renaming.value = undefined
    reviewing.value = undefined
  }
)
const visible = computed(() =>
  items.filter(
    (item) =>
      (kind.value === 'all' || item.kind === kind.value) &&
      (!onlyFavorites.value || item.favorite) &&
      `${item.name} ${item.prompt} ${item.modelSlug}`
        .toLowerCase()
        .includes(query.value.toLowerCase())
  )
)
const fieldClass =
  'h-10 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink px-3 text-sm text-primary-warm-white'

function reuse(item: SavedCreation) {
  emit('reuse', item)
  open.value = false
}
function nextShot(item: SavedCreation) {
  emit('nextShot', item)
  open.value = false
}
function animate(item: SavedCreation) {
  emit('animate', urls[item.id], item.fileName)
  open.value = false
}
function edit(item: SavedCreation) {
  emit('edit', urls[item.id], item.fileName)
  open.value = false
}
function beginRename(item: SavedCreation) {
  renaming.value = item.id
  newName.value = item.name
}
function rename(item: SavedCreation) {
  emit('rename', item.id, newName.value)
  renaming.value = undefined
}
function remove(item: SavedCreation) {
  emit('remove', item.id)
  removing.value = undefined
}
function recipe(item: SavedCreation) {
  const url = URL.createObjectURL(
    new Blob([serializeCinematicRecipe(item)], {
      type: 'application/json'
    })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `${item.id}-recipe.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-5xl" :close-label="copy('close', locale)">
      <DialogTitle class="pr-14">{{ copy('title', locale) }}</DialogTitle>
      <DialogDescription class="mt-2 pr-12">{{
        copy('description', locale)
      }}</DialogDescription>
      <div class="mt-4 flex flex-wrap gap-2">
        <Button
          :variant="source === 'studio' ? 'default' : 'outline'"
          :aria-pressed="source === 'studio'"
          @click="source = 'studio'"
          >{{ tcModelResults('studio', locale) }}</Button
        >
        <Button
          :variant="source === 'models' ? 'default' : 'outline'"
          :aria-pressed="source === 'models'"
          @click="source = 'models'"
          >{{ tcModelResults('models', locale) }}</Button
        >
      </div>
      <CinematicModelResults
        v-if="source === 'models'"
        :namespace
        :locale
        @animate="
          (url, name) => {
            emit('animate', url, name)
            open = false
          }
        "
        @edit="
          (url, name) => {
            emit('edit', url, name)
            open = false
          }
        "
      />
      <template v-else>
        <div class="my-5 flex flex-wrap gap-3">
          <input
            v-model="query"
            type="search"
            :aria-label="copy('search', locale)"
            :placeholder="copy('search', locale)"
            :class="fieldClass"
            class="min-w-0 flex-1 basis-full sm:basis-auto"
          />
          <select
            v-model="kind"
            :aria-label="copy('all', locale)"
            :class="fieldClass"
          >
            <option value="all">{{ copy('all', locale) }}</option>
            <option value="image">{{ copy('image', locale) }}</option>
            <option value="video">{{ copy('video', locale) }}</option>
          </select>
          <label class="flex items-center gap-2 text-sm text-primary-warm-white"
            ><input v-model="onlyFavorites" type="checkbox" />{{
              copy('favorites', locale)
            }}</label
          >
        </div>
        <p v-if="loading" role="status">{{ copy('loading', locale) }}</p>
        <div
          v-if="error"
          role="alert"
          class="mb-4 text-sm text-primary-warm-white"
        >
          <p>{{ copy('error', locale) }}</p>
          <Button class="mt-2" variant="outline" @click="emit('retry')">{{
            copy('retry', locale)
          }}</Button>
        </div>
        <p
          v-if="!loading && !visible.length"
          class="py-10 text-center text-primary-comfy-canvas"
        >
          {{ copy('empty', locale) }}
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <CinematicLibraryCard
            v-for="item in visible"
            :key="item.id"
            v-model:revealed="revealed"
            v-model:reviewing="reviewing"
            v-model:renaming="renaming"
            v-model:removing="removing"
            v-model:new-name="newName"
            :item
            :url="urls[item.id]"
            :model-name="
              models.find((model) => model.slug === item.modelSlug)?.name ??
              item.kind
            "
            :namespace
            :locale
            @reuse="reuse"
            @next-shot="nextShot"
            @animate="animate"
            @edit="edit"
            @recipe="recipe"
            @begin-rename="beginRename"
            @rename="rename"
            @remove="remove"
            @favorite="(id, value) => emit('favorite', id, value)"
          />
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
