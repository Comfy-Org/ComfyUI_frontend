<template>
  <div class="flex flex-col gap-6 p-6">
    <h2 class="text-lg font-semibold">
      {{ t('templatePublishing.steps.metadata.title') }}
    </h2>
    <p class="text-muted-foreground">
      {{ t('templatePublishing.steps.metadata.description') }}
    </p>

    <FormItem
      id="tpl-title"
      v-model:form-value="ctx.template.value.title"
      :item="titleField"
    />

    <div class="flex flex-row items-center gap-2">
      <div class="form-label flex grow items-center">
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
      <div class="form-label flex grow items-center">
        <span id="tpl-tags-label" class="text-muted">
          {{ t('templatePublishing.steps.metadata.tagsLabel') }}
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <div class="relative">
          <input
            v-model="tagQuery"
            type="text"
            class="h-8 w-44 rounded border border-border-default bg-transparent px-2 text-sm focus:outline-none"
            :placeholder="
              t('templatePublishing.steps.metadata.tagsPlaceholder')
            "
            aria-labelledby="tpl-tags-label"
            @focus="showSuggestions = true"
            @keydown.enter.prevent="addTag(tagQuery)"
          />
          <ul
            v-if="showSuggestions && filteredSuggestions.length > 0"
            class="absolute z-10 mt-1 max-h-40 w-44 overflow-auto rounded border border-border-default bg-comfy-menu-background shadow-md"
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
        <div
          v-if="ctx.template.value.tags?.length"
          class="flex flex-wrap gap-1"
        >
          <span
            v-for="tag in ctx.template.value.tags"
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
      </div>
    </div>

    <div class="flex flex-row items-center gap-2">
      <div class="form-label flex grow items-center">
        <span id="tpl-difficulty-label" class="text-muted">
          {{ t('templatePublishing.steps.metadata.difficultyLabel') }}
        </span>
      </div>
      <div
        class="flex flex-row gap-4"
        role="radiogroup"
        aria-labelledby="tpl-difficulty-label"
      >
        <label
          v-for="option in DIFFICULTY_OPTIONS"
          :key="option.value"
          :for="`tpl-difficulty-${option.value}`"
          class="flex cursor-pointer items-center gap-1.5 text-sm"
        >
          <input
            :id="`tpl-difficulty-${option.value}`"
            type="radio"
            name="tpl-difficulty"
            :value="option.value"
            :checked="ctx.template.value.difficulty === option.value"
            :class="
              cn(
                'h-5 w-5 appearance-none rounded-full border checked:bg-current checked:shadow-[inset_0_0_0_1px_white]',
                option.borderClass
              )
            "
            @change="ctx.template.value.difficulty = option.value"
          />
          {{ option.text }}
        </label>
      </div>
    </div>

    <FormItem
      id="tpl-license"
      v-model:form-value="ctx.template.value.license"
      :item="licenseField"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import FormItem from '@/components/common/FormItem.vue'
import type { FormItem as FormItemType } from '@/platform/settings/types'
import { cn } from '@/utils/tailwindUtil'

import { PublishingStepperKey } from '../types'

const { t } = useI18n()
const ctx = inject(PublishingStepperKey)!

const CATEGORIES = [
  { key: 'imageGeneration', value: 'image-generation' },
  { key: 'videoGeneration', value: 'video-generation' },
  { key: 'audio', value: 'audio' },
  { key: 'text', value: 'text' },
  { key: 'threeD', value: '3d' },
  { key: 'upscaling', value: 'upscaling' },
  { key: 'inpainting', value: 'inpainting' },
  { key: 'controlNet', value: 'controlnet' },
  { key: 'styleTransfer', value: 'style-transfer' },
  { key: 'other', value: 'other' }
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

const titleField: FormItemType = {
  name: t('templatePublishing.steps.metadata.titleLabel'),
  type: 'text'
}

const DIFFICULTY_OPTIONS = [
  {
    text: t('templatePublishing.steps.metadata.difficulty.beginner'),
    value: 'beginner' as const,
    borderClass: 'border-green-400'
  },
  {
    text: t('templatePublishing.steps.metadata.difficulty.intermediate'),
    value: 'intermediate' as const,
    borderClass: 'border-amber-400'
  },
  {
    text: t('templatePublishing.steps.metadata.difficulty.advanced'),
    value: 'advanced' as const,
    borderClass: 'border-red-400'
  }
]

const licenseField: FormItemType = {
  name: t('templatePublishing.steps.metadata.licenseLabel'),
  type: 'combo',
  options: [
    { text: t('templatePublishing.steps.metadata.license.mit'), value: 'mit' },
    {
      text: t('templatePublishing.steps.metadata.license.ccBy'),
      value: 'cc-by'
    },
    {
      text: t('templatePublishing.steps.metadata.license.ccBySa'),
      value: 'cc-by-sa'
    },
    {
      text: t('templatePublishing.steps.metadata.license.ccByNc'),
      value: 'cc-by-nc'
    },
    {
      text: t('templatePublishing.steps.metadata.license.apache'),
      value: 'apache'
    },
    {
      text: t('templatePublishing.steps.metadata.license.custom'),
      value: 'custom'
    }
  ],
  attrs: { filter: true }
}

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
