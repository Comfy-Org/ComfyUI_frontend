<script setup lang="ts">
import { computed, ref } from 'vue'
import CinematicReferenceReview from './CinematicReferenceReview.vue'

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
const kind = ref('all')
const onlyFavorites = ref(false)
const removing = ref<string>()
const renaming = ref<string>()
const newName = ref('')
const revealed = ref<readonly string[]>([])
const reviewing = ref<string>()
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
        <article
          v-for="item in visible"
          :key="item.id"
          class="min-w-0 rounded-2xl border border-transparency-white-t20 p-3"
        >
          <div
            v-if="item.nsfw && !revealed.includes(item.id)"
            class="flex aspect-video flex-col items-center justify-center gap-3 bg-primary-comfy-ink text-sm text-primary-warm-white"
          >
            {{ copy('hidden', locale) }}
            <Button
              variant="outline"
              @click="revealed = [...revealed, item.id]"
              >{{ copy('reveal', locale) }}</Button
            >
          </div>
          <img
            v-else-if="item.kind === 'image'"
            :src="urls[item.id]"
            :alt="item.name"
            loading="lazy"
            class="aspect-video w-full rounded-xl object-contain"
          />
          <video
            v-else
            :src="urls[item.id]"
            controls
            playsinline
            preload="none"
            :aria-label="item.name"
            class="aspect-video w-full rounded-xl"
          />
          <h3 class="mt-3 truncate font-semibold text-primary-warm-white">
            {{ item.name }}
          </h3>
          <p class="mt-1 truncate text-xs text-primary-comfy-canvas">
            {{
              models.find((model) => model.slug === item.modelSlug)?.name ??
              item.kind
            }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <Button
              v-if="
                item.kind === 'image' &&
                (!item.nsfw || revealed.includes(item.id))
              "
              size="sm"
              variant="outline"
              @click="nextShot(item)"
              >{{ copy('nextShot', locale) }}</Button
            >
            <Button
              v-if="!item.nsfw || revealed.includes(item.id)"
              size="sm"
              variant="outline"
              :aria-expanded="reviewing === item.id"
              @click="reviewing = reviewing === item.id ? undefined : item.id"
              >{{ copy('reviewReferences', locale) }}</Button
            >
            <a
              :href="urls[item.id]"
              :download="item.fileName"
              class="rounded-lg border border-transparency-white-t20 px-3 py-2 text-sm text-primary-warm-white"
              >{{ copy('download', locale) }}</a
            >
            <Button
              variant="outline"
              size="sm"
              :disabled="
                !!item.settings?.operation &&
                item.settings.operation !== 'generate'
              "
              @click="reuse(item)"
              >{{ copy('reuse', locale) }}</Button
            >
            <Button variant="outline" size="sm" @click="recipe(item)">{{
              copy('recipe', locale)
            }}</Button>
            <Button
              v-if="item.kind === 'image'"
              variant="outline"
              size="sm"
              @click="animate(item)"
              >{{ copy('animate', locale) }}</Button
            >
            <Button
              v-if="item.kind === 'image'"
              variant="outline"
              size="sm"
              @click="edit(item)"
              >{{ copy('edit', locale) }}</Button
            >
            <Button
              variant="outline"
              size="sm"
              :aria-pressed="item.favorite"
              @click="emit('favorite', item.id, !item.favorite)"
              >{{ copy('favorite', locale) }}</Button
            >
            <Button variant="outline" size="sm" @click="beginRename(item)">{{
              copy('rename', locale)
            }}</Button>
            <Button variant="outline" size="sm" @click="removing = item.id">{{
              copy('remove', locale)
            }}</Button>
          </div>
          <CinematicReferenceReview
            v-if="
              reviewing === item.id &&
              (!item.nsfw || revealed.includes(item.id))
            "
            :key="item.id"
            :item
            :namespace
            :locale
          />
          <form
            v-if="renaming === item.id"
            class="mt-3 flex gap-2"
            @submit.prevent="rename(item)"
          >
            <input
              v-model="newName"
              required
              maxlength="200"
              :aria-label="copy('name', locale)"
              :class="fieldClass"
              class="min-w-0 flex-1"
            />
            <Button type="submit" size="sm">{{
              copy('rename', locale)
            }}</Button>
          </form>
          <div
            v-if="removing === item.id"
            class="mt-3 text-sm text-primary-warm-white"
          >
            <p>{{ copy('confirmDelete', locale) }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <Button size="sm" @click="remove(item)">{{
                copy('remove', locale)
              }}</Button>
              <Button
                size="sm"
                variant="outline"
                @click="removing = undefined"
                >{{ copy('cancel', locale) }}</Button
              >
            </div>
          </div>
        </article>
      </div>
    </DialogContent>
  </Dialog>
</template>
