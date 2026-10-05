<script setup lang="ts">
import { computed } from 'vue'

import TagRemoveButton from '@/components/chip/TagRemoveButton.vue'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'

import AssetHoverPreview from './AssetHoverPreview.vue'
import AssetThumbnail from './AssetThumbnail.vue'

const {
  name,
  previewUrl,
  mediaUrl,
  mediaKind,
  uploading = false,
  highlighted = false
} = defineProps<{
  name: string
  previewUrl?: string
  mediaUrl?: string
  mediaKind?: MediaKind
  uploading?: boolean
  highlighted?: boolean
}>()
const emit = defineEmits<{ remove: [] }>()

const kind = computed(() => mediaKind ?? getMediaTypeFromFilename(name))
</script>

<template>
  <AssetHoverPreview :name :preview-url :media-url :media-kind>
    <span
      data-testid="agent-attachment-chip"
      :data-attachment-name="name"
      :data-highlighted="highlighted || undefined"
      role="group"
      :aria-label="name"
      class="group/attachment relative flex size-20 shrink-0 items-center justify-center rounded-lg p-1 data-highlighted:ring-2 data-highlighted:ring-base-foreground data-highlighted:ring-inset"
    >
      <span
        class="relative flex size-full items-center justify-center overflow-hidden rounded-md"
      >
        <AssetThumbnail
          :name
          :preview-url
          :media-kind
          variant="tray"
          class="size-full"
        />
        <span
          v-if="kind === 'video' && previewUrl"
          aria-hidden="true"
          class="pointer-events-none absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full bg-base-background/80 text-base-foreground"
        >
          <span class="icon-[lucide--play] size-3" />
        </span>
        <span
          v-if="uploading"
          role="status"
          :aria-label="$t('agent.uploading')"
          class="absolute inset-0 flex items-center justify-center bg-base-background/60"
        >
          <span
            class="icon-[lucide--loader-circle] size-5 animate-spin text-muted-foreground"
          />
        </span>
      </span>
      <TagRemoveButton
        :label="$t('agent.remove')"
        class="pointer-events-none absolute top-1 right-1 size-5 shrink-0 rounded-full bg-base-background text-base-foreground opacity-0 ring-1 ring-border-subtle group-focus-within/attachment:pointer-events-auto group-focus-within/attachment:opacity-100 group-hover/attachment:pointer-events-auto group-hover/attachment:opacity-100 hover:bg-secondary-background-hover"
        @click="emit('remove')"
      />
    </span>
  </AssetHoverPreview>
</template>
