<script setup lang="ts">
import CinematicStudioNotices from './CinematicStudioNotices.vue'
import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import type { Locale } from '../../../i18n/translations'
import type { useCinematicShot } from '../../../composables/useCinematicShot'
import { tcRecipe } from '../../../lib/workshop/cinematic-studio/recipe-copy'
import { tcEnhancement } from '../../../lib/workshop/cinematic-studio/enhancement-copy'
import { tcAssets } from '../../../lib/workshop/cinematic-studio/assets-copy'
import { libraryCopy } from '../../../lib/workshop/cinematic-studio/library-copy'
import Button from '../../ui/button/Button.vue'
const { shot, enhancementModel, locale } = defineProps<{
  shot: ReturnType<typeof useCinematicShot>
  enhancementModel?: WorkshopModelDetail
  locale: Locale
}>()
const {
  studio,
  library,
  libraryOpen,
  openBuilder,
  creativeOpen,
  assetsOpen,
  scene,
  transitionOpen,
  motionOpen,
  mode,
  selectedAssets,
  removeAsset
} = shot
const emit = defineEmits<{ enhancer: []; recipe: []; compare: [] }>()
</script>

<template>
  <div
    class="mx-auto my-3 flex w-full max-w-7xl flex-wrap items-center gap-3 px-4"
  >
    <Button
      variant="outline"
      :disabled="studio.rendering.value"
      @click="libraryOpen = true"
      >{{ libraryCopy('title', locale) }}</Button
    >
    <Button
      variant="outline"
      :disabled="studio.rendering.value"
      @click="openBuilder"
      >{{ libraryCopy('builder', locale) }}</Button
    >
    <Button
      variant="outline"
      :disabled="studio.rendering.value"
      @click="creativeOpen = true"
      >{{ libraryCopy('creative', locale) }}</Button
    >
    <Button
      variant="outline"
      :disabled="studio.rendering.value"
      @click="assetsOpen = true"
    >
      {{ tcAssets('title', locale) }}
    </Button>
    <Button
      v-if="enhancementModel"
      variant="outline"
      :disabled="studio.rendering.value || !scene.trim()"
      @click="emit('enhancer')"
      >{{ tcEnhancement('title', locale) }}</Button
    >
    <Button
      variant="outline"
      :disabled="studio.rendering.value"
      @click="emit('recipe')"
      >{{ tcRecipe('title', locale) }}</Button
    >
    <Button
      variant="outline"
      :disabled="library.items.value.length < 2"
      @click="emit('compare')"
      >{{ libraryCopy('compare', locale) }}</Button
    >
    <Button
      variant="outline"
      :disabled="studio.rendering.value"
      @click="transitionOpen = true"
      >{{ libraryCopy('transition', locale) }}</Button
    >
    <Button
      variant="outline"
      :disabled="studio.rendering.value"
      @click="motionOpen = true"
      >{{ libraryCopy('motion', locale) }}</Button
    >
    <CinematicStudioNotices :shot :locale><slot /></CinematicStudioNotices>
  </div>
  <div
    v-if="selectedAssets.length"
    class="mx-auto mb-3 flex w-full max-w-7xl flex-wrap items-center gap-2 px-4"
    :aria-label="tcAssets('active', locale)"
  >
    <Button
      v-for="asset in selectedAssets"
      :key="asset.id"
      variant="outline"
      :disabled="studio.rendering.value"
      :aria-label="`${tcAssets('detach', locale)}: ${asset.name}`"
      @click="removeAsset(asset.id)"
    >
      {{ tcAssets(asset.kind, locale) }}: {{ asset.name }} Ã—
    </Button>
    <p v-if="mode === 'video'" class="text-xs text-primary-comfy-canvas">
      {{ tcAssets('imageOnly', locale) }}
    </p>
  </div>
</template>
