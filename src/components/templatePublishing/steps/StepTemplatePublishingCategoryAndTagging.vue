<template>
  <div class="flex flex-col gap-6 p-6">
    <div class="flex flex-row items-center gap-2">
      <div class="form-label flex w-28 shrink-0 items-center">
        <span id="tpl-category-label" class="text-muted">
          {{ t('templatePublishing.steps.metadata.categoryLabel') }}
        </span>
      </div>
      <div
        class="flex flex-wrap gap-2"
        role="group"
        aria-labelledby="tpl-category-label"
      >
        <label
          v-for="cat in CATEGORIES"
          :key="cat.value"
          :for="`tpl-category-${cat.value}`"
          class="flex cursor-pointer items-center gap-1.5 text-sm"
        >
          <input
            :id="`tpl-category-${cat.value}`"
            type="checkbox"
            :checked="ctx.template.value.categories?.includes(cat.value)"
            @change="toggleCategory(cat.value)"
          />
          {{ t(`templatePublishing.steps.metadata.category.${cat.key}`) }}
        </label>
      </div>
    </div>

    <div class="flex flex-row items-center gap-2">
      <div class="form-label flex w-28 shrink-0 items-center">
        <span id="tpl-tags-label" class="text-muted">
          {{ t('templatePublishing.steps.metadata.tagsLabel') }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <div
          v-if="(ctx.template.value.tags ?? []).length > 0"
          class="flex max-h-20 flex-wrap gap-1 overflow-y-auto scrollbar-custom"
        >
          <span
            v-for="tag in ctx.template.value.tags ?? []"
            :key="tag"
            class="inline-flex items-center gap-1 rounded-full bg-comfy-input-background px-2 py-0.5 text-xs"
          >
            {{ tag }}
            <button
              type="button"
              class="hover:text-danger"
              :aria-label="`Remove tag ${tag}`"
              @click="removeTag(tag)"
            >
              <i class="icon-[lucide--x] h-3 w-3" />
            </button>
          </span>
        </div>
        <div class="relative">
          <input
            v-model="tagQuery"
            type="text"
            class="h-8 w-44 rounded border border-border-default bg-secondary-background px-2 text-sm focus:outline-none"
            :placeholder="
              t('templatePublishing.steps.metadata.tagsPlaceholder')
            "
            aria-labelledby="tpl-tags-label"
            @focus="showSuggestions = true"
            @keydown.enter.prevent="addTag(tagQuery)"
          />
          <ul
            v-if="showSuggestions && filteredSuggestions.length > 0"
            class="absolute z-10 mt-1 max-h-40 w-44 overflow-auto rounded border border-border-default bg-secondary-background shadow-md"
          >
            <li
              v-for="suggestion in filteredSuggestions"
              :key="suggestion"
              class="cursor-pointer px-2 py-1 text-sm hover:bg-comfy-input-background"
              @mousedown.prevent="addTag(suggestion)"
            >
              {{ suggestion }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { PublishingStepperKey } from '../types'

const { t } = useI18n()
const ctx = inject(PublishingStepperKey)!

const CATEGORIES = [
  { key: 'threeD', value: '3d' },
  { key: 'audio', value: 'audio' },
  { key: 'controlNet', value: 'controlnet' },
  { key: 'imageGeneration', value: 'image-generation' },
  { key: 'inpainting', value: 'inpainting' },
  { key: 'other', value: 'other' },
  { key: 'styleTransfer', value: 'style-transfer' },
  { key: 'text', value: 'text' },
  { key: 'upscaling', value: 'upscaling' },
  { key: 'videoGeneration', value: 'video-generation' }
] as const

const TAG_SUGGESTIONS = [
  'stable-diffusion',
  'flux',
  'sdxl',
  'sd1.5',
  'img2img',
  'txt2img',
  'upscale',
  'face-restore',
  'animation',
  'video',
  'lora',
  'controlnet',
  'ipadapter',
  'inpainting',
  'outpainting',
  'depth',
  'pose',
  'segmentation',
  'latent',
  'sampler'
]

const tagQuery = ref('')
const showSuggestions = ref(false)

const filteredSuggestions = computed(() => {
  const query = tagQuery.value.toLowerCase().trim()
  if (!query) return []
  const existing = ctx.template.value.tags ?? []
  return TAG_SUGGESTIONS.filter(
    (s) => s.includes(query) && !existing.includes(s)
  )
})

function toggleCategory(value: string) {
  const categories = ctx.template.value.categories ?? []
  const index = categories.indexOf(value)
  if (index >= 0) {
    categories.splice(index, 1)
  } else {
    categories.push(value)
  }
  ctx.template.value.categories = [...categories]
}

function addTag(tag: string) {
  const trimmed = tag.trim().toLowerCase()
  if (!trimmed) return
  const tags = ctx.template.value.tags ?? []
  if (!tags.includes(trimmed)) {
    ctx.template.value.tags = [...tags, trimmed]
  }
  tagQuery.value = ''
  showSuggestions.value = false
}

function removeTag(tag: string) {
  const tags = ctx.template.value.tags ?? []
  ctx.template.value.tags = tags.filter((t) => t !== tag)
}

watchDebounced(
  () => ctx.template.value,
  () => ctx.saveDraft(),
  { deep: true, debounce: 500 }
)
</script>
