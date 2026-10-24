<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import TagRemoveButton from '@/components/chip/TagRemoveButton.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'

import type { AttachmentValidationError } from '@/workbench/extensions/agent/types/composerAttachment'
import type { AssetPreviewMode } from '@/workbench/extensions/agent/types/assetPreview'
import AssetHoverPreview from './AssetHoverPreview.vue'
import AssetThumbnail from './AssetThumbnail.vue'

const {
  name,
  previewUrl,
  mediaUrl,
  mediaKind,
  uploading = false,
  validationError,
  highlighted = false
} = defineProps<{
  name: string
  previewUrl?: string
  mediaUrl?: string
  mediaKind?: MediaKind
  uploading?: boolean
  validationError?: AttachmentValidationError
  highlighted?: boolean
}>()
const emit = defineEmits<{ remove: [] }>()
const previewMode = defineModel<AssetPreviewMode>('previewMode', {
  default: 'closed'
})

const { t } = useI18n()

const kind = computed(() => mediaKind ?? getMediaTypeFromFilename(name))
const VALIDATION_MESSAGES = {
  'invalid-video': 'agent.attachmentInvalidVideo',
  'unsupported-type': 'agent.attachmentUnsupportedType'
} as const satisfies Record<AttachmentValidationError, string>

const outlined = computed(
  () => !!validationError || (kind.value === 'image' && !previewUrl)
)
const invalidThumbnailKind = computed(() =>
  validationError === 'unsupported-type' ? 'other' : mediaKind
)
const validationMessage = computed(
  () => validationError && t(VALIDATION_MESSAGES[validationError], { name })
)
</script>

<template>
  <span
    data-testid="agent-attachment-chip"
    :data-attachment-name="name"
    :data-highlighted="highlighted || undefined"
    role="group"
    :aria-label="name"
    :class="
      cn(
        'group/attachment relative flex size-20 shrink-0 items-center justify-center rounded-lg p-1 data-highlighted:ring-2 data-highlighted:ring-foreground data-highlighted:ring-inset',
        outlined && 'ring-1 ring-border ring-inset'
      )
    "
  >
    <Tooltip v-if="validationError">
      <TooltipTrigger as-child>
        <span
          role="status"
          tabindex="0"
          :aria-label="validationMessage"
          class="flex size-full items-center justify-center rounded-sm"
        >
          <AssetThumbnail
            :name
            :media-kind="invalidThumbnailKind"
            variant="tray"
            class="size-full"
          />
          <span
            aria-hidden="true"
            class="pointer-events-none absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full bg-background/80"
          >
            <span
              class="icon-[lucide--triangle-alert] size-3 text-destructive"
            />
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" class="max-w-56">
        {{ validationMessage }}
      </TooltipContent>
    </Tooltip>
    <AssetHoverPreview
      v-else
      v-model:mode="previewMode"
      :name
      :preview-url
      :media-url
      :media-kind
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
        class="pointer-events-none absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full bg-background/80"
      >
        <span class="icon-[lucide--play] size-3" />
      </span>
      <span
        v-if="uploading"
        role="status"
        :aria-label="$t('agent.uploading')"
        class="absolute inset-0 flex items-center justify-center bg-background/60"
      >
        <span
          class="icon-[lucide--loader-circle] size-5 animate-spin text-muted-foreground"
        />
      </span>
    </AssetHoverPreview>
    <TagRemoveButton
      :aria-label="$t('agent.removeAsset', { name })"
      class="pointer-events-none absolute top-1 right-1 size-5 shrink-0 rounded-full bg-background text-foreground opacity-0 ring-1 ring-border/50 group-focus-within/attachment:pointer-events-auto group-focus-within/attachment:opacity-100 group-hover/attachment:pointer-events-auto group-hover/attachment:opacity-100 hover:bg-accent touch:pointer-events-auto touch:size-7 touch:opacity-100"
      @click="emit('remove')"
    />
  </span>
</template>
