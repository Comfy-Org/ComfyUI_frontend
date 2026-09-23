<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import Tag from '@/components/chip/Tag.vue'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

const {
  name,
  previewUrl,
  uploading = false
} = defineProps<{
  name: string
  previewUrl?: string
  uploading?: boolean
}>()
const emit = defineEmits<{ remove: [] }>()

const kind = computed(() => getMediaTypeFromFilename(name))

/* The shared map's 'other' glyph is a checkmark, which reads as a status
   rather than a file on this surface. */
const kindIconClass = computed(() =>
  kind.value === 'other' ? 'icon-[lucide--file]' : iconForMediaType(kind.value)
)
</script>

<template>
  <!-- `data-attachment-name` anchors black-box coverage of what a drop actually
       attached: the visible label truncates, so asserting on rendered text alone
       cannot tell one long filename from another. -->
  <Tag
    data-testid="agent-attachment-chip"
    :data-attachment-name="name"
    :label="name"
    removable
    :remove-label="$t('agent.remove')"
    class="max-w-48"
    @remove="emit('remove')"
  >
    <template #icon>
      <span
        v-if="uploading"
        role="status"
        :aria-label="$t('agent.uploading')"
        class="icon-[lucide--loader-circle] size-3.5 animate-spin text-muted-foreground"
      />
      <!-- Only an image kind renders its preview: a server thumbnail for an
           audio or 3D asset would repaint the broken-image chip this fixed. -->
      <img
        v-else-if="previewUrl && kind === 'image'"
        :src="previewUrl"
        :alt="name"
        class="size-3.5 shrink-0 rounded-sm object-cover"
      />
      <span v-else :class="cn(kindIconClass, 'size-3.5 shrink-0')" />
    </template>
  </Tag>
</template>
