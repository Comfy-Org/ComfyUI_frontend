<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <!-- Workflow name -->
    <label class="flex flex-col gap-2">
      <span class="text-sm text-muted-foreground">
        {{ $t('comfyHubPublish.workflowName') }}
      </span>
      <Input
        :model-value="name"
        :placeholder="$t('comfyHubPublish.workflowNamePlaceholder')"
        @update:model-value="$emit('update:name', String($event))"
      />
    </label>

    <!-- Workflow description -->
    <label class="flex flex-col gap-2">
      <span class="text-sm text-muted-foreground">
        {{ $t('comfyHubPublish.workflowDescription') }}
      </span>
      <Textarea
        :model-value="description"
        :placeholder="$t('comfyHubPublish.workflowDescriptionPlaceholder')"
        rows="4"
        @update:model-value="$emit('update:description', String($event))"
      />
    </label>

    <!-- Tags -->
    <div class="flex flex-col gap-2">
      <span class="text-sm text-muted-foreground">
        {{ $t('comfyHubPublish.tags') }}
      </span>
      <TagsInput
        v-slot="{ isEmpty }"
        class="bg-modal-card-background-hovered"
        :model-value="tags"
        @update:model-value="$emit('update:tags', $event as string[])"
      >
        <TagsInputItem v-for="tag in tags" :key="tag" :value="tag">
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput
          :is-empty="isEmpty"
          :placeholder="$t('comfyHubPublish.tagsPlaceholder')"
        />
      </TagsInput>
      <div v-if="availableSuggestions.length > 0" class="flex flex-col gap-1">
        <span class="text-xs text-muted-foreground">
          {{ $t('comfyHubPublish.suggestedTags') }}
        </span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="tag in availableSuggestions"
            :key="tag"
            class="cursor-pointer rounded-full border border-border-default bg-transparent px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted-background hover:text-base-foreground"
            @click="addTag(tag)"
          >
            + {{ tag }}
          </button>
        </div>
      </div>
    </div>

    <!-- Thumbnail type -->
    <div class="flex flex-col gap-2">
      <span class="text-sm text-muted-foreground">
        {{ $t('comfyHubPublish.thumbnailType') }}
      </span>
      <div class="flex gap-4">
        <button
          v-for="option in thumbnailOptions"
          :key="option.value"
          :class="
            cn(
              'flex flex-1 cursor-pointer items-center gap-2 rounded border-none p-2',
              thumbnailType === option.value
                ? 'bg-muted-background'
                : 'bg-node-component-surface'
            )
          "
          @click="$emit('update:thumbnailType', option.value)"
        >
          <div
            :ref="
              option.overlayImage
                ? (el) => (compareContainerRef = el as HTMLElement)
                : undefined
            "
            class="relative aspect-square w-1/2 overflow-hidden rounded-sm"
          >
            <img
              :src="option.image"
              :alt="option.label"
              class="h-full w-full object-cover"
            />
            <template v-if="option.overlayImage">
              <img
                :src="option.overlayImage"
                :alt="option.label"
                class="absolute inset-0 h-full w-full object-cover"
                :style="{
                  clipPath: `inset(0 ${100 - compareSliderPosition}% 0 0)`
                }"
              />
              <div
                class="pointer-events-none absolute inset-y-0 w-0.5 bg-white/30 backdrop-blur-sm"
                :style="{ left: `${compareSliderPosition}%` }"
              />
            </template>
          </div>
          <span
            class="w-1/2 text-center text-sm font-bold text-base-foreground"
          >
            {{ option.label }}
          </span>
        </button>
      </div>
    </div>

    <!-- Upload thumbnail -->
    <div class="flex min-h-0 flex-1 shrink flex-col gap-2">
      <span class="text-sm text-muted-foreground">
        {{ $t('comfyHubPublish.uploadThumbnail') }}
      </span>
      <label
        class="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border-default transition-colors hover:border-muted-foreground"
        @dragover.prevent
        @drop.prevent="handleFileDrop"
      >
        <input
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileSelect"
        />
        <template v-if="thumbnailPreviewUrl">
          <img
            :src="thumbnailPreviewUrl"
            :alt="$t('comfyHubPublish.thumbnailPreview')"
            class="max-h-full max-w-full object-contain"
          />
        </template>
        <template v-else>
          <span class="text-sm text-muted-foreground">
            {{ $t('comfyHubPublish.uploadThumbnailPrompt') }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{ $t('comfyHubPublish.uploadThumbnailHint') }}
          </span>
        </template>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '@/components/ui/input/Input.vue'
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { COMFY_HUB_TAG_OPTIONS } from '@/platform/workflow/sharing/constants/comfyHubTags'
import type { ThumbnailType } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { cn } from '@/utils/tailwindUtil'
import { useMouseInElement } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { tags } = defineProps<{
  name: string
  description: string
  tags: string[]
  thumbnailType: ThumbnailType
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:description': [value: string]
  'update:tags': [value: string[]]
  'update:thumbnailType': [value: ThumbnailType]
  'update:thumbnailFile': [value: File]
}>()

const { t } = useI18n()

const availableSuggestions = computed(() =>
  COMFY_HUB_TAG_OPTIONS.filter((tag) => !tags.includes(tag))
)

function addTag(tag: string) {
  emit('update:tags', [...tags, tag])
}

const thumbnailOptions = [
  {
    value: 'image' as const,
    label: t('comfyHubPublish.thumbnailImage'),
    image: '/assets/images/comfyhub/type_image.png'
  },
  {
    value: 'video' as const,
    label: t('comfyHubPublish.thumbnailVideo'),
    image: '/assets/images/comfyhub/type_video.gif'
  },
  {
    value: 'imageComparison' as const,
    label: t('comfyHubPublish.thumbnailImageComparison'),
    image: '/assets/images/comfyhub/type_compare_b.png',
    overlayImage: '/assets/images/comfyhub/type_compare_a.png'
  }
]

const thumbnailPreviewUrl = ref<string | null>(null)

onBeforeUnmount(() => {
  if (thumbnailPreviewUrl.value) {
    URL.revokeObjectURL(thumbnailPreviewUrl.value)
  }
})

const compareSliderPosition = ref(50)
const compareContainerRef = ref<HTMLElement | null>(null)
const { elementX, elementWidth, isOutside } =
  useMouseInElement(compareContainerRef)

watch([elementX, elementWidth, isOutside], ([x, width, outside]) => {
  if (!outside && width > 0) {
    compareSliderPosition.value = (x / width) * 100
  }
})

function setThumbnailPreview(file: File) {
  if (thumbnailPreviewUrl.value) {
    URL.revokeObjectURL(thumbnailPreviewUrl.value)
  }
  thumbnailPreviewUrl.value = URL.createObjectURL(file)
  emit('update:thumbnailFile', file)
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    setThumbnailPreview(file)
  }
}

function handleFileDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file?.type.startsWith('image/')) {
    setThumbnailPreview(file)
  }
}
</script>
