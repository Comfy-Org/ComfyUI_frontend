<template>
  <div data-testid="step-details" class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <label for="publish-title" class="text-sm font-medium">
          {{ $t('marketplace.title') }}
        </label>
        <input
          v-if="readOnly"
          id="publish-title"
          :value="title"
          data-testid="input-title"
          type="text"
          readonly
          class="border-border rounded-md border bg-muted/30 px-3 py-2 text-sm"
        />
        <input
          v-else
          id="publish-title"
          v-model="title"
          data-testid="input-title"
          type="text"
          class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label for="publish-description" class="text-sm font-medium">
          {{ $t('marketplace.description') }}
        </label>
        <textarea
          v-if="readOnly"
          id="publish-description"
          :value="description"
          data-testid="input-description"
          rows="4"
          readonly
          class="border-border rounded-md border bg-muted/30 px-3 py-2 text-sm"
        />
        <textarea
          v-else
          id="publish-description"
          v-model="description"
          data-testid="input-description"
          rows="4"
          class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label for="publish-short-description" class="text-sm font-medium">
          {{ $t('marketplace.shortDescription') }}
        </label>
        <input
          v-if="readOnly"
          id="publish-short-description"
          :value="shortDescription"
          data-testid="input-short-description"
          type="text"
          readonly
          class="border-border rounded-md border bg-muted/30 px-3 py-2 text-sm"
        />
        <input
          v-else
          id="publish-short-description"
          v-model="shortDescription"
          data-testid="input-short-description"
          type="text"
          class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label for="publish-license" class="text-sm font-medium">
          {{ $t('marketplace.license') }}
        </label>
        <SingleSelect
          v-if="!readOnly"
          id="publish-license"
          v-model="license"
          :label="$t('marketplace.license')"
          :options="licenseOptions"
          data-testid="input-license"
          size="md"
        />
        <input
          v-else
          id="publish-license"
          :value="licenseLabel"
          data-testid="input-license"
          type="text"
          readonly
          class="border-border rounded-md border bg-muted/30 px-3 py-2 text-sm"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">
          {{ $t('marketplace.tags') }}
        </label>
        <TagInputWithAutocomplete
          v-if="!readOnly"
          v-model="tags"
          :placeholder="$t('marketplace.tagsPlaceholder')"
        />
        <div
          v-else
          class="flex flex-wrap gap-1"
          data-testid="input-tags-readonly"
        >
          <span
            v-for="tag in tags"
            :key="tag"
            class="rounded-full bg-muted/50 px-2 py-0.5 text-xs"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <p class="text-xs text-muted">
        {{ $t('marketplace.previewDescription') }}
      </p>
      <div
        class="flex w-full justify-center rounded-lg border border-border-default bg-base-background py-5"
      >
        <div class="w-full max-w-72">
          <MarketplaceTemplatePreviewCard
            :title="title"
            :short-description="shortDescription"
            :description="description"
            :license-label="licenseLabel"
            :tags="tags"
            :thumbnail-url="thumbnailUrl"
          >
            <template v-if="!readOnly" #thumbnail-placeholder>
              <div
                class="relative flex size-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors"
                :class="
                  cn(
                    'cursor-pointer border-border-default bg-dialog-surface hover:border-muted-foreground',
                    isOverThumbnailDrop && 'border-muted-foreground'
                  )
                "
                data-testid="preview-thumbnail-placeholder"
                data-handles-file-drop
                @click="thumbnailFileInputRef?.click()"
                @dragover.prevent="handleThumbnailDragOver"
                @dragleave="handleThumbnailDragLeave"
                @drop.prevent="handleThumbnailDrop"
              >
                <input
                  ref="thumbnailFileInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  data-testid="input-thumbnail-file"
                  @change="handleThumbnailFileSelect"
                />
                <div
                  v-if="isUploadingThumbnail"
                  class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-base-background/80"
                >
                  <i
                    class="icon-[lucide--loader-circle] size-10 animate-spin text-muted"
                    aria-hidden
                  />
                </div>
                <i class="icon-[lucide--image] size-10 text-muted" />
                <span class="text-xs text-muted">
                  {{ $t('marketplace.dropThumbnailHere') }}
                </span>
              </div>
            </template>
          </MarketplaceTemplatePreviewCard>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import TagInputWithAutocomplete from '@/components/input/TagInputWithAutocomplete.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import MarketplaceTemplatePreviewCard from '@/platform/marketplace/components/MarketplaceTemplatePreviewCard.vue'
import type { LicenseType } from '@/platform/marketplace/apiTypes'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { extractFilesFromDragEvent, hasImageType } from '@/utils/eventUtils'
import { cn } from '@/utils/tailwindUtil'

const title = defineModel<string>('title', { required: true })
const description = defineModel<string>('description', { required: true })
const shortDescription = defineModel<string>('shortDescription', {
  required: true
})
const license = defineModel<LicenseType>('license', { required: true })
const tags = defineModel<string[]>('tags', { required: true })

defineProps<{
  readOnly: boolean
  thumbnailUrl: string | null
  licenseOptions: { name: string; value: string }[]
  licenseLabel: string
  isUploadingThumbnail: boolean
}>()

const emit = defineEmits<{
  (e: 'thumbnailSelected', file: File): void
}>()

const { t } = useI18n()
const isOverThumbnailDrop = ref(false)
const thumbnailFileInputRef = ref<HTMLInputElement | null>(null)

function hasImageDropData(e: DragEvent): boolean {
  if (!e.dataTransfer) return false
  if (e.dataTransfer.files?.length) {
    return Array.from(e.dataTransfer.files).some(hasImageType)
  }
  return ['text/uri-list', 'text/x-moz-url'].some((type) =>
    e.dataTransfer!.types.includes(type)
  )
}

function handleThumbnailDragOver(e: DragEvent) {
  if (!hasImageDropData(e)) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'copy'
  isOverThumbnailDrop.value = true
}

function handleThumbnailDragLeave() {
  isOverThumbnailDrop.value = false
}

async function handleThumbnailDrop(e: DragEvent) {
  isOverThumbnailDrop.value = false
  e.preventDefault()
  e.stopPropagation()
  const files = await extractFilesFromDragEvent(e)
  const imageFile = files.find(hasImageType)
  if (!imageFile) {
    useToastStore().addAlert(t('marketplace.thumbnailUploadError'))
    return
  }
  emit('thumbnailSelected', imageFile)
}

function handleThumbnailFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!hasImageType(file)) {
    useToastStore().addAlert(t('marketplace.thumbnailUploadError'))
    return
  }
  emit('thumbnailSelected', file)
  input.value = ''
}
</script>
