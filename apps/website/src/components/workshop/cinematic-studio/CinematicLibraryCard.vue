<script setup lang="ts">
import CinematicLibraryMedia from './CinematicLibraryMedia.vue'
import { computed } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import { libraryCopy as copy } from '../../../lib/workshop/cinematic-studio/library-copy'
import CinematicReferenceReview from './CinematicReferenceReview.vue'
import Button from '../../ui/button/Button.vue'
const { item, url, modelName, namespace, locale } = defineProps<{
  item: SavedCreation
  url?: string
  modelName: string
  namespace?: string
  locale: Locale
}>()
const revealed = defineModel<readonly string[]>('revealed', { required: true })
const reviewing = defineModel<string>('reviewing')
const renaming = defineModel<string>('renaming')
const removing = defineModel<string>('removing')
const newName = defineModel<string>('newName', { required: true })
const hidden = computed(() => item.nsfw && !revealed.value.includes(item.id))
const emit = defineEmits<{
  reuse: [item: SavedCreation]
  nextShot: [item: SavedCreation]
  animate: [item: SavedCreation]
  edit: [item: SavedCreation]
  recipe: [item: SavedCreation]
  beginRename: [item: SavedCreation]
  rename: [item: SavedCreation]
  remove: [item: SavedCreation]
  favorite: [id: string, value: boolean]
}>()
const fieldClass =
  'h-10 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink px-3 text-sm text-primary-warm-white'
</script>

<template>
  <article class="min-w-0 rounded-2xl border border-transparency-white-t20 p-3">
    <CinematicLibraryMedia
      :item
      :url
      :hidden
      :locale
      @reveal="revealed = [...revealed, item.id]"
    />
    <h3 class="mt-3 truncate font-semibold text-primary-warm-white">
      {{ item.name }}
    </h3>
    <p class="mt-1 truncate text-xs text-primary-comfy-canvas">
      {{ modelName }}
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        v-if="item.kind === 'image' && !hidden"
        size="sm"
        variant="outline"
        @click="emit('nextShot', item)"
        >{{ copy('nextShot', locale) }}</Button
      >
      <Button
        v-if="!hidden"
        size="sm"
        variant="outline"
        :aria-expanded="reviewing === item.id"
        @click="reviewing = reviewing === item.id ? undefined : item.id"
        >{{ copy('reviewReferences', locale) }}</Button
      >
      <a
        :href="url"
        :download="item.fileName"
        class="rounded-lg border border-transparency-white-t20 px-3 py-2 text-sm text-primary-warm-white"
        >{{ copy('download', locale) }}</a
      >
      <Button
        variant="outline"
        size="sm"
        :disabled="
          !!item.settings?.operation && item.settings.operation !== 'generate'
        "
        @click="emit('reuse', item)"
        >{{ copy('reuse', locale) }}</Button
      >
      <Button variant="outline" size="sm" @click="emit('recipe', item)">{{
        copy('recipe', locale)
      }}</Button>
      <Button
        v-if="item.kind === 'image'"
        variant="outline"
        size="sm"
        @click="emit('animate', item)"
        >{{ copy('animate', locale) }}</Button
      >
      <Button
        v-if="item.kind === 'image'"
        variant="outline"
        size="sm"
        @click="emit('edit', item)"
        >{{ copy('edit', locale) }}</Button
      >
      <Button
        variant="outline"
        size="sm"
        :aria-pressed="item.favorite"
        @click="emit('favorite', item.id, !item.favorite)"
        >{{ copy('favorite', locale) }}</Button
      >
      <Button variant="outline" size="sm" @click="emit('beginRename', item)">{{
        copy('rename', locale)
      }}</Button>
      <Button variant="outline" size="sm" @click="removing = item.id">{{
        copy('remove', locale)
      }}</Button>
    </div>
    <CinematicReferenceReview
      v-if="reviewing === item.id && !hidden"
      :key="item.id"
      :item
      :namespace
      :locale
    />
    <form
      v-if="renaming === item.id"
      class="mt-3 flex gap-2"
      @submit.prevent="emit('rename', item)"
    >
      <input
        v-model="newName"
        required
        maxlength="200"
        :aria-label="copy('name', locale)"
        :class="fieldClass"
        class="min-w-0 flex-1"
      />
      <Button type="submit" size="sm">{{ copy('rename', locale) }}</Button>
    </form>
    <div
      v-if="removing === item.id"
      class="mt-3 text-sm text-primary-warm-white"
    >
      <p>{{ copy('confirmDelete', locale) }}</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <Button size="sm" @click="emit('remove', item)">{{
          copy('remove', locale)
        }}</Button>
        <Button size="sm" variant="outline" @click="removing = undefined">{{
          copy('cancel', locale)
        }}</Button>
      </div>
    </div>
  </article>
</template>
