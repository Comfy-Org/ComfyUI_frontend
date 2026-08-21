<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
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
  <span
    class="text-agent-fg inline-flex h-7 items-center gap-1 rounded-lg border border-white/15 bg-white/4.5 px-2.5 text-xs/4 font-medium"
  >
    <span
      v-if="uploading"
      :aria-label="$t('agent.uploading')"
      class="text-agent-fg-subtle icon-[lucide--loader-circle] size-3.5 animate-spin"
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
    <span class="max-w-32 truncate">{{ name }}</span>
    <button
      type="button"
      :aria-label="$t('agent.remove')"
      class="text-agent-fg-muted hover:text-agent-fg flex size-3.5 shrink-0 cursor-pointer items-center justify-center p-0 transition-colors"
      @click="emit('remove')"
    >
      <span class="icon-[lucide--x] size-3.5 shrink-0" />
    </button>
  </span>
</template>
