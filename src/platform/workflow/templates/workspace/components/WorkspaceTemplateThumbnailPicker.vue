<template>
  <Field>
    <div class="flex h-8 items-center justify-between">
      <FieldLabel>{{ $t('workspaceTemplates.thumbnail') }}</FieldLabel>
      <Button
        v-if="url || comparisonUrl"
        variant="muted-textonly"
        size="sm"
        @click="clear"
      >
        {{ $t('g.clear') }}
      </Button>
    </div>

    <ToggleGroup
      type="single"
      :model-value="type"
      :allow-empty="false"
      class="w-full rounded-lg bg-secondary p-1"
      @update:model-value="onTypeChange"
    >
      <ToggleGroupItem
        v-for="option in typeOptions"
        :key="option.value"
        :value="option.value"
        class="h-8 flex-1 gap-2 data-[state=on]:bg-foreground data-[state=on]:text-background"
      >
        <i :class="option.icon" />
        {{ option.label }}
      </ToggleGroupItem>
    </ToggleGroup>

    <div v-if="type === 'image_comparison'" class="grid h-48 grid-cols-2 gap-2">
      <label
        v-for="slot in comparisonSlots"
        :key="slot.key"
        :ref="(el) => setComparisonDrop(slot.key, el)"
        :class="dropZoneClass(Boolean(slot.url))"
      >
        <input
          type="file"
          accept="image/*"
          class="hidden"
          @change="(event) => onFileInput(event, slot.key)"
        />
        <img
          v-if="slot.url"
          :src="slot.url"
          :alt="slot.label"
          class="max-h-full max-w-full object-contain"
        />
        <template v-else>
          <i class="mb-3 icon-[lucide--upload] size-5 text-muted-foreground" />
          <span class="text-sm text-muted-foreground">{{ slot.label }}</span>
          <span class="mt-2 text-xs text-muted-foreground">
            {{ $t('comfyHubPublish.uploadThumbnailHint') }}
          </span>
        </template>
      </label>
    </div>
    <label
      v-else
      ref="singleDrop"
      :class="cn(dropZoneClass(Boolean(url)), 'h-48')"
    >
      <input
        type="file"
        :accept="type === 'video' ? 'video/*,image/gif,image/webp' : 'image/*'"
        class="hidden"
        @change="(event) => onFileInput(event, 'single')"
      />
      <img
        v-if="url"
        :src="url"
        :alt="$t('comfyHubPublish.thumbnailPreview')"
        class="max-h-full max-w-full object-contain"
      />
      <template v-else>
        <i class="mb-3 icon-[lucide--upload] size-5 text-muted-foreground" />
        <span class="text-sm text-muted-foreground">
          {{ $t('comfyHubPublish.uploadPromptClickToBrowse') }}
        </span>
        <span class="text-sm text-muted-foreground">
          {{
            type === 'video'
              ? $t('comfyHubPublish.uploadPromptDropVideo')
              : $t('comfyHubPublish.uploadPromptDropImage')
          }}
        </span>
        <span class="mt-2 text-xs text-muted-foreground">
          {{ $t('comfyHubPublish.uploadThumbnailHint') }}
        </span>
      </template>
    </label>
  </Field>
</template>

<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Field from '@comfyorg/design-system/field/Field'
import FieldLabel from '@comfyorg/design-system/field/FieldLabel'
import ToggleGroup from '@comfyorg/design-system/toggle-group/ToggleGroup'
import ToggleGroupItem from '@comfyorg/design-system/toggle-group/ToggleGroupItem'
import { cn } from '@comfyorg/tailwind-utils'

import { useToast } from '@/components/ui/toast/toastStore'

import { fileToThumbnailDataUrl } from '@/platform/workflow/templates/workspace/thumbnailFiles'
import type { WorkspaceTemplateThumbnailType } from '@/platform/workflow/templates/workspace/workspaceTemplateTypes'

type DropTarget = 'single' | 'before' | 'after'

const type = defineModel<WorkspaceTemplateThumbnailType>('type', {
  required: true
})
const url = defineModel<string>('url', { required: true })
const comparisonUrl = defineModel<string>('comparisonUrl', {
  required: true
})

const { t } = useI18n()
const toast = useToast()

const typeOptions = computed<
  { value: WorkspaceTemplateThumbnailType; label: string; icon: string }[]
>(() => [
  {
    value: 'image',
    label: t('comfyHubPublish.thumbnailImage'),
    icon: 'icon-[lucide--image]'
  },
  {
    value: 'video',
    label: t('comfyHubPublish.thumbnailVideo'),
    icon: 'icon-[lucide--video]'
  },
  {
    value: 'image_comparison',
    label: t('comfyHubPublish.thumbnailImageComparison'),
    icon: 'icon-[lucide--diff]'
  }
])

const comparisonSlots = computed(() => [
  {
    key: 'before' as const,
    label: t('comfyHubPublish.uploadComparisonBeforePrompt'),
    url: comparisonUrl.value
  },
  {
    key: 'after' as const,
    label: t('comfyHubPublish.uploadComparisonAfterPrompt'),
    url: url.value
  }
])

function dropZoneClass(hasImage: boolean) {
  return cn(
    'flex min-w-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-border text-center transition-colors hover:border-muted-foreground',
    hasImage && 'p-1'
  )
}

function clear() {
  url.value = ''
  comparisonUrl.value = ''
}

function onTypeChange(value: unknown) {
  if (value !== 'image' && value !== 'video' && value !== 'image_comparison')
    return
  type.value = value
  clear()
}

async function acceptFile(file: File | undefined, target: DropTarget) {
  if (!file) return
  const dataUrl = await fileToThumbnailDataUrl(file)
  if (!dataUrl) {
    toast.error(t('workspaceTemplates.errors.thumbnail'), { duration: 3000 })
    return
  }
  if (target === 'before') comparisonUrl.value = dataUrl
  else url.value = dataUrl
}

function onFileInput(event: Event, target: DropTarget) {
  if (!(event.target instanceof HTMLInputElement)) return
  void acceptFile(event.target.files?.[0], target)
  event.target.value = ''
}

const singleDrop = ref<HTMLElement | null>(null)
const beforeDrop = shallowRef<HTMLElement | null>(null)
const afterDrop = shallowRef<HTMLElement | null>(null)

function setComparisonDrop(key: 'before' | 'after', el: unknown) {
  const element = el instanceof HTMLElement ? el : null
  if (key === 'before') beforeDrop.value = element
  else afterDrop.value = element
}

useDropZone(singleDrop, {
  onDrop: (files) => void acceptFile(files?.[0], 'single')
})
useDropZone(beforeDrop, {
  onDrop: (files) => void acceptFile(files?.[0], 'before')
})
useDropZone(afterDrop, {
  onDrop: (files) => void acceptFile(files?.[0], 'after')
})
</script>
